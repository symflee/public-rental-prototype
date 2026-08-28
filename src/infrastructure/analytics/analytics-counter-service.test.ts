import { beforeEach, expect, test, vi } from "vitest";

const repository = vi.hoisted(() => ({
  increment: vi.fn(async () => undefined),
  initialize: vi.fn(async () => undefined),
  isEnabled: vi.fn(() => true),
  purgeBefore: vi.fn(async () => undefined),
  read: vi.fn(async () => []),
}));
const detailViews = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
  readSummary: vi.fn(async () => ({
    noOpenNoticeLocationDetailViewCount: 52,
    openNoticeLocationDetailViewCount: 80,
  })),
}));

vi.mock("./analytics-counter-repository", () => ({
  createAnalyticsCounterRepository: () => repository,
}));
vi.mock("./experiment-event-service", () => ({
  initializeExperimentAnalyticsStorage: vi.fn(async () => undefined),
}));
vi.mock("./location-detail-view-service", () => ({
  initializeLocationDetailViewStorage: detailViews.initialize,
  readLocationDetailViewSummary: detailViews.readSummary,
}));
vi.mock("@/infrastructure/manual-recruitment", () => ({
  initializeManualRecruitmentStorage: vi.fn(async () => undefined),
}));

import { readAnalyticsDashboard } from "./analytics-counter-service";

beforeEach(() => vi.clearAllMocks());

test("선택한 데이터셋의 개별 상세 조회를 대시보드에 사용한다", async () => {
  const range = { from: "2026-08-11", to: "2026-08-14" };
  const dashboard = await readAnalyticsDashboard(range, "historical-2026-08-11-14-v1");

  expect(detailViews.readSummary).toHaveBeenCalledWith("historical-2026-08-11-14-v1", range);
  expect(dashboard.locationDetailViewCount).toBe(132);
  expect(dashboard.noOpenNoticeLocationDetailViewCount).toBe(52);
});

test("새 상세 조회 테이블 장애를 구형 카운터로 숨기지 않는다", async () => {
  detailViews.readSummary.mockRejectedValueOnce(new Error("missing table"));

  await expect(readAnalyticsDashboard({ from: "2026-08-11", to: "2026-08-14" })).rejects.toThrow(
    "missing table",
  );
});
