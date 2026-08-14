import { expect, test } from "vitest";

import type { ExperimentEventKind, ExperimentVariant } from "./experiment-event";
import { createExperimentDashboard } from "./experiment-dashboard";

test("고유한 자격 방문자를 분모로 상세 조회와 북마크 전환율을 계산한다", () => {
  const dashboard = createExperimentDashboard([
    fact("EXPERIMENT_ELIGIBLE", "visitor-a", "all"),
    fact("EXPERIMENT_ELIGIBLE", "visitor-a", "all", "2026-08-02"),
    fact("EXPERIMENT_ELIGIBLE", "visitor-b", "all"),
    fact("NO_OPEN_NOTICE_LOCATION_VIEWED", "visitor-a", "location-a"),
    fact("NO_OPEN_NOTICE_LOCATION_VIEWED", "visitor-c", "location-a"),
    fact("BOOKMARK_ADDED", "visitor-a", "location-a"),
    fact("BOOKMARK_ADDED", "visitor-a", "location-a", "2026-08-02"),
    fact("BOOKMARK_ADDED", "visitor-b", "location-b"),
  ]);

  expect(dashboard).toMatchObject({
    bookmarkRate: 100,
    bookmarkVisitorCount: 2,
    detailToBookmarkRate: 100,
    eligibleVisitorCount: 2,
    noOpenDetailRate: 50,
    noOpenDetailVisitorCount: 1,
  });
});

test("위치별 북마크 순위도 고유한 자격 방문자 수로 집계한다", () => {
  const dashboard = createExperimentDashboard([
    ...facts("EXPERIMENT_ELIGIBLE", 3, "all"),
    fact("BOOKMARK_ADDED", "visitor-0", "location-b"),
    fact("BOOKMARK_ADDED", "visitor-0", "location-b", "2026-08-02"),
    fact("BOOKMARK_ADDED", "visitor-1", "location-b"),
    fact("BOOKMARK_ADDED", "visitor-2", "location-a"),
  ]);

  expect(dashboard.bookmarkRanks).toEqual([
    { subjectId: "location-b", total: 2 },
    { subjectId: "location-a", total: 1 },
  ]);
});

test("선택한 실험군의 방문자 행동만 집계한다", () => {
  const dashboard = createExperimentDashboard(
    [
      factWithVariant("EXPERIMENT_ELIGIBLE", "visitor-a", "all", "ALL_HOMES"),
      factWithVariant("BOOKMARK_ADDED", "visitor-a", "location-a", "ALL_HOMES"),
      factWithVariant("EXPERIMENT_ELIGIBLE", "visitor-b", "all", "OPEN_NOTICES_ONLY"),
    ],
    "ALL_HOMES",
  );

  expect(dashboard.eligibleVisitorCount).toBe(1);
  expect(dashboard.bookmarkVisitorCount).toBe(1);
});

test("고유 북마크 사용자와 반복을 포함한 등록 이벤트 수를 분리한다", () => {
  const dashboard = createExperimentDashboard(
    [
      factWithVariant("EXPERIMENT_ELIGIBLE", "visitor-a", "all", "ALL_HOMES"),
      factWithVariant("BOOKMARK_ADDED", "visitor-a", "location-a", "ALL_HOMES"),
    ],
    "ALL_HOMES",
    3,
  );

  expect(dashboard.bookmarkVisitorCount).toBe(1);
  expect(dashboard.bookmarkAddCount).toBe(3);
});

test("최소 표본 전에는 관측률과 무관하게 판정을 보류한다", () => {
  const dashboard = createExperimentDashboard([
    ...facts("EXPERIMENT_ELIGIBLE", 100, "all"),
    ...facts("BOOKMARK_ADDED", 20, "location-a"),
  ]);

  expect(dashboard.decision).toMatchObject({
    minimumSampleSize: 253,
    observedRate: 20,
    sampleSize: 100,
    status: "INSUFFICIENT_SAMPLE",
    targetRate: 10,
  });
});

test("충분한 표본에서 관측 북마크율 10퍼센트 이상을 성공으로 판정한다", () => {
  const dashboard = createExperimentDashboard([
    ...facts("EXPERIMENT_ELIGIBLE", 300, "all"),
    ...facts("BOOKMARK_ADDED", 30, "location-a"),
  ]);

  expect(dashboard.decision.status).toBe("SUCCESS");
  expect(dashboard.decision.observedRate).toBe(10);
  expect(dashboard.decision.confidenceLowerBound).toBeCloseTo(7.5, 1);
});

test("충분한 표본에서 관측 북마크율 10퍼센트 미만을 목표 미달로 판정한다", () => {
  const dashboard = createExperimentDashboard([
    ...facts("EXPERIMENT_ELIGIBLE", 253, "all"),
    ...facts("BOOKMARK_ADDED", 25, "location-a"),
  ]);

  expect(dashboard.decision.status).toBe("BELOW_TARGET");
  expect(dashboard.decision.observedRate).toBeCloseTo(25 / 2.53);
});

function facts(eventKind: ExperimentEventKind, count: number, subjectId: string) {
  return Array.from({ length: count }, (_, index) =>
    fact(eventKind, `visitor-${index}`, subjectId),
  );
}

function fact(
  eventKind: ExperimentEventKind,
  visitorHash: string,
  subjectId: string,
  metricDate = "2026-08-01",
) {
  return { eventKind, metricDate, subjectId, visitorHash };
}

function factWithVariant(
  eventKind: ExperimentEventKind,
  visitorHash: string,
  subjectId: string,
  variant: ExperimentVariant,
) {
  return { ...fact(eventKind, visitorHash, subjectId), variant };
}
