import { describe, expect, test } from "vitest";

import { findGyeonggiAddressArea, type PublicRentalLocation } from "@/domain/public-rental";

import { publicRentalSnapshot } from "./public-rental-snapshot";

describe("게시된 경기도 LH 스냅샷", () => {
  test("검증된 LH 위치를 한 곳 이상 게시한다", testVerifiedLhLocations);
  test("모든 위치에 지도 표시와 원천 검증에 필요한 정보가 있다", testCompleteLocations);
  test("위치 식별자와 모집공고 식별자가 중복되지 않는다", testUniqueIdentifiers);
  test("범위 밖 운영주체와 임대유형을 게시하지 않는다", testScope);
});

function testVerifiedLhLocations() {
  expect(publicRentalSnapshot.schemaVersion).toBe(2);
  expect(publicRentalSnapshot.status).toBe("verified");
  expect(publicRentalSnapshot.locations.length).toBeGreaterThan(0);
  expect(publicRentalSnapshot.locations.every((location) => location.provider === "LH")).toBe(true);
}

function testCompleteLocations() {
  publicRentalSnapshot.locations.forEach(expectCompleteLocation);
}

function testUniqueIdentifiers() {
  const identifiers = publicRentalSnapshot.locations.map((location) => location.id);
  expect(new Set(identifiers).size).toBe(identifiers.length);
  publicRentalSnapshot.locations.forEach(expectUniqueRecruitmentNoticeIdentifiers);
}

function testScope() {
  const serialized = JSON.stringify(publicRentalSnapshot.locations);
  const supplyTypes = publicRentalSnapshot.locations.flatMap(readSupplyTypeNames);
  expect(serialized).not.toMatch(/전세임대|민간임대/u);
  expect(supplyTypes).not.toContain("공공분양");
}

function expectCompleteLocation(location: PublicRentalLocation) {
  expect(location.coordinate).not.toBeNull();
  expect(findGyeonggiAddressArea(location.roadAddress)).toBeDefined();
  expect(location.legalCategories.length).toBeGreaterThan(0);
  expect(location.properties.length).toBeGreaterThan(0);
  expect(location.sourceRecords.length).toBeGreaterThan(0);
  location.sourceRecords.forEach(expectOfficialSource);
}

function expectOfficialSource(source: PublicRentalLocation["sourceRecords"][number]) {
  expect(source.sourceUrl).toMatch(/^https?:\/\//u);
  expect(source.referenceDate).toMatch(/^\d{4}-?\d{2}-?\d{2}$/u);
}

function expectUniqueRecruitmentNoticeIdentifiers(location: PublicRentalLocation) {
  const notices = location.recruitmentNotices ?? [];
  const identifiers = notices.map((notice) => notice.id);
  expect(new Set(identifiers).size).toBe(identifiers.length);
}

function readSupplyTypeNames(location: PublicRentalLocation) {
  return location.offerings.map((offering) => offering.supplyTypeName);
}
