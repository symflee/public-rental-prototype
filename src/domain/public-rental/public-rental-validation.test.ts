import { describe, expect, test } from "vitest";

import type { PublicRentalLocation, PublicRentalProvider } from "./public-rental-location";
import {
  validatePublicRentalLocations,
  type PublicRentalValidationIssueCode,
} from "./public-rental-validation";
import {
  createDandaeHappyHousingLocation,
  createSeongnamCityPublicRentalLocations,
} from "./seongnam-city-seed";

const REQUIRED_ISSUE_CODES: PublicRentalValidationIssueCode[] = [
  "MISSING_ID",
  "OUT_OF_SCOPE_NAME",
  "INVALID_ADDRESS",
  "INVALID_COORDINATE",
  "INVALID_PROVIDER",
  "MISSING_LEGAL_CATEGORY",
  "INVALID_SOURCE_URL",
  "INVALID_SOURCE_REFERENCE_DATE",
];

describe("공공임대 배포 검증 성공", () => {
  test("배포 조건을 충족하는 성남시 위치는 문제가 없다", testValidLocations);
  test("분양과 임대가 함께 있는 단지의 임대 위치를 허용한다", testMixedUseName);
});

describe("공공임대 배포 검증 실패", () => {
  test("중복된 위치 식별자를 보고한다", testDuplicateIdentifier);
  test("필수 정보와 범위 위반을 모두 보고한다", testInvalidLocation);
  test("출처가 하나도 없는 위치를 보고한다", testMissingSource);
});

function testValidLocations() {
  const locations = createSeongnamCityPublicRentalLocations();
  const issues = validatePublicRentalLocations(locations);

  expect(issues).toEqual([]);
}

function testMixedUseName() {
  const location = {
    ...createDandaeHappyHousingLocation(),
    name: "성남고등 S-3 공공분양+공공임대",
  };
  const issues = validatePublicRentalLocations([location]);

  expect(issueCodes(issues)).not.toContain("OUT_OF_SCOPE_NAME");
}

function testDuplicateIdentifier() {
  const location = createDandaeHappyHousingLocation();
  const issues = validatePublicRentalLocations([location, location]);

  expect(issueCodes(issues)).toContain("DUPLICATE_ID");
}

function testInvalidLocation() {
  const issues = validatePublicRentalLocations([createInvalidLocation()]);

  expect(issueCodes(issues)).toEqual(expect.arrayContaining(REQUIRED_ISSUE_CODES));
}

function testMissingSource() {
  const location = { ...createDandaeHappyHousingLocation(), sourceRecords: [] };
  const issues = validatePublicRentalLocations([location]);

  expect(issueCodes(issues)).toContain("MISSING_SOURCE");
}

function createInvalidLocation(): PublicRentalLocation {
  return {
    ...createDandaeHappyHousingLocation(),
    id: " ",
    provider: "GH" as PublicRentalProvider,
    name: "다솜마을",
    roadAddress: "경기도 수원시 영통구 광교로 1",
    coordinate: { latitude: 91, longitude: 181, source: "SEONGNAM_PUBLIC_WIFI" },
    legalCategories: [],
    sourceRecords: [createInvalidSourceRecord()],
  };
}

function createInvalidSourceRecord() {
  return {
    source: "SEONGNAM_PUBLIC_WIFI" as const,
    sourceId: "invalid",
    sourceUrl: "not-a-url",
    referenceDate: "2026-02-30",
  };
}

function issueCodes(issues: readonly { code: PublicRentalValidationIssueCode }[]) {
  return issues.map((issue) => issue.code);
}
