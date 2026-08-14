import { expect, test } from "vitest";

import type { PublicRentalLocation } from "./public-rental-location";
import { createPublicRentalMapResult, type PublicRentalMapFilter } from "./public-rental-map-query";

const VIEWPORT = {
  east: 127.3,
  height: 800,
  level: 10,
  north: 37.7,
  south: 37.1,
  west: 126.9,
  width: 1200,
};

test("넓은 지도 영역에서는 화면 격자별 집계를 반환한다", () => {
  const result = createPublicRentalMapResult(createLocations(200), createRequest(VIEWPORT));

  expect(result.mode).toBe("clusters");
  expect(result.locations).toEqual([]);
  expect(result.totalLocationCount).toBe(200);
  expect(result.clusters).toHaveLength(2);
  expect(result.clusters.map((cluster) => cluster.count)).toEqual([100, 100]);
});

test("충분히 확대되고 핀 수가 제한 안이면 각 주택의 경량 핀을 반환한다", () => {
  const result = createPublicRentalMapResult(
    createSpacedLocations(),
    createRequest({ ...VIEWPORT, level: 6 }),
  );

  expect(result.mode).toBe("locations");
  expect(result.clusters).toEqual([]);
  expect(result.locations.map((location) => location.id)).toEqual([
    "location-0",
    "location-1",
    "location-2",
  ]);
  expect(result.locations[0]?.coordinate?.latitude).toBe(37.2);
});

test("확대 상태여도 핀이 과밀하면 집계를 유지한다", () => {
  const result = createPublicRentalMapResult(
    createLocations(181),
    createRequest({ ...VIEWPORT, level: 4 }),
  );

  expect(result.mode).toBe("clusters");
  expect(result.clusters).not.toEqual([]);
});

test("개수가 적어도 화면에서 겹치는 핀은 집계로 유지한다", () => {
  const locations = [createLocation(0), createLocation(1)];
  const result = createPublicRentalMapResult(locations, createRequest({ ...VIEWPORT, level: 6 }));

  expect(result.mode).toBe("clusters");
});

test("시군, 공급 유형, 검색어와 지도 영역을 함께 적용한다", () => {
  const locations = [
    createLocation(0, "SEONGNAM", ["NATIONAL_RENTAL"], "성남 국민임대"),
    createLocation(1, "YONGIN", ["HAPPY_HOUSING"], "용인 행복주택"),
    createOutsideLocation(),
  ];
  const result = createPublicRentalMapResult(
    locations,
    createRequest(
      { ...VIEWPORT, level: 6 },
      {
        categories: ["HAPPY_HOUSING"],
        municipality: "YONGIN",
        query: "행 복",
      },
    ),
  );

  expect(result.totalLocationCount).toBe(1);
  expect(result.locations[0]?.name).toBe("용인 행복주택");
});

test("위치 식별자를 지정하면 넓은 지도에서도 저장된 주택만 집계한다", () => {
  const locations = createSpacedLocations();
  const result = createPublicRentalMapResult(
    locations,
    createRequest(VIEWPORT, {
      categories: [],
      locationIdentifiers: ["location-1"],
      municipality: "ALL",
      query: "",
    }),
  );

  expect(result.totalLocationCount).toBe(1);
});

function createRequest(
  viewport: typeof VIEWPORT,
  filter: PublicRentalMapFilter = { categories: [], municipality: "ALL", query: "" },
) {
  return { filter, viewport };
}

function createLocations(count: number) {
  return Array.from({ length: count }, (_, index) => createLocation(index));
}

function createSpacedLocations() {
  return [
    createLocation(0, "SEONGNAM", ["NATIONAL_RENTAL"], "임대주택 0", 37.2, 126.95),
    createLocation(1, "SEONGNAM", ["NATIONAL_RENTAL"], "임대주택 1", 37.4, 127.1),
    createLocation(2, "SEONGNAM", ["NATIONAL_RENTAL"], "임대주택 2", 37.6, 127.25),
  ];
}

function createLocation(
  index: number,
  municipality: "SEONGNAM" | "YONGIN" = "SEONGNAM",
  legalCategories: PublicRentalLocation["legalCategories"] = ["NATIONAL_RENTAL"],
  name = `임대주택 ${index}`,
  latitude = 37.3,
  longitude = index < 100 ? 127.01 : 127.21,
): PublicRentalLocation {
  return {
    addressAliases: [],
    completionDate: null,
    coordinate: { latitude, longitude, source: "KAKAO_ADDRESS_SEARCH" },
    district: municipality === "SEONGNAM" ? "수정구" : "기흥구",
    householdCount: 100,
    id: `location-${index}`,
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories,
    municipality,
    name,
    offerings: [],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    recruitmentNotices: [],
    roadAddress: `경기도 ${name}로 ${index}`,
    sourceRecords: [],
  };
}

function createOutsideLocation(): PublicRentalLocation {
  return {
    ...createLocation(2),
    coordinate: { latitude: 38.1, longitude: 128.1, source: "KAKAO_ADDRESS_SEARCH" },
  };
}
