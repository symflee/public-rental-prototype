import { neon } from "@neondatabase/serverless";

import {
  EXPERIMENT_EVENT_KINDS,
  EXPERIMENT_SUBJECT_KINDS,
  EXPERIMENT_VARIANTS,
  type AnalyticsDateRange,
  type ExperimentEvent,
  type ExperimentEventKind,
  type ExperimentFact,
  type ExperimentSubjectKind,
  type ExperimentVariant,
} from "@/domain/announcement-analytics";

import { readAnalyticsDatabaseUrl } from "./analytics-counter-repository";
import { EXPERIMENT_ANALYTICS_SCHEMA_STATEMENTS } from "./analytics-schema";

type ExperimentSqlValue = number | string;

export type ExperimentSqlExecutor = Readonly<{
  execute: (
    statement: string,
    parameters: readonly ExperimentSqlValue[],
  ) => Promise<readonly unknown[]>;
}>;

export type ExperimentEventRepository = Readonly<{
  countAllHomesBookmarkAddedEvents: (
    range: AnalyticsDateRange,
    experimentKey: string,
  ) => Promise<number>;
  initialize: () => Promise<void>;
  isEnabled: () => boolean;
  purgeBefore: (metricDate: string) => Promise<void>;
  readFacts: (
    range: AnalyticsDateRange,
    experimentKey?: string,
  ) => Promise<readonly ExperimentFact[]>;
  record: (event: ExperimentEvent) => Promise<void>;
}>;

const RECORD_EVENT = `
  WITH inserted_event AS (
    INSERT INTO analytics_experiment_events (
      event_id, metric_date, experiment_key, variant, visitor_hash,
      event_kind, subject_kind, subject_id
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING metric_date, experiment_key, variant, visitor_hash,
      event_kind, subject_kind, subject_id
  )
  INSERT INTO analytics_experiment_facts (
    metric_date, experiment_key, variant, visitor_hash,
    event_kind, subject_kind, subject_id
  )
  SELECT metric_date, experiment_key, variant, visitor_hash,
    event_kind, subject_kind, subject_id
  FROM inserted_event
  ON CONFLICT DO NOTHING
`;

const READ_FACTS = `
  SELECT metric_date, experiment_key, variant, visitor_hash,
    event_kind, subject_kind, subject_id
  FROM analytics_experiment_facts
  WHERE metric_date >= $1 AND metric_date <= $2
    AND ($3 = '' OR experiment_key = $3)
  ORDER BY metric_date ASC
`;

const COUNT_ALL_HOMES_BOOKMARK_ADDED_EVENTS = `
  SELECT COUNT(*) AS total
  FROM analytics_experiment_events
  WHERE metric_date >= $1 AND metric_date <= $2
    AND experiment_key = $3
    AND variant = $4
    AND event_kind = $5
`;

const PURGE_EVENTS = "DELETE FROM analytics_experiment_events WHERE metric_date < $1";
const PURGE_FACTS = "DELETE FROM analytics_experiment_facts WHERE metric_date < $1";

export function createExperimentEventRepository(
  connectionString = readAnalyticsDatabaseUrl(),
): ExperimentEventRepository {
  if (!connectionString) return createDisabledRepository();
  return createExperimentEventRepositoryWithExecutor(createNeonExecutor(connectionString));
}

export function createExperimentEventRepositoryWithExecutor(
  executor: ExperimentSqlExecutor,
): ExperimentEventRepository {
  return {
    countAllHomesBookmarkAddedEvents: (range, experimentKey) =>
      countAllHomesBookmarkAddedEvents(executor, range, experimentKey),
    initialize: () => initializeSchema(executor),
    isEnabled: () => true,
    purgeBefore: (metricDate) => purgeFacts(executor, metricDate),
    readFacts: (range, experimentKey) => readFacts(executor, range, experimentKey),
    record: (event) => recordEvent(executor, event),
  };
}

function createNeonExecutor(connectionString: string): ExperimentSqlExecutor {
  const sql = neon(connectionString);
  return { execute: (statement, parameters) => sql.query(statement, [...parameters]) };
}

