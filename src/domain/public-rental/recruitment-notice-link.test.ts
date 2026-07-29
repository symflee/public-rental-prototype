import { expect, test } from "vitest";

import { createDandaeHappyHousingLocation } from "./seongnam-city-seed";
import { findOfficialRecruitmentNotice } from "./recruitment-notice-link";

test("현재 단지에 연결된 공식 LH 공고만 외부 이동 대상으로 찾는다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    recruitmentNotices: [
      {
        announcedAt: null,
        id: "20913",
        title: "공식",
        url: "https://apply.lh.or.kr/notices/20913",
      },
      {
        announcedAt: null,
        id: "unsafe",
        title: "비공식",
        url: "https://example.com/notices/unsafe",
      },
    ],
  };

  expect(findOfficialRecruitmentNotice([location], location.id, "20913")?.title).toBe("공식");
  expect(findOfficialRecruitmentNotice([location], location.id, "unsafe")).toBeUndefined();
  expect(findOfficialRecruitmentNotice([location], "other", "20913")).toBeUndefined();
});
