import { describe, expect, test } from "vitest";

import {
  createDandaeHappyHousingLocation,
  createSeongnamCityPublicRentalLocations,
} from "./seongnam-city-seed";

const DEVELOPMENT_SOURCE_URL = "https://www.isdc.co.kr/operBusiness/dandaedong.asp";
const PUBLIC_WIFI_SOURCE_URL = "https://www.seongnam.go.kr/contents/down/10458_1.pdf";

describe("단대동 행복주택 기본 정보", () => {
  test("성남시가 운영하는 60세대 행복주택 정보를 만든다", testDandaeDetails);
  test("성남시 공식 자료의 좌표를 보존한다", testDandaeCoordinate);
});

describe("단대동 행복주택 출처", () => {
  test("운영 페이지와 좌표 및 마이홈 근거를 보존한다", testDandaeSources);
});

describe("성남시 공공임대 시드 범위", () => {
  test("다솜마을을 포함하지 않는다", testSeedScope);
});

function testDandaeDetails() {
  const location = createDandaeHappyHousingLocation();

  expect(location).toMatchObject({
    id: "seongnam:dandae-happy-housing",
    provider: "SEONGNAM_CITY",
    name: "단대동 행복주택",
    roadAddress: "경기도 성남시 수정구 단대로23번길 36",
    parcelNumber: "4113110400101300000",
    householdCount: 60,
    completionDate: "2021-03-10",
    legalCategories: ["HAPPY_HOUSING"],
  });
}

function testDandaeCoordinate() {
  const location = createDandaeHappyHousingLocation();

  expect(location.coordinate).toEqual({
    latitude: 37.450084696315,
    longitude: 127.155841734816,
    source: "SEONGNAM_PUBLIC_WIFI",
  });
}

function testDandaeSources() {
  const location = createDandaeHappyHousingLocation();
  const sourceUrls = location.sourceRecords.map((source) => source.sourceUrl);

  expect(sourceUrls).toEqual([DEVELOPMENT_SOURCE_URL, PUBLIC_WIFI_SOURCE_URL, expect.any(String)]);
  expect(location.sourceRecords[2]).toMatchObject({
    source: "MY_HOME_PUBLIC_RENTAL_API",
    sourceId: "31369110",
  });
  expect(location.sourceRecords.every(hasManagedReferenceDate)).toBe(true);
}

function testSeedScope() {
  const locations = createSeongnamCityPublicRentalLocations();

  expect(locations.values).toHaveLength(1);
  expect(locations.values[0]?.name).toBe("단대동 행복주택");
}

function hasManagedReferenceDate(source: { referenceDate: string | null }) {
  return source.referenceDate === "2026-07-28";
}
