import { expect, test } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import {
  createAvailableCategories,
  createAvailableMunicipalities,
  filterMapLocations,
  toggleCategory,
  type MapLocationFilter,
} from "./map-location-filter";

const LOCATIONS = [
  createLocation(
    "seongnam-national",
    "SEONGNAM",
    "판교 국민임대",
    "경기도 성남시 분당구 판교로 123",
    ["NATIONAL_RENTAL"],
  ),
  createLocation("yongin-happy", "YONGIN", "용인 행복주택", "경기도 용인시 기흥구 동백로 45", [
    "HAPPY_HOUSING",
  ]),
  createLocation(
    "seongnam-mixed",
    "SEONGNAM",
    "복합 임대주택",
    "경기도 성남시 수정구 산성대로 10",
    ["PERMANENT_RENTAL", "NATIONAL_RENTAL"],
  ),
] as const;

const EMPTY_FILTER: MapLocationFilter = {
  categories: [],
  municipality: "ALL",
  query: "",
};

test("도시 필터는 원본 순서를 유지하며 해당 도시만 남긴다", () => {
  const result = filterMapLocations(LOCATIONS, {
    ...EMPTY_FILTER,
    municipality: "SEONGNAM",
  });

  expect(result.map(readIdentifier)).toEqual(["seongnam-national", "seongnam-mixed"]);
});

test("공급유형 다중 선택은 하나라도 포함하는 위치를 남긴다", () => {
  const result = filterMapLocations(LOCATIONS, {
    ...EMPTY_FILTER,
    categories: ["HAPPY_HOUSING", "PERMANENT_RENTAL"],
  });

  expect(result.map(readIdentifier)).toEqual(["yongin-happy", "seongnam-mixed"]);
});

test("검색어는 공백과 영문 대소문자를 정규화해 이름과 주소를 찾는다", () => {
  const byName = filterMapLocations(LOCATIONS, { ...EMPTY_FILTER, query: "  판교  " });
  const byAddress = filterMapLocations(LOCATIONS, { ...EMPTY_FILTER, query: "동 백 로" });

  expect(byName.map(readIdentifier)).toEqual(["seongnam-national"]);
  expect(byAddress.map(readIdentifier)).toEqual(["yongin-happy"]);
});

test("도시, 공급유형, 검색 조건을 모두 만족해야 한다", () => {
  const result = filterMapLocations(LOCATIONS, {
    categories: ["NATIONAL_RENTAL"],
    municipality: "SEONGNAM",
    query: "산성대로",
  });

  expect(result.map(readIdentifier)).toEqual(["seongnam-mixed"]);
});

test("위치 식별자 필터는 저장된 주택만 남긴다", () => {
  const result = filterMapLocations(LOCATIONS, {
    ...EMPTY_FILTER,
    locationIdentifiers: ["yongin-happy", "seongnam-mixed"],
  });

  expect(result.map(readIdentifier)).toEqual(["yongin-happy", "seongnam-mixed"]);
});

test("데이터에 실제 존재하는 공급유형만 정해진 표시 순서로 제공한다", () => {
  expect(createAvailableCategories(LOCATIONS)).toEqual([
    "NATIONAL_RENTAL",
    "PERMANENT_RENTAL",
    "HAPPY_HOUSING",
  ]);
});

test("데이터에 있는 경기도 시군만 표준 순서로 도시 필터에 제공한다", () => {
  const yangpyeong = createLocation(
    "yangpyeong-public",
    "YANGPYEONG",
    "양평 공공임대",
    "경기도 양평군 양평읍 시민로 1",
    ["PUBLIC_RENTAL"],
  );

  expect(createAvailableMunicipalities([...LOCATIONS, yangpyeong])).toEqual([
    "SEONGNAM",
    "YONGIN",
    "YANGPYEONG",
  ]);
});

test("공급유형 선택은 기존 순서를 유지하며 추가하고 다시 누르면 제거한다", () => {
  const selected = toggleCategory(["NATIONAL_RENTAL"], "HAPPY_HOUSING");
  const removed = toggleCategory(selected, "NATIONAL_RENTAL");

  expect(selected).toEqual(["NATIONAL_RENTAL", "HAPPY_HOUSING"]);
  expect(removed).toEqual(["HAPPY_HOUSING"]);
});

function createLocation(
  id: string,
  municipality: PublicRentalLocation["municipality"],
  name: string,
  roadAddress: string,
  legalCategories: PublicRentalLocation["legalCategories"],
) {
  return {
    id,
    legalCategories,
    municipality,
    name,
    roadAddress,
  } as PublicRentalLocation;
}

function readIdentifier(location: PublicRentalLocation) {
  return location.id;
}
