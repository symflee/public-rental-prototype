import { neon } from "@neondatabase/serverless";

import type { PublicRentalRecruitmentNoticeSourceKind } from "@/domain/public-rental";
import { readAnalyticsDatabaseUrl } from "@/infrastructure/analytics/analytics-counter-repository";

import { MANUAL_RECRUITMENT_SCHEMA_STATEMENTS } from "./manual-recruitment-schema";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

type ManualRecruitmentSqlValue = string;

export type ManualRecruitmentSqlExecutor = Readonly<{
  execute: (
    statement: string,
    parameters: readonly ManualRecruitmentSqlValue[],
  ) => Promise<readonly unknown[]>;
}>;

export type ManualRecruitmentRepository = Readonly<{
  append: (notice: ManualRecruitmentNoticeInput) => Promise<boolean>;
  initialize: () => Promise<void>;
  isEnabled: () => boolean;
  readActive: () => Promise<readonly ManualRecruitmentNoticeInput[]>;
  replaceHistorical: (notice: ManualRecruitmentNoticeInput) => Promise<void>;
  revoke: (noticeId: string) => Promise<boolean>;
}>;

export class ManualRecruitmentDatabaseConfigurationError extends Error {
  constructor() {
    super("수기 모집공고 데이터베이스 연결 문자열이 설정되지 않았습니다.");
  }
}

const APPEND_NOTICE = `
  WITH inserted_notice AS (
    INSERT INTO public_rental_manual_recruitment_notices (
      notice_id, title, url, announced_at, application_starts_at,
      application_ends_at, source_kind, evidence_url
    )
    VALUES ($1, $2, $3, $4::date, $5::timestamptz, $6::timestamptz, $7, $8)
    ON CONFLICT (notice_id) DO NOTHING
    RETURNING notice_id
  ), inserted_locations AS (
    INSERT INTO public_rental_manual_recruitment_locations (notice_id, location_id)
    SELECT inserted_notice.notice_id, locations.location_id
    FROM inserted_notice
    CROSS JOIN jsonb_array_elements_text($9::jsonb) AS locations(location_id)
    RETURNING location_id
  )
  SELECT EXISTS (SELECT 1 FROM inserted_notice) AS inserted
`;

const READ_ACTIVE_NOTICES = `
  SELECT notices.notice_id, notices.title, notices.url, notices.announced_at,
    notices.application_starts_at, notices.application_ends_at,
    notices.source_kind, notices.evidence_url,
    json_agg(locations.location_id ORDER BY locations.location_id) AS location_ids
  FROM public_rental_manual_recruitment_notices AS notices
  INNER JOIN public_rental_manual_recruitment_locations AS locations
    ON locations.notice_id = notices.notice_id
  WHERE notices.revoked_at IS NULL
  GROUP BY notices.notice_id
  ORDER BY notices.application_starts_at ASC, notices.notice_id ASC
`;

const REPLACE_HISTORICAL_NOTICE = `
  WITH saved_notice AS (
    INSERT INTO public_rental_manual_recruitment_notices (
      notice_id, title, url, announced_at, application_starts_at,
      application_ends_at, source_kind, evidence_url, revoked_at
    )
    VALUES ($1, $2, $3, $4::date, $5::timestamptz, $6::timestamptz, $7, $8, NULL)
    ON CONFLICT (notice_id) DO UPDATE SET
      title = EXCLUDED.title,
      url = EXCLUDED.url,
      announced_at = EXCLUDED.announced_at,
      application_starts_at = EXCLUDED.application_starts_at,
      application_ends_at = EXCLUDED.application_ends_at,
      source_kind = EXCLUDED.source_kind,
      evidence_url = EXCLUDED.evidence_url,
      revoked_at = NULL
    RETURNING notice_id
  ), input_locations AS (
    SELECT location_id
    FROM jsonb_array_elements_text($9::jsonb) AS locations(location_id)
  ), saved_locations AS (
    INSERT INTO public_rental_manual_recruitment_locations (notice_id, location_id)
    SELECT saved_notice.notice_id, input_locations.location_id
    FROM saved_notice CROSS JOIN input_locations
    ON CONFLICT (notice_id, location_id) DO NOTHING
    RETURNING location_id
  )
  DELETE FROM public_rental_manual_recruitment_locations
  WHERE notice_id = $1
    AND location_id NOT IN (SELECT location_id FROM input_locations)
    AND EXISTS (SELECT 1 FROM saved_notice)
`;

const REVOKE_NOTICE = `
  UPDATE public_rental_manual_recruitment_notices
  SET revoked_at = now()
  WHERE notice_id = $1 AND revoked_at IS NULL
  RETURNING notice_id
`;

export function createManualRecruitmentRepository(
  connectionString = readAnalyticsDatabaseUrl(),
): ManualRecruitmentRepository {
  if (!connectionString) return createDisabledRepository();
  return createManualRecruitmentRepositoryWithExecutor(createNeonExecutor(connectionString));
}

