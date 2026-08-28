import { expect, test } from "vitest";

import {
  createRecruitmentAlertRepository,
  createRecruitmentAlertRepositoryWithExecutor,
  RecruitmentAlertDatabaseConfigurationError,
  type RecruitmentAlertSqlExecutor,
} from "./recruitment-alert-repository";
import type { RecruitmentAlertSubscription } from "./recruitment-alert-types";
import { RECRUITMENT_ALERT_SCHEMA_STATEMENTS } from "./recruitment-alert-schema";

test("이메일과 서버가 확인한 단지 스냅샷을 저장한다", async () => {
  const calls: unknown[][] = [];
  const repository = createRecruitmentAlertRepositoryWithExecutor(createExecutor(calls));

  await repository.append(createSubscription());

  expect(calls).toHaveLength(1);
  expect(calls[0]?.[0]).toContain("INSERT INTO public_rental_notice_email_subscriptions");
  expect(calls[0]?.[0]).toContain("ON CONFLICT (location_id, email_normalized)");
  expect(calls[0]?.[0]).toContain("WHERE notified_at IS NULL");
  expect(calls[0]?.[1]).toEqual(createParameters());
});

test("만료된 활성 신청은 새 동의와 만료 시각으로 원자적으로 갱신한다", async () => {
  const calls: unknown[][] = [];
  const repository = createRecruitmentAlertRepositoryWithExecutor(createExecutor(calls));

  await repository.append(createSubscription());

  expect(calls[0]?.[0]).toContain("DO UPDATE SET");
  expect(calls[0]?.[0]).toContain("expires_at <= EXCLUDED.consented_at");
});

test("DB 연결이 없으면 이메일을 임시 저장한 것처럼 응답하지 않는다", async () => {
  const repository = createRecruitmentAlertRepository("");

  expect(repository.isEnabled()).toBe(false);
  await expect(repository.append(createSubscription())).rejects.toBeInstanceOf(
    RecruitmentAlertDatabaseConfigurationError,
  );
});

test("재실행 가능한 스키마를 초기화한다", async () => {
  const calls: unknown[][] = [];
  const repository = createRecruitmentAlertRepositoryWithExecutor(createExecutor(calls));

  await repository.initialize();

  expect(calls).toHaveLength(RECRUITMENT_ALERT_SCHEMA_STATEMENTS.length);
  expect(calls.every((call) => String(call[0]).includes("IF NOT EXISTS"))).toBe(true);
});

test("가설 관측 행은 유지하고 보관 기간이 끝난 행만 정리한다", async () => {
  const calls: unknown[][] = [];
  const repository = createRecruitmentAlertRepositoryWithExecutor(createExecutor(calls));

  await repository.purge("2026-08-28T00:00:00.000Z");

  expect(calls[0]?.[0]).toContain("expires_at <= $1::timestamptz");
  expect(calls[0]?.[0]).not.toContain("notified_at IS NOT NULL");
  expect(calls[0]?.[1]).toEqual(["2026-08-28T00:00:00.000Z"]);
});

function createExecutor(calls: unknown[][]): RecruitmentAlertSqlExecutor {
  return {
    execute: async (statement, parameters) => {
      calls.push([statement, parameters]);
      return [];
    },
  };
}

function createSubscription(): RecruitmentAlertSubscription {
  return {
    consentVersion: "recruitment-alert-v1",
    consentedAt: "2026-08-28T00:00:00.000Z",
    email: "User@example.com",
    emailNormalized: "user@example.com",
    expiresAt: "2027-08-28T00:00:00.000Z",
    locationId: "31297390",
    locationNameSnapshot: "미사13단지",
  };
}

function createParameters() {
  const subscription = createSubscription();
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
