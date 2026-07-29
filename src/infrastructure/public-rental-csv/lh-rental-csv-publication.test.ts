import { expect, test } from "vitest";

import { createDandaeHappyHousingLocation } from "@/domain/public-rental";

import {
  applyResolvedCoordinates,
  assertExpectedLhLocationProfile,
  createCoordinateReviewFailures,
  createCoordinateRequests,
  findRoadLevelLocations,
  selectResolvedLocations,
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

test("군 지역 좌표 요청에는 군 이름을 보존한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    addressAliases: ["경기도 양평군 양평읍 시민로 1"],
    district: "양평군" as const,
    municipality: "YANGPYEONG" as const,
    roadAddress: "경기도 양평군 양평읍 시민로 1",
  };

  expect(createCoordinateRequests([location])[0]?.municipality).toBe("양평군");
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

test("좌표 확인에 실패한 위치만 검수 목록에 남기고 게시 대상에서 제외한다", () => {
  const resolved = createDandaeHappyHousingLocation();
  const failed = { ...resolved, id: "failed-location", name: "좌표 실패 단지" };
  const coordinates = { [resolved.id]: { latitude: 37.449, longitude: 127.161 } };
  const failures = [
    {
      address: failed.roadAddress,
      kind: "not-found" as const,
      locationId: failed.id,
      message: "주소를 찾지 못했습니다.",
    },
  ];

  expect(selectResolvedLocations([resolved, failed], coordinates)).toEqual([resolved]);
  expect(createCoordinateReviewFailures([resolved, failed], failures)).toEqual([
    {
      ...failures[0],
      district: failed.district,
      locationName: failed.name,
      municipality: failed.municipality,
    },
  ]);
});

test("실데이터 위치 수가 계획과 다르면 게시를 중단한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    provider: "LH" as const,
  };

  expect(() => assertExpectedLhLocationProfile([location])).toThrow("269곳");
});
