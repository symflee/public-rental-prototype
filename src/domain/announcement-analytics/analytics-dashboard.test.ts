import { expect, test } from "vitest";

import { createAnalyticsDashboard } from "./analytics-dashboard";

test("조회수와 공고 확인 행동 횟수를 분리해 집계한다", () => {
  const dashboard = createAnalyticsDashboard([
    counter("PAGE_VIEW", "SITE", "all", 10),
    counter("ANNOUNCEMENT_OPEN", "ANNOUNCEMENT", "20913", 3),
    counter("ANNOUNCEMENT_INTEREST", "LOCATION", "31191377", 2),
    counter("ANNOUNCEMENT_INTEREST", "LOCATION", "31191377", 1),
  ]);

  expect(dashboard).toMatchObject({
    announcementActionCount: 6,
    announcementActionRate: 60,
    announcementInterestCount: 3,
    announcementOpenCount: 3,
    pageViewCount: 10,
  });
  expect(dashboard.announcementRanks).toEqual([{ subjectId: "20913", total: 3 }]);
  expect(dashboard.locationRanks).toEqual([{ subjectId: "31191377", total: 3 }]);
});

function counter(
  eventKind: "PAGE_VIEW" | "ANNOUNCEMENT_OPEN" | "ANNOUNCEMENT_INTEREST",
  subjectKind: "SITE" | "ANNOUNCEMENT" | "LOCATION",
  subjectId: string,
  total: number,
) {
  return { eventKind, metricDate: "2026-07-29", subjectId, subjectKind, total };
}
