import { neon } from "@neondatabase/serverless";

import {
  ANALYTICS_EVENT_KINDS,
  ANALYTICS_SUBJECT_KINDS,
  type AnalyticsCounter,
  type AnalyticsCounterKey,
  type AnalyticsDateRange,
  type AnalyticsEventKind,
  type AnalyticsSubjectKind,
} from "@/domain/announcement-analytics";

import { ANALYTICS_SCHEMA_STATEMENTS } from "./analytics-schema";

type AnalyticsSqlValue = number | string;

export type AnalyticsSqlExecutor = Readonly<{
  execute: (
    statement: string,
    parameters: readonly AnalyticsSqlValue[],
  ) => Promise<readonly unknown[]>;
}>;

export type AnalyticsCounterRepository = Readonly<{
  increment: (counter: AnalyticsCounterKey) => Promise<void>;
  initialize: () => Promise<void>;
  isEnabled: () => boolean;
  purgeBefore: (metricDate: string) => Promise<void>;
  read: (range: AnalyticsDateRange) => Promise<readonly AnalyticsCounter[]>;
}>;

export class AnalyticsDatabaseConfigurationError extends Error {
  constructor() {
    super("분석 데이터베이스 연결 문자열이 설정되지 않았습니다.");
  }
}

const INCREMENT_COUNTER = `
  INSERT INTO analytics_daily_counters (metric_date, event_kind, subject_kind, subject_id, total)
  VALUES ($1, $2, $3, $4, 1)
  ON CONFLICT (metric_date, event_kind, subject_kind, subject_id)
  DO UPDATE SET total = analytics_daily_counters.total + 1
`;
const READ_COUNTERS = `
  SELECT metric_date, event_kind, subject_kind, subject_id, total
  FROM analytics_daily_counters
  WHERE metric_date >= $1 AND metric_date <= $2
  ORDER BY metric_date ASC
`;
const PURGE_COUNTERS = "DELETE FROM analytics_daily_counters WHERE metric_date < $1";

export function createAnalyticsCounterRepository(
  connectionString = readAnalyticsDatabaseUrl(),
): AnalyticsCounterRepository {
  if (!connectionString) return createDisabledRepository();
  return createAnalyticsCounterRepositoryWithExecutor(createNeonExecutor(connectionString));
}

export function createAnalyticsCounterRepositoryWithExecutor(
  executor: AnalyticsSqlExecutor,
): AnalyticsCounterRepository {
  return {
    increment: (counter) => incrementCounter(executor, counter),
    initialize: () => initializeAnalyticsSchema(executor),
    isEnabled: () => true,
    purgeBefore: (metricDate) => purgeCounters(executor, metricDate),
    read: (range) => readCounters(executor, range),
  };
}

export function readAnalyticsDatabaseUrl() {
  const values = [process.env.DATABASE_URL, process.env.POSTGRES_URL];
  return values.find(hasText);
}

function createNeonExecutor(connectionString: string): AnalyticsSqlExecutor {
  const sql = neon(connectionString);
  return { execute: (statement, parameters) => sql.query(statement, [...parameters]) };
}

function createDisabledRepository(): AnalyticsCounterRepository {
  return {
    increment: async () => undefined,
    initialize: () => Promise.reject(new AnalyticsDatabaseConfigurationError()),
    isEnabled: () => false,
    purgeBefore: async () => undefined,
    read: async () => [],
  };
}

async function incrementCounter(executor: AnalyticsSqlExecutor, counter: AnalyticsCounterKey) {
  await executor.execute(INCREMENT_COUNTER, createCounterParameters(counter));
}

function createCounterParameters(counter: AnalyticsCounterKey) {
  return [counter.metricDate, counter.eventKind, counter.subjectKind, counter.subjectId];
}

async function initializeAnalyticsSchema(executor: AnalyticsSqlExecutor) {
  for (const statement of ANALYTICS_SCHEMA_STATEMENTS) await executor.execute(statement, []);
}

async function purgeCounters(executor: AnalyticsSqlExecutor, metricDate: string) {
  await executor.execute(PURGE_COUNTERS, [metricDate]);
}

async function readCounters(executor: AnalyticsSqlExecutor, range: AnalyticsDateRange) {
  const rows = await executor.execute(READ_COUNTERS, [range.from, range.to]);
  return rows.flatMap(readCounter);
}

function readCounter(value: unknown): AnalyticsCounter[] {
  if (!isRecord(value)) return [];
  const counter = createCounter(value);
  if (!counter) return [];
  return [counter];
}

function createCounter(value: Record<string, unknown>): AnalyticsCounter | undefined {
  const metricDate = readMetricDate(value.metric_date);
  const eventKind = value.event_kind;
  const subjectKind = value.subject_kind;
  const subjectId = value.subject_id;
  const total = readTotal(value.total);
  if (!metricDate || !isEventKind(eventKind) || !isSubjectKind(subjectKind)) return undefined;
  if (!isText(subjectId) || total === undefined) return undefined;
  return { eventKind, metricDate, subjectId, subjectKind, total };
}

function readMetricDate(value: unknown) {
  if (isText(value)) return value;
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

function readTotal(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value !== "string" || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return undefined;
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: string | undefined): value is string {
  return isText(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEventKind(value: unknown): value is AnalyticsEventKind {
  return typeof value === "string" && ANALYTICS_EVENT_KINDS.includes(value as AnalyticsEventKind);
}

function isSubjectKind(value: unknown): value is AnalyticsSubjectKind {
  return (
    typeof value === "string" && ANALYTICS_SUBJECT_KINDS.includes(value as AnalyticsSubjectKind)
  );
}
