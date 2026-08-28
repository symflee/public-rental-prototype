import { beforeEach, expect, test, vi } from "vitest";

const repository = vi.hoisted(() => ({
  clearAnalyticsDashboardDemo: vi.fn(async () => undefined),
  replaceAnalyticsDashboardDemo: vi.fn(async () => undefined),
}));

vi.mock("./analytics-counter-repository", () => ({
  createAnalyticsCounterRepository: () => repository,
}));

import { clearAnalyticsDashboardDemo, seedAnalyticsDashboardDemo } from "./analytics-demo-service";

beforeEach(() => {
  vi.clearAllMocks();
});

test("8월 11~14일의 132건 데모 카운터를 저장한다", async () => {
  await seedAnalyticsDashboardDemo();

  expect(repository.replaceAnalyticsDashboardDemo).toHaveBeenCalledWith([
    createDemoDay("2026-08-11", 22, 10),
    createDemoDay("2026-08-12", 24, 12),
    createDemoDay("2026-08-13", 21, 14),
    createDemoDay("2026-08-14", 13, 16),
  ]);
});

test("대시보드 데모 데이터 정리를 저장소에 위임한다", async () => {
  await clearAnalyticsDashboardDemo();

  expect(repository.clearAnalyticsDashboardDemo).toHaveBeenCalledOnce();
});

function createDemoDay(metricDate: string, openTotal: number, noOpenTotal: number) {
  return {
    metricDate,
    noOpenNoticeLocationDetailViewTotal: noOpenTotal,
    openNoticeLocationDetailViewTotal: openTotal,
  };
}