export function createManualRecruitmentRepositoryWithExecutor(
  executor: ManualRecruitmentSqlExecutor,
): ManualRecruitmentRepository {
  return {
    append: (notice) => appendNotice(executor, notice),
    initialize: () => initializeSchema(executor),
    isEnabled: () => true,
    readActive: () => readActiveNotices(executor),
    replaceHistorical: (notice) => replaceHistoricalNotice(executor, notice),
    revoke: (noticeId) => revokeNotice(executor, noticeId),
  };
}

function createNeonExecutor(connectionString: string): ManualRecruitmentSqlExecutor {
  const sql = neon(connectionString);
  return { execute: (statement, parameters) => sql.query(statement, [...parameters]) };
}

function createDisabledRepository(): ManualRecruitmentRepository {
  return {
    append: rejectDatabaseConfiguration,
    initialize: rejectDatabaseConfiguration,
    isEnabled: () => false,
    readActive: rejectDatabaseConfiguration,
    replaceHistorical: rejectDatabaseConfiguration,
    revoke: rejectDatabaseConfiguration,
  };
}

function rejectDatabaseConfiguration() {
  return Promise.reject(new ManualRecruitmentDatabaseConfigurationError());
}

async function initializeSchema(executor: ManualRecruitmentSqlExecutor) {
  for (const statement of MANUAL_RECRUITMENT_SCHEMA_STATEMENTS) {
    await executor.execute(statement, []);
  }
}

async function appendNotice(
  executor: ManualRecruitmentSqlExecutor,
  notice: ManualRecruitmentNoticeInput,
) {
  const rows = await executor.execute(APPEND_NOTICE, createNoticeParameters(notice));
  return readBoolean(rows[0], "inserted");
}

function createNoticeParameters(notice: ManualRecruitmentNoticeInput) {
  return [
    notice.id,
    notice.title,
    notice.url,
    notice.announcedAt,
    notice.applicationStartsAt,
    notice.applicationEndsAt,
    notice.sourceKind,
    notice.evidenceUrl,
    JSON.stringify(notice.locationIds),
  ];
}

async function readActiveNotices(executor: ManualRecruitmentSqlExecutor) {
  const rows = await executor.execute(READ_ACTIVE_NOTICES, []);
  return rows.flatMap(readNotice);
}

async function revokeNotice(executor: ManualRecruitmentSqlExecutor, noticeId: string) {
  const rows = await executor.execute(REVOKE_NOTICE, [noticeId]);
  return rows.length > 0;
}

async function replaceHistoricalNotice(
  executor: ManualRecruitmentSqlExecutor,
  notice: ManualRecruitmentNoticeInput,
) {
  await executor.execute(REPLACE_HISTORICAL_NOTICE, createNoticeParameters(notice));
}

function readNotice(value: unknown): ManualRecruitmentNoticeInput[] {
  if (!isRecord(value)) return [];
  const notice = createNotice(value);
  if (!notice) return [];
  return [notice];
}

function createNotice(value: Record<string, unknown>) {
  const text = readNoticeTextFields(value);
  const dates = readNoticeDateFields(value);
  const locationIds = readLocationIds(value.location_ids);
  if (!text || !dates || !locationIds) return undefined;
  if (!isSourceKind(value.source_kind)) return undefined;
  return { ...text, ...dates, locationIds, sourceKind: value.source_kind };
}

function readNoticeTextFields(value: Record<string, unknown>) {
  const id = readText(value.notice_id);
  const title = readText(value.title);
  const url = readText(value.url);
  const evidenceUrl = readText(value.evidence_url);
  if (!id || !title || !url || !evidenceUrl) return undefined;
  return { evidenceUrl, id, title, url };
}

function readNoticeDateFields(value: Record<string, unknown>) {
  const announcedAt = readDate(value.announced_at);
  const applicationStartsAt = readTimestamp(value.application_starts_at);
  const applicationEndsAt = readTimestamp(value.application_ends_at);
  if (!announcedAt || !applicationStartsAt || !applicationEndsAt) return undefined;
  return { announcedAt, applicationEndsAt, applicationStartsAt };
}

function readText(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return value;
}

function readDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) return undefined;
  return value.toISOString().slice(0, 10);
}

function readTimestamp(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  if (typeof value !== "string") return undefined;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) return undefined;
  return timestamp.toISOString();
}

function readLocationIds(value: unknown) {
  if (!Array.isArray(value) || !value.every(isText)) return undefined;
  return value;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSourceKind(value: unknown): value is PublicRentalRecruitmentNoticeSourceKind {
  if (value === "AUTOMATED_IMPORT") return true;
  return value === "MANUAL_REVIEW";
}

function readBoolean(value: unknown, field: string) {
  if (!isRecord(value)) return false;
  return value[field] === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
