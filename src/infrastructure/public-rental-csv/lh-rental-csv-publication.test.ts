import { expect, test } from "vitest";

import { createDandaeHappyHousingLocation } from "@/domain/public-rental";

import {
  applyResolvedCoordinates,
  assertExpectedLhLocationProfile,
  createCoordinateRequests,
  findRoadLevelLocations,
} from "./lh-rental-csv-publication";

test("위치 ID에 맞는 좌표를 Kakao 출처와 함께 적용한다", () => {
  const location = createDandaeHappyHousingLocation();
  const locations = applyResolvedCoordinates([location], {
    [location.id]: { latitude: 37.449, longitude: 127.161 },
  });

  expect(locations[0]?.coordinate).toEqual({
    latitude: 37.449,
    longitude: 127.161,
    source: "KAKAO_ADDRESS_SEARCH",
  });
});

test("좌표 요청에 시·구와 주소 별칭을 보존한다", () => {
  const location = createDandaeHappyHousingLocation();

  expect(createCoordinateRequests([location])).toEqual([
    {
      addressAliases: location.addressAliases,
      district: "수정구",
      locationId: location.id,
      municipality: "성남시",
      roadAddress: location.roadAddress,
    },
  ]);
});

test("도로명 숫자만 있고 별도 건물번호가 없는 위치를 정밀도 경고로 찾는다", () => {
  const location = createDandaeHappyHousingLocation();
  const roadLevelLocation = {
    ...location,
    roadAddress: "경기도 성남시 수정구 선지봉로7번길",
  };

  expect(findRoadLevelLocations([roadLevelLocation])).toEqual([
    {
      locationId: location.id,
      roadAddress: roadLevelLocation.roadAddress,
    },
  ]);
  expect(findRoadLevelLocations([location])).toEqual([]);
});

test("실데이터 위치 수가 계획과 다르면 게시를 중단한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    provider: "LH" as const,
  };

  expect(() => assertExpectedLhLocationProfile([location])).toThrow("269곳");
});
