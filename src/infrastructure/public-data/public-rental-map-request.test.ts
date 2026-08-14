import { expect, test } from "vitest";

import { readPublicRentalMapRequest } from "./public-rental-map-request";

test("지도 API 쿼리를 검증된 지도·필터 요청으로 변환한다", () => {
  const request = readPublicRentalMapRequest(
    new URLSearchParams({
      categories: "HAPPY_HOUSING,NATIONAL_RENTAL",
      east: "127.31",
      height: "760",
      level: "6",
      locationIds: "location-one,location-two",
      municipality: "YONGIN",
      north: "37.52",
      query: "동백 행복",
      south: "37.20",
      west: "127.02",
      width: "1024",
    }),
  );

  expect(request).toEqual({
    filter: {
      categories: ["HAPPY_HOUSING", "NATIONAL_RENTAL"],
      locationIdentifiers: ["location-one", "location-two"],
      municipality: "YONGIN",
      query: "동백 행복",
    },
    viewport: {
      east: 127.31,
      height: 760,
      level: 6,
      north: 37.52,
      south: 37.2,
      west: 127.02,
      width: 1024,
    },
  });
});

test("잘못된 지도 범위와 필터는 요청 전에 거절한다", () => {
  expect(() =>
    readPublicRentalMapRequest(
      new URLSearchParams({
        east: "127.1",
        height: "100",
        level: "19",
        municipality: "UNKNOWN",
        north: "37.2",
        south: "37.3",
        west: "127.3",
        width: "0",
      }),
    ),
  ).toThrow("지도 요청 형식이 올바르지 않습니다.");
});

test("빈 필터 값에는 전체 지역과 공급유형을 적용한다", () => {
  const request = readPublicRentalMapRequest(createValidParameters());

  expect(request.filter).toEqual({ categories: [], municipality: "ALL", query: "" });
});

test("저장 주택 식별자는 최대 100개까지만 허용한다", () => {
  const parameters = createValidParameters();
  const identifiers = Array.from({ length: 101 }, (_, index) => `location-${index}`);
  parameters.set("locationIds", identifiers.join(","));

  expect(() => readPublicRentalMapRequest(parameters)).toThrow(
    "지도 요청 형식이 올바르지 않습니다.",
  );
});

function createValidParameters() {
  return new URLSearchParams({
    east: "127.3",
    height: "800",
    level: "8",
    north: "37.7",
    south: "37.1",
    west: "126.9",
    width: "1200",
  });
}
