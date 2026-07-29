import { expect, test } from "vitest";

import {
  createCurrentMonthDateRange,
  createRecentDateRange,
  readAnalyticsDateRange,
  readKoreanDate,
  subtractDays,
} from "./analytics-date";

test("한국 시간 기준 날짜를 읽는다", () => {
  expect(readKoreanDate(new Date("2026-07-28T15:30:00.000Z"))).toBe("2026-07-29");
});

test("기본 기간은 최근 30일이고 사용자 지정 기간은 1년 이내로 제한한다", () => {
  expect(createRecentDateRange("2026-07-29", 7)).toEqual({ from: "2026-07-23", to: "2026-07-29" });
  expect(createCurrentMonthDateRange("2026-07-29")).toEqual({
    from: "2026-07-01",
    to: "2026-07-29",
  });
  expect(readAnalyticsDateRange("2026-07-01", "2026-07-29")).toEqual({
    from: "2026-07-01",
    to: "2026-07-29",
  });
  expect(readAnalyticsDateRange("2025-01-01", "2026-07-29")).toEqual({
    from: "2026-06-30",
    to: "2026-07-29",
  });
  expect(subtractDays("2026-07-29", 365)).toBe("2025-07-29");
});

test("미래를 포함하는 사용자 지정 기간은 최근 30일로 되돌린다", () => {
  expect(readAnalyticsDateRange("2026-07-01", "2026-08-01", "2026-07-29")).toEqual({
    from: "2026-06-30",
    to: "2026-07-29",
  });
});
