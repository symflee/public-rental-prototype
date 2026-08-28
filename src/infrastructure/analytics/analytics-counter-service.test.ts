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
  readOperationalSummary: vi.fn(async () => ({
    noOpenNoticeLocationDetailViewCount: 52,
    openNoticeLocationDetailViewCount: 80,
  })),
}));
const recruitmentAlerts = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
}));

vi.mock("./analytics-counter-repository", () => ({
  createAnalyticsCounterRepository: () => repository,
}));
vi.mock("./experiment-event-service", () => ({
  initializeExperimentAnalyticsStorage: vi.fn(async () => undefined),
}));
vi.mock("./location-detail-view-service", () => ({
  initializeLocationDetailViewStorage: detailViews.initialize,
  readOperationalLocationDetailViewSummary: detailViews.readOperationalSummary,
}));
vi.mock("@/infrastructure/manual-recruitment", () => ({
  initializeManualRecruitmentStorage: vi.fn(async () => undefined),
}));
vi.mock("@/infrastructure/recruitment-alert", () => ({
  initializeRecruitmentAlertStorage: recruitmentAlerts.initialize,
}));

import { initializeAnalyticsStorage, readAnalyticsDashboard } from "./analytics-counter-service";

beforeEach(() => vi.clearAllMocks());

test("운영 대시보드에 중복 제거된 실시간·재구성 조회를 집계한다", async () => {
  const range = { from: "2026-08-11", to: "2026-08-14" };
  const dashboard = await readAnalyticsDashboard(range);

  expect(detailViews.readOperationalSummary).toHaveBeenCalledWith(range);
  expect(dashboard.locationDetailViewCount).toBe(132);
  expect(dashboard.noOpenNoticeLocationDetailViewCount).toBe(52);
});

test("새 상세 조회 테이블 장애를 구형 카운터로 숨기지 않는다", async () => {
  detailViews.readOperationalSummary.mockRejectedValueOnce(new Error("missing table"));

  await expect(readAnalyticsDashboard({ from: "2026-08-11", to: "2026-08-14" })).rejects.toThrow(
    "missing table",
  );
});

test("서비스 저장 스키마 초기화에 이메일 알림 신청을 포함한다", async () => {
  await initializeAnalyticsStorage();

  expect(recruitmentAlerts.initialize).toHaveBeenCalledOnce();
});
