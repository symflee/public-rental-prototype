import { readKoreanDate, subtractDays } from "@/domain/announcement-analytics";

import {
  createAnalyticsCounterRepository,
  type AnalyticsDashboardDemoDay,
  type AnalyticsDashboardDemoDays,
} from "./analytics-counter-repository";

const repository = createAnalyticsCounterRepository();

export function seedAnalyticsDashboardDemo() {
  return repository.replaceAnalyticsDashboardDemo(createDemoDays(readKoreanDate()));
}

export function clearAnalyticsDashboardDemo() {
  return repository.clearAnalyticsDashboardDemo();
}

function createDemoDays(today: string): AnalyticsDashboardDemoDays {
  return [
    createDemoDay(subtractDays(today, 3), 80, 88),
    createDemoDay(subtractDays(today, 2), 85, 94),
    createDemoDay(subtractDays(today, 1), 87, 99),
    createDemoDay(today, 92, 107),
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
