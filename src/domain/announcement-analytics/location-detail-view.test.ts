import { describe, expect, test } from "vitest";

import { createLocationDetailViewSummary } from "./location-detail-view";

describe("createLocationDetailViewSummary", () => {
  test("모집 80건과 비모집 52건을 보존한다", () => {
    expect(createLocationDetailViewSummary(80, 52)).toEqual({
      noOpenNoticeLocationDetailViewCount: 52,
      openNoticeLocationDetailViewCount: 80,
    });
  });

  test("음수 조회 수를 거부한다", () => {
    expect(() => createLocationDetailViewSummary(-1, 0)).toThrow();
  });
});
