import { afterEach, beforeEach, expect, test, vi } from "vitest";

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
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-13T15:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

test("KST 기준일을 포함한 최근 4일의 데모 카운터를 저장한다", async () => {
  await seedAnalyticsDashboardDemo();

  expect(repository.replaceAnalyticsDashboardDemo).toHaveBeenCalledWith([
    createDemoDay("2026-08-11", 80, 88),
    createDemoDay("2026-08-12", 85, 94),
    createDemoDay("2026-08-13", 87, 99),
    createDemoDay("2026-08-14", 92, 107),
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
