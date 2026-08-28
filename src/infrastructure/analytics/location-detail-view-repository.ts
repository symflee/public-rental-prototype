import { neon } from "@neondatabase/serverless";

import {
  createLocationDetailViewSummary,
  type AnalyticsDateRange,
  type LocationDetailViewEvent,
  type LocationDetailViewSummary,
} from "@/domain/announcement-analytics";

import { readAnalyticsDatabaseUrl } from "./analytics-counter-repository";
import { LOCATION_DETAIL_VIEW_SCHEMA_STATEMENTS } from "./location-detail-view-schema";

type SqlValue = null | number | string;

export type LocationDetailViewSqlExecutor = Readonly<{
  execute: (statement: string, parameters: readonly SqlValue[]) => Promise<readonly unknown[]>;
}>;

export type HistoricalAnalyticsRun = Readonly<{
  datasetId: string;
  label: string;
  periodEndsOn: string;
  periodStartsOn: string;
  referenceTime: string;
}>;

export type LocationDetailBreakdown = Readonly<{
  locationId: string;
  noOpenCount: number;
  openCount: number;
  total: number;
}>;

export type LocationDetailViewRepository = Readonly<{
  clearHistoricalRun: (datasetId: string) => Promise<void>;
  initialize: () => Promise<void>;
  isEnabled: () => boolean;
  isFrozenRun: (datasetId: string) => Promise<boolean>;
  readBreakdown: (
    datasetId: string,
    range: AnalyticsDateRange,
  ) => Promise<readonly LocationDetailBreakdown[]>;
  readSummary: (datasetId: string, range: AnalyticsDateRange) => Promise<LocationDetailViewSummary>;
  record: (event: LocationDetailViewEvent) => Promise<void>;
  replaceHistoricalRun: (
    run: HistoricalAnalyticsRun,
    events: readonly LocationDetailViewEvent[],
  ) => Promise<void>;
}>;

const INSERT_VIEW = `
  INSERT INTO analytics_location_detail_views (
    event_id, dataset_id, metric_date, viewed_at, location_id,
    notice_state, matched_notice_id, status_source, origin
  ) VALUES ($1::uuid, $2, $3::date, $4::timestamptz, $5, $6, $7, $8, $9)
  ON CONFLICT (event_id) DO NOTHING
`;
const READ_SUMMARY = `
  SELECT
    COUNT(*) FILTER (WHERE notice_state = 'OPEN') AS open_total,
    COUNT(*) FILTER (WHERE notice_state = 'NO_OPEN') AS no_open_total
  FROM analytics_location_detail_views
  WHERE dataset_id = $1 AND metric_date >= $2::date AND metric_date <= $3::date
`;
const READ_BREAKDOWN = `
  SELECT location_id,
    COUNT(*) FILTER (WHERE notice_state = 'OPEN') AS open_total,
    COUNT(*) FILTER (WHERE notice_state = 'NO_OPEN') AS no_open_total,
    COUNT(*) FILTER (WHERE notice_state IN ('OPEN', 'NO_OPEN')) AS total
  FROM analytics_location_detail_views
  WHERE dataset_id = $1 AND metric_date >= $2::date AND metric_date <= $3::date
  GROUP BY location_id
  ORDER BY total DESC, location_id ASC
`;
const READ_FROZEN_RUN = `
  SELECT EXISTS (
    SELECT 1 FROM analytics_runs
    WHERE dataset_id = $1
      AND origin = 'RETROSPECTIVE_RECONSTRUCTION'
      AND status = 'FROZEN'
      AND frozen_at IS NOT NULL
  ) AS frozen
`;
const CLEAR_RUN = `
  WITH deleted_views AS (
    DELETE FROM analytics_location_detail_views WHERE dataset_id = $1 RETURNING 1
  )
  DELETE FROM analytics_runs WHERE dataset_id = $1
`;
const REPLACE_RUN = `
  WITH deleted_views AS (
    DELETE FROM analytics_location_detail_views WHERE dataset_id = $1 RETURNING 1
  ), saved_run AS (
    INSERT INTO analytics_runs (
      dataset_id, label, period_starts_on, period_ends_on, reference_time, origin, status
    ) VALUES ($1, $2, $3::date, $4::date, $5::timestamptz,
      'RETROSPECTIVE_RECONSTRUCTION', 'DRAFT')
    ON CONFLICT (dataset_id) DO UPDATE SET
      label = EXCLUDED.label,
      period_starts_on = EXCLUDED.period_starts_on,
      period_ends_on = EXCLUDED.period_ends_on,
      reference_time = EXCLUDED.reference_time,
      origin = EXCLUDED.origin,
      status = 'DRAFT',
      frozen_at = NULL
    RETURNING dataset_id
  ), input_views AS (
    SELECT * FROM jsonb_to_recordset($6::jsonb) AS input_view(
      event_id uuid,
      metric_date date,
      viewed_at timestamptz,
      location_id text,
      notice_state text,
      matched_notice_id text,
      status_source text
    )
  ), inserted_views AS (
    INSERT INTO analytics_location_detail_views (
      event_id, dataset_id, metric_date, viewed_at, location_id,
      notice_state, matched_notice_id, status_source, origin
    )
    SELECT event_id, $1, metric_date, viewed_at, location_id,
      notice_state, matched_notice_id, status_source, 'RETROSPECTIVE_RECONSTRUCTION'
    FROM input_views
    CROSS JOIN saved_run
    RETURNING 1
  )
  UPDATE analytics_runs SET status = 'FROZEN', frozen_at = now()
  WHERE dataset_id = $1
    AND (SELECT COUNT(*) FROM inserted_views) = jsonb_array_length($6::jsonb)
`;

