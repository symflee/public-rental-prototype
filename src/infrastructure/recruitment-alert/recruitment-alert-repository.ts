import { neon } from "@neondatabase/serverless";

import { readAnalyticsDatabaseUrl } from "@/infrastructure/analytics/analytics-counter-repository";

import { RECRUITMENT_ALERT_SCHEMA_STATEMENTS } from "./recruitment-alert-schema";
import type { RecruitmentAlertSubscription } from "./recruitment-alert-types";

type RecruitmentAlertSqlValue = string;

export type RecruitmentAlertSqlExecutor = Readonly<{
  execute: (
    statement: string,
    parameters: readonly RecruitmentAlertSqlValue[],
  ) => Promise<readonly unknown[]>;
}>;

export type RecruitmentAlertRepository = Readonly<{
  append: (subscription: RecruitmentAlertSubscription) => Promise<void>;
  initialize: () => Promise<void>;
  isEnabled: () => boolean;
  purge: (referenceTime: string) => Promise<void>;
}>;

export class RecruitmentAlertDatabaseConfigurationError extends Error {
  constructor() {
    super("모집공고 알림 데이터베이스 연결 문자열이 설정되지 않았습니다.");
  }
}

const APPEND_SUBSCRIPTION = `
  INSERT INTO public_rental_notice_email_subscriptions (
    location_id, location_name_snapshot, email, email_normalized,
    consent_version, consented_at, expires_at
  )
  VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
  ON CONFLICT (location_id, email_normalized) WHERE notified_at IS NULL
  DO UPDATE SET
    location_name_snapshot = EXCLUDED.location_name_snapshot,
    email = EXCLUDED.email,
    consent_version = EXCLUDED.consent_version,
    consented_at = EXCLUDED.consented_at,
    created_at = EXCLUDED.consented_at,
    expires_at = EXCLUDED.expires_at
  WHERE public_rental_notice_email_subscriptions.expires_at <= EXCLUDED.consented_at
`;
const PURGE_SUBSCRIPTIONS = `
  DELETE FROM public_rental_notice_email_subscriptions
  WHERE expires_at <= $1::timestamptz
`;

export function createRecruitmentAlertRepository(
  connectionString = readAnalyticsDatabaseUrl(),
): RecruitmentAlertRepository {
  if (!connectionString) return createDisabledRepository();
  return createRecruitmentAlertRepositoryWithExecutor(createNeonExecutor(connectionString));
}

export function createRecruitmentAlertRepositoryWithExecutor(
  executor: RecruitmentAlertSqlExecutor,
): RecruitmentAlertRepository {
  return {
    append: (subscription) => appendSubscription(executor, subscription),
    initialize: () => initializeSchema(executor),
    isEnabled: () => true,
    purge: (referenceTime) => purgeSubscriptions(executor, referenceTime),
  };
}

function createNeonExecutor(connectionString: string): RecruitmentAlertSqlExecutor {
  const sql = neon(connectionString);
  return { execute: (statement, parameters) => sql.query(statement, [...parameters]) };
}

function createDisabledRepository(): RecruitmentAlertRepository {
  return {
    append: rejectConfiguration,
    initialize: rejectConfiguration,
    isEnabled: () => false,
    purge: rejectConfiguration,
  };
}

function rejectConfiguration() {
  return Promise.reject(new RecruitmentAlertDatabaseConfigurationError());
}

async function appendSubscription(
  executor: RecruitmentAlertSqlExecutor,
  subscription: RecruitmentAlertSubscription,
) {
  await executor.execute(APPEND_SUBSCRIPTION, createParameters(subscription));
}

async function initializeSchema(executor: RecruitmentAlertSqlExecutor) {
  for (const statement of RECRUITMENT_ALERT_SCHEMA_STATEMENTS) {
    await executor.execute(statement, []);
  }
}

async function purgeSubscriptions(executor: RecruitmentAlertSqlExecutor, referenceTime: string) {
  await executor.execute(PURGE_SUBSCRIPTIONS, [referenceTime]);
}

function createParameters(subscription: RecruitmentAlertSubscription) {
  return [
    subscription.locationId,
    subscription.locationNameSnapshot,
    subscription.email,
    subscription.emailNormalized,
    subscription.consentVersion,
    subscription.consentedAt,
    subscription.expiresAt,
  ];
}
