import { expect, test } from "vitest";

import {
  createAnnouncementInterestCounter,
  createAnnouncementOpenCounter,
  createNoOpenNoticeLocationDetailViewCounter,
  createOpenNoticeLocationDetailViewCounter,
  createPageViewCounter,
} from "./analytics-counter";

test("일별 카운터는 공개 공고·단지 식별자만 가진다", () => {
  expect(createPageViewCounter("2026-07-29")).toEqual({
    eventKind: "PAGE_VIEW",
    metricDate: "2026-07-29",
    subjectId: "all",
    subjectKind: "SITE",
  });
  expect(createAnnouncementOpenCounter("2026-07-29", "20913").subjectKind).toBe("ANNOUNCEMENT");
  expect(createAnnouncementInterestCounter("2026-07-29", "31191377").subjectKind).toBe("LOCATION");
});

test("모집 상태별 단지 상세 조회는 사이트 전체 카운터로 집계한다", () => {
  expect(createOpenNoticeLocationDetailViewCounter("2026-08-14")).toEqual({
    eventKind: "OPEN_NOTICE_LOCATION_DETAIL_VIEW",
    metricDate: "2026-08-14",
    subjectId: "all",
    subjectKind: "SITE",
  });
  expect(createNoOpenNoticeLocationDetailViewCounter("2026-08-14")).toEqual({
    eventKind: "NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW",
    metricDate: "2026-08-14",
    subjectId: "all",
    subjectKind: "SITE",
  });
});
