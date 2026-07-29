import { expect, test } from "vitest";

import {
  createAnnouncementInterestCounter,
  createAnnouncementOpenCounter,
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
