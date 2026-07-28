import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import type { PublicRentalLocation, PublicRentalSource } from "@/domain/public-rental";

import { publicRentalSnapshot } from "./public-rental-snapshot";

const EXPECTED_SOURCES: Readonly<
  Record<PublicRentalSource, Readonly<{ date: string; url: string }> | undefined>
> = {
  LH_CONSTRUCTION_RENTAL_CSV: {
    date: "2025-09-18",
    url: "https://www.data.go.kr/data/15050700/fileData.do",
  },
  LH_PURCHASE_RENTAL_CSV: {
    date: "2022-01-27",
    url: "https://www.data.go.kr/data/15050701/fileData.do",
  },
  MY_HOME_PUBLIC_RENTAL_API: undefined,
  SEONGNAM_PUBLIC_WIFI: undefined,
  SEONGNAM_URBAN_DEVELOPMENT_CORPORATION: undefined,
};

describe("게시된 성남·용인 LH CSV 스냅샷", () => {
  test("성남 87곳과 용인 182곳, 총 269곳을 게시한다", () => {
    expect(publicRentalSnapshot.schemaVersion).toBe(2);
    expect(publicRentalSnapshot.status).toBe("verified");
    expect(publicRentalSnapshot.locations).toHaveLength(269);
    expect(countMunicipality("SEONGNAM")).toBe(87);
    expect(countMunicipality("YONGIN")).toBe(182);
  });

  test("건설 68곳과 매입 201곳의 공식 출처와 기준일을 보존한다", () => {
    expect(countSourceLocations("LH_CONSTRUCTION_RENTAL_CSV")).toBe(68);
    expect(countSourceLocations("LH_PURCHASE_RENTAL_CSV")).toBe(201);
    publicRentalSnapshot.locations.forEach(expectOfficialSources);
  });

  test("모든 위치에 좌표·구·공급유형·주택 속성이 있다", () => {
    publicRentalSnapshot.locations.forEach(expectCompleteLocation);
  });

  test("주소 기반 위치 ID가 유일하고 재현 가능하다", () => {
    const identifiers = publicRentalSnapshot.locations.map((location) => location.id);
    const addresses = publicRentalSnapshot.locations.map((location) => location.roadAddress);
    expect(new Set(identifiers).size).toBe(269);
    expect(new Set(addresses).size).toBe(269);
    publicRentalSnapshot.locations.forEach(expectDeterministicIdentifier);
  });

  test("복합 공급유형 위치는 성남 세 곳이다", () => {
    const mixed = publicRentalSnapshot.locations.filter(hasMultipleCategories);
    expect(mixed.map(readAddress)).toEqual([
      "경기도 성남시 수정구 위례광장로 311",
      "경기도 성남시 중원구 둔촌대로63번길 11",
      "경기도 성남시 수정구 고등로 57",
    ]);
  });

  test("범위 밖 운영주체·사업·불완전 주소를 게시하지 않는다", () => {
    const serialized = JSON.stringify(publicRentalSnapshot.locations);
    const supplyTypes = publicRentalSnapshot.locations.flatMap(readSupplyTypeNames);
    expect(new Set(publicRentalSnapshot.locations.map(readProvider))).toEqual(new Set(["LH"]));
    expect(serialized).not.toMatch(/다솜마을|단대동 행복주택|경기주택도시공사/u);
    expect(supplyTypes).not.toContain("공공분양");
    expect(serialized).not.toMatch(/중원구 마지로"|처인구 (?:금학로|명지로)"/u);
    expect(serialized).not.toMatch(/모현면 왕림로"|이동면 백옥대로"/u);
  });
});

function countMunicipality(municipality: PublicRentalLocation["municipality"]) {
  return publicRentalSnapshot.locations.filter((location) => {
    return location.municipality === municipality;
  }).length;
}

function countSourceLocations(source: PublicRentalSource) {
  return publicRentalSnapshot.locations.filter((location) => {
    return location.sourceRecords.some((record) => record.source === source);
  }).length;
}

function expectOfficialSources(location: PublicRentalLocation) {
  location.sourceRecords.forEach((source) => {
    const expected = EXPECTED_SOURCES[source.source];
    expect(expected, source.source).toBeDefined();
    expect(source.sourceUrl).toBe(expected?.url);
    expect(source.referenceDate).toBe(expected?.date);
  });
}

function expectCompleteLocation(location: PublicRentalLocation) {
  expect(location.provider).toBe("LH");
  expect(location.coordinate).not.toBeNull();
  expect(location.district).toMatch(/구$/u);
  expect(location.legalCategories.length).toBeGreaterThan(0);
  expect(location.properties.length).toBeGreaterThan(0);
}

function expectDeterministicIdentifier(location: PublicRentalLocation) {
  const city = location.municipality.toLocaleLowerCase("en-US");
  const hash = createHash("sha256").update(location.roadAddress).digest("hex").slice(0, 16);
  expect(location.id).toBe(`lh:${city}:${hash}`);
}

function hasMultipleCategories(location: PublicRentalLocation) {
  return location.legalCategories.length > 1;
}

function readAddress(location: PublicRentalLocation) {
  return location.roadAddress;
}

function readProvider(location: PublicRentalLocation) {
  return location.provider;
}

function readSupplyTypeNames(location: PublicRentalLocation) {
  return location.offerings.map((offering) => offering.supplyTypeName);
}
