import { expect, test } from "vitest";

import { createAnalyticsDashboard } from "./analytics-dashboard";

test("조회수와 공고 확인 행동 횟수를 분리해 집계한다", () => {
  const dashboard = createAnalyticsDashboard([
    counter("PAGE_VIEW", "SITE", "all", 10),
    counter("ANNOUNCEMENT_OPEN", "ANNOUNCEMENT", "20913", 3),
    counter("ANNOUNCEMENT_INTEREST", "LOCATION", "31191377", 2),
    counter("ANNOUNCEMENT_INTEREST", "LOCATION", "31191377", 1),
    counter("OPEN_NOTICE_LOCATION_DETAIL_VIEW", "SITE", "dashboard-demo-v1", 344),
    counter("NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW", "SITE", "dashboard-demo-v1", 388),
  ]);

  expect(dashboard).toMatchObject({
    announcementActionCount: 6,
    announcementActionRate: 60,
    announcementInterestCount: 3,
    announcementOpenCount: 3,
    locationDetailViewCount: 732,
    noOpenNoticeLocationDetailViewCount: 388,
    noOpenNoticeLocationDetailViewRate: (388 / 732) * 100,
    pageViewCount: 10,
  });
  expect(dashboard.announcementRanks).toEqual([{ subjectId: "20913", total: 3 }]);
  expect(dashboard.locationRanks).toEqual([{ subjectId: "31191377", total: 3 }]);
});

test("단지 상세 조회가 없으면 비모집 상세 조회 비율은 0이다", () => {
  const dashboard = createAnalyticsDashboard([]);

  expect(dashboard.locationDetailViewCount).toBe(0);
  expect(dashboard.noOpenNoticeLocationDetailViewCount).toBe(0);
  expect(dashboard.noOpenNoticeLocationDetailViewRate).toBe(0);
});

function counter(
  eventKind:
    | "PAGE_VIEW"
    | "ANNOUNCEMENT_OPEN"
    | "ANNOUNCEMENT_INTEREST"
    | "OPEN_NOTICE_LOCATION_DETAIL_VIEW"
    | "NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW",
  subjectKind: "SITE" | "ANNOUNCEMENT" | "LOCATION",
  subjectId: string,
  total: number,
) {
  return { eventKind, metricDate: "2026-07-29", subjectId, subjectKind, total };
}
