import { expect, test } from "vitest";

import { createPageViewCounter } from "@/domain/announcement-analytics";

import {
  createAnalyticsCounterRepository,
  createAnalyticsCounterRepositoryWithExecutor,
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

function createExecutor(calls: unknown[][]): AnalyticsSqlExecutor {
  return {
    execute: async (statement, parameters) => {
      calls.push([statement, parameters]);
      return [];
    },
  };
}
