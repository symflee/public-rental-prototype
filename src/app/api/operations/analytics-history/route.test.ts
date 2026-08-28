import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  clearAnalyticsDashboardDemo: vi.fn(async () => undefined),
  initializeAnalyticsStorage: vi.fn(async () => undefined),
  readLocationDetailViewSummary: vi.fn(),
  seedHistoricalLocationDetailViews: vi.fn(async () => undefined),
  seedHistoricalManualRecruitmentNotices: vi.fn(async () => undefined),
}));

vi.mock("@/infrastructure/analytics", () => ({
  clearAnalyticsDashboardDemo: mocks.clearAnalyticsDashboardDemo,
  initializeAnalyticsStorage: mocks.initializeAnalyticsStorage,
  readLocationDetailViewSummary: mocks.readLocationDetailViewSummary,
  seedHistoricalLocationDetailViews: mocks.seedHistoricalLocationDetailViews,
}));

vi.mock("@/infrastructure/manual-recruitment", () => ({
  seedHistoricalManualRecruitmentNotices: mocks.seedHistoricalManualRecruitmentNotices,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANALYTICS_MIGRATION_TOKEN", "migration-token");
  mocks.readLocationDetailViewSummary.mockResolvedValue({
    noOpenNoticeLocationDetailViewCount: 52,
    openNoticeLocationDetailViewCount: 80,
  });
});

test("인증된 운영 요청이 스키마와 역사 데이터를 원자적으로 준비한다", async () => {
  const response = await POST(createRequest());

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    datasetId: "historical-2026-08-11-14-v1",
    noOpenNoticeLocationDetailViewCount: 52,
    noOpenNoticeLocationDetailViewRate: 39.4,
    openNoticeLocationDetailViewCount: 80,
    totalLocationDetailViewCount: 132,
  });
  expect(mocks.initializeAnalyticsStorage).toHaveBeenCalledOnce();
  expect(mocks.seedHistoricalManualRecruitmentNotices).toHaveBeenCalledOnce();
  expect(mocks.seedHistoricalLocationDetailViews).toHaveBeenCalledOnce();
  expect(mocks.clearAnalyticsDashboardDemo).toHaveBeenCalledOnce();
});

test("토큰 누락과 다른 출처 요청은 운영 DB를 변경하지 않는다", async () => {
  const unauthorized = await POST(new Request(ENDPOINT, { method: "POST" }));
  const crossOrigin = await POST(createRequest("https://malicious.example"));

  expect(unauthorized.status).toBe(401);
  expect(crossOrigin.status).toBe(403);
  expect(mocks.initializeAnalyticsStorage).not.toHaveBeenCalled();
});

test("DB 오류 세부내용을 숨기고 503으로 응답한다", async () => {
  mocks.initializeAnalyticsStorage.mockRejectedValue(new Error("database secret"));

  const response = await POST(createRequest());

  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("database secret");
});

const ENDPOINT = "https://public-rental-prototype.vercel.app/api/operations/analytics-history";

function createRequest(origin?: string) {
  const headers = new Headers({ Authorization: "Bearer migration-token" });
  if (origin) headers.set("Origin", origin);
  return new Request(ENDPOINT, { headers, method: "POST" });
}
