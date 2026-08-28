import {
  createAnalyticsCounterRepository,
  type AnalyticsDashboardDemoDay,
  type AnalyticsDashboardDemoDays,
} from "./analytics-counter-repository";

const repository = createAnalyticsCounterRepository();

export function seedAnalyticsDashboardDemo() {
  return repository.replaceAnalyticsDashboardDemo(createDemoDays());
}

export function clearAnalyticsDashboardDemo() {
  return repository.clearAnalyticsDashboardDemo();
}

function createDemoDays(): AnalyticsDashboardDemoDays {
  return [
    createDemoDay("2026-08-11", 22, 10),
    createDemoDay("2026-08-12", 24, 12),
    createDemoDay("2026-08-13", 21, 14),
    createDemoDay("2026-08-14", 13, 16),
  ];
}

function createDemoDay(
  metricDate: string,
  openNoticeTotal: number,
  noOpenNoticeTotal: number,
): AnalyticsDashboardDemoDay {
  return {
    metricDate,
    noOpenNoticeLocationDetailViewTotal: noOpenNoticeTotal,
    openNoticeLocationDetailViewTotal: openNoticeTotal,
  };
}
