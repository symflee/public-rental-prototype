import { expect, test } from "vitest";

import { createPageViewCounter } from "@/domain/announcement-analytics";

import {
  AnalyticsDatabaseConfigurationError,
  createAnalyticsCounterRepository,
  createAnalyticsCounterRepositoryWithExecutor,
  type AnalyticsDashboardDemoDays,
  type AnalyticsSqlExecutor,
} from "./analytics-counter-repository";
import { ANALYTICS_SCHEMA_STATEMENTS } from "./analytics-schema";

test("일별 카운터를 원자적으로 증가시킨다", async () => {
  const calls: unknown[][] = [];
  const repository = createAnalyticsCounterRepositoryWithExecutor(createExecutor(calls));

  await repository.increment(createPageViewCounter("2026-07-29"));

  expect(calls[0]?.[1]).toEqual(["2026-07-29", "PAGE_VIEW", "SITE", "all"]);
  expect(calls[0]?.[0]).toContain("ON CONFLICT");
});

test("분석 저장소는 방문자 식별자 없이 일별 카운터 테이블만 만든다", async () => {
  const calls: unknown[][] = [];
  const repository = createAnalyticsCounterRepositoryWithExecutor(createExecutor(calls));

  await repository.initialize();

  expect(calls).toHaveLength(ANALYTICS_SCHEMA_STATEMENTS.length);
  expect(ANALYTICS_SCHEMA_STATEMENTS.join(" ")).not.toMatch(
    /visitor|cookie|ip[_ ]?address|user[_ ]?agent|fingerprint|session/iu,
  );
});

test("연결 문자열이 없으면 공개 기능을 막지 않는 비활성 저장소를 만든다", async () => {
  const repository = createAnalyticsCounterRepository("");

  await expect(repository.increment(createPageViewCounter("2026-07-29"))).resolves.toBeUndefined();
  expect(repository.isEnabled()).toBe(false);
});

test("Neon이 Date 객체로 반환한 일별 카운터도 읽는다", async () => {
  const executor = createCounterExecutor();
  const repository = createAnalyticsCounterRepositoryWithExecutor(executor);

  const counters = await repository.read({ from: "2026-07-01", to: "2026-07-31" });

  expect(counters).toEqual([
    {
      eventKind: "PAGE_VIEW",
      metricDate: "2026-07-29",
      subjectId: "all",
      subjectKind: "SITE",
      total: 3,
    },
  ]);
});

test("대시보드 데모 카운터를 정확한 범위에서 지우고 8행으로 원자 교체한다", async () => {
  const calls: unknown[][] = [];
  const repository = createAnalyticsCounterRepositoryWithExecutor(createExecutor(calls));

  await repository.replaceAnalyticsDashboardDemo(createDemoDays());

  expect(calls).toHaveLength(1);
  expectDemoReplacement(calls[0]);
});

test("대시보드 데모 카운터만 정확한 조건으로 정리한다", async () => {
  const calls: unknown[][] = [];
  const repository = createAnalyticsCounterRepositoryWithExecutor(createExecutor(calls));

  await repository.clearAnalyticsDashboardDemo();

  expect(calls).toHaveLength(1);
  expectDemoDelete(calls[0]?.[0]);
  expect(calls[0]?.[1]).toEqual([]);
});

test("DB가 없으면 대시보드 데모 작업을 명확히 거부한다", async () => {
  const repository = createAnalyticsCounterRepository("");

  await expect(repository.replaceAnalyticsDashboardDemo(createDemoDays())).rejects.toBeInstanceOf(
    AnalyticsDatabaseConfigurationError,
  );
  await expect(repository.clearAnalyticsDashboardDemo()).rejects.toBeInstanceOf(
    AnalyticsDatabaseConfigurationError,
  );
});

function createExecutor(calls: unknown[][]): AnalyticsSqlExecutor {
  return {
    execute: async (statement, parameters) => {
      calls.push([statement, parameters]);
      return [];
    },
  };
}

function createCounterExecutor(): AnalyticsSqlExecutor {
  return {
    execute: async () => [createDatabaseCounter()],
  };
}

function createDatabaseCounter() {
  return {
    event_kind: "PAGE_VIEW",
    metric_date: new Date(2026, 6, 29),
    subject_id: "all",
    subject_kind: "SITE",
    total: "3",
  };
}

function createDemoDays(): AnalyticsDashboardDemoDays {
  return [
    createDemoDay("2026-08-11", 22, 10),
    createDemoDay("2026-08-12", 24, 12),
    createDemoDay("2026-08-13", 21, 14),
    createDemoDay("2026-08-14", 13, 16),
  ];
}

function createDemoDay(metricDate: string, openTotal: number, noOpenTotal: number) {
  return {
    metricDate,
    noOpenNoticeLocationDetailViewTotal: noOpenTotal,
    openNoticeLocationDetailViewTotal: openTotal,
  };
}

function expectDemoReplacement(call: unknown[] | undefined) {
  const statement = call?.[0];
  expectDemoDelete(statement);
  expect(statement).toContain("INSERT INTO analytics_daily_counters");
  expect(statement).toContain("OPEN_NOTICE_LOCATION_DETAIL_VIEW");
  expect(statement).toContain("NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW");
  expect(String(statement).match(/::bigint\)/gu)).toHaveLength(8);
  expect(call?.[1]).toEqual(createDemoParameters());
}

function expectDemoDelete(statement: unknown) {
  expect(statement).toContain("subject_kind = 'SITE'");
  expect(statement).toContain("subject_id = 'dashboard-demo-v1'");
  expect(statement).toContain("'OPEN_NOTICE_LOCATION_DETAIL_VIEW'");
  expect(statement).toContain("'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'");
  expect(statement).not.toContain("subject_id = 'all'");
}

function createDemoParameters() {
  return ["2026-08-11", 22, 10, "2026-08-12", 24, 12, "2026-08-13", 21, 14, "2026-08-14", 13, 16];
}