function createDisabledRepository(): ExperimentEventRepository {
  return {
    countAllHomesBookmarkAddedEvents: async () => 0,
    initialize: async () => undefined,
    isEnabled: () => false,
    purgeBefore: async () => undefined,
    readFacts: async () => [],
    record: async () => undefined,
  };
}

async function initializeSchema(executor: ExperimentSqlExecutor) {
  for (const statement of EXPERIMENT_ANALYTICS_SCHEMA_STATEMENTS) {
    await executor.execute(statement, []);
  }
}

async function recordEvent(executor: ExperimentSqlExecutor, event: ExperimentEvent) {
  await executor.execute(RECORD_EVENT, createEventParameters(event));
}

function createEventParameters(event: ExperimentEvent) {
  return [
    event.eventId,
    event.metricDate,
    event.experimentKey,
    event.variant,
    event.visitorHash,
    event.eventKind,
    event.subjectKind,
    event.subjectId,
  ];
}

async function purgeFacts(executor: ExperimentSqlExecutor, metricDate: string) {
  await executor.execute(PURGE_EVENTS, [metricDate]);
  await executor.execute(PURGE_FACTS, [metricDate]);
}

async function readFacts(
  executor: ExperimentSqlExecutor,
  range: AnalyticsDateRange,
  experimentKey: string | undefined,
) {
  const rows = await executor.execute(READ_FACTS, [range.from, range.to, experimentKey ?? ""]);
  return rows.flatMap(readFact);
}

async function countAllHomesBookmarkAddedEvents(
  executor: ExperimentSqlExecutor,
  range: AnalyticsDateRange,
  experimentKey: string,
) {
  const parameters = [range.from, range.to, experimentKey, "ALL_HOMES", "BOOKMARK_ADDED"];
  const rows = await executor.execute(COUNT_ALL_HOMES_BOOKMARK_ADDED_EVENTS, parameters);
  return readEventCount(rows[0]);
}

function readEventCount(value: unknown) {
  if (!isRecord(value)) return 0;
  const total = Number(value.total);
  if (!Number.isSafeInteger(total) || total < 0) return 0;
  return total;
}

function readFact(value: unknown): ExperimentFact[] {
  if (!isRecord(value)) return [];
  const fact = createFact(value);
  if (!fact) return [];
  return [fact];
}

function createFact(value: Record<string, unknown>): ExperimentFact | undefined {
  const metricDate = readMetricDate(value.metric_date);
  const experimentKey = readText(value.experiment_key);
  const visitorHash = readText(value.visitor_hash);
  const subjectId = readText(value.subject_id);
  if (!metricDate || !experimentKey || !visitorHash || !subjectId) return undefined;
  if (!isEventKind(value.event_kind) || !isVariant(value.variant)) return undefined;
  if (!isSubjectKind(value.subject_kind)) return undefined;
  return createValidatedFact(value, metricDate, experimentKey, visitorHash, subjectId);
}

function createValidatedFact(
  value: Record<string, unknown>,
  metricDate: string,
  experimentKey: string,
  visitorHash: string,
  subjectId: string,
): ExperimentFact {
  return {
    eventKind: value.event_kind as ExperimentEventKind,
    experimentKey,
    metricDate,
    subjectId,
    subjectKind: value.subject_kind as ExperimentSubjectKind,
    variant: value.variant as ExperimentVariant,
    visitorHash,
  };
}

function readMetricDate(value: unknown) {
  if (typeof value === "string" && value.length > 0) return value;
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) return undefined;
  return formatDatabaseDate(value);
}

function formatDatabaseDate(value: Date) {
  const year = value.getFullYear();
  const month = formatDatePart(value.getMonth() + 1);
  const day = formatDatePart(value.getDate());
  return `${year}-${month}-${day}`;
}

function formatDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function isEventKind(value: unknown): value is ExperimentEventKind {
  return EXPERIMENT_EVENT_KINDS.some((eventKind) => eventKind === value);
}

function isVariant(value: unknown): value is ExperimentVariant {
  return EXPERIMENT_VARIANTS.some((variant) => variant === value);
}

function isSubjectKind(value: unknown): value is ExperimentSubjectKind {
  return EXPERIMENT_SUBJECT_KINDS.some((subjectKind) => subjectKind === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return value;
}