export function createLocationDetailViewRepository(
  connectionString = readAnalyticsDatabaseUrl(),
): LocationDetailViewRepository {
  if (!connectionString) return createDisabledRepository();
  return createLocationDetailViewRepositoryWithExecutor(createExecutor(connectionString));
}

export function createLocationDetailViewRepositoryWithExecutor(
  executor: LocationDetailViewSqlExecutor,
): LocationDetailViewRepository {
  return {
    clearHistoricalRun: (datasetId) => clearHistoricalRun(executor, datasetId),
    initialize: () => initialize(executor),
    isEnabled: () => true,
    isFrozenRun: (datasetId) => isFrozenRun(executor, datasetId),
    readBreakdown: (datasetId, range) => readBreakdown(executor, datasetId, range),
    readSummary: (datasetId, range) => readSummary(executor, datasetId, range),
    record: (event) => record(executor, event),
    replaceHistoricalRun: (run, events) => replaceHistoricalRun(executor, run, events),
  };
}

function createExecutor(connectionString: string): LocationDetailViewSqlExecutor {
  const sql = neon(connectionString);
  return { execute: (statement, parameters) => sql.query(statement, [...parameters]) };
}

function createDisabledRepository(): LocationDetailViewRepository {
  return {
    clearHistoricalRun: rejectConfiguration,
    initialize: rejectConfiguration,
    isEnabled: () => false,
    isFrozenRun: async () => false,
    readBreakdown: async () => [],
    readSummary: async () => createLocationDetailViewSummary(0, 0),
    record: rejectConfiguration,
    replaceHistoricalRun: rejectConfiguration,
  };
}

function rejectConfiguration(): Promise<never> {
  return Promise.reject(new Error("분석 데이터베이스 연결 문자열이 설정되지 않았습니다."));
}

async function initialize(executor: LocationDetailViewSqlExecutor) {
  for (const statement of LOCATION_DETAIL_VIEW_SCHEMA_STATEMENTS)
    await executor.execute(statement, []);
}

async function record(executor: LocationDetailViewSqlExecutor, event: LocationDetailViewEvent) {
  await executor.execute(INSERT_VIEW, createEventParameters(event));
}

function createEventParameters(event: LocationDetailViewEvent) {
  return [
    event.eventId,
    event.datasetId,
    event.metricDate,
    event.viewedAt,
    event.locationId,
    event.noticeState,
    event.matchedNoticeId,
    event.statusSource,
    event.origin,
  ];
}

async function readSummary(
  executor: LocationDetailViewSqlExecutor,
  datasetId: string,
  range: AnalyticsDateRange,
) {
  const rows = await executor.execute(READ_SUMMARY, [datasetId, range.from, range.to]);
  const row = rows.at(0);
  if (!isRecord(row)) return createLocationDetailViewSummary(0, 0);
  return createLocationDetailViewSummary(readCount(row.open_total), readCount(row.no_open_total));
}

async function readBreakdown(
  executor: LocationDetailViewSqlExecutor,
  datasetId: string,
  range: AnalyticsDateRange,
) {
  const rows = await executor.execute(READ_BREAKDOWN, [datasetId, range.from, range.to]);
  return rows.flatMap(readBreakdownRow);
}

async function isFrozenRun(executor: LocationDetailViewSqlExecutor, datasetId: string) {
  const rows = await executor.execute(READ_FROZEN_RUN, [datasetId]);
  const row = rows.at(0);
  if (!isRecord(row)) return false;
  return row.frozen === true;
}

function readBreakdownRow(value: unknown): LocationDetailBreakdown[] {
  if (!isRecord(value) || typeof value.location_id !== "string") return [];
  return [
    {
      locationId: value.location_id,
      noOpenCount: readCount(value.no_open_total),
      openCount: readCount(value.open_total),
      total: readCount(value.total),
    },
  ];
}

async function clearHistoricalRun(executor: LocationDetailViewSqlExecutor, datasetId: string) {
  await executor.execute(CLEAR_RUN, [datasetId]);
}

async function replaceHistoricalRun(
  executor: LocationDetailViewSqlExecutor,
  run: HistoricalAnalyticsRun,
  events: readonly LocationDetailViewEvent[],
) {
  await executor.execute(REPLACE_RUN, createRunParameters(run, events));
}

function createRunParameters(
  run: HistoricalAnalyticsRun,
  events: readonly LocationDetailViewEvent[],
) {
  return [
    run.datasetId,
    run.label,
    run.periodStartsOn,
    run.periodEndsOn,
    run.referenceTime,
    JSON.stringify(events.map(createSeedRow)),
  ];
}

function createSeedRow(event: LocationDetailViewEvent) {
  return {
    event_id: event.eventId,
    location_id: event.locationId,
    matched_notice_id: event.matchedNoticeId,
    metric_date: event.metricDate,
    notice_state: event.noticeState,
    status_source: event.statusSource,
    viewed_at: event.viewedAt,
  };
}

function readCount(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/u.test(value)) return 0;
  return Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
