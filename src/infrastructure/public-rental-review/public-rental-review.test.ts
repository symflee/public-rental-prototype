import { expect, test } from "vitest";

import {
  createDandaeHappyHousingLocation,
  type PublicRentalLocation,
} from "@/domain/public-rental";
import type { LhLeaseVerificationRecord } from "@/infrastructure/public-data/lh-lease-verification-client";
import type {
  LhApartmentVerificationCandidate,
  SeongnamApartmentVerificationCandidate,
} from "@/infrastructure/public-data/verification-csv-parsers";

import { reviewPublicRentalSources } from "./public-rental-review";

const LH_LOCATION: PublicRentalLocation = {
  id: "31370001",
  provider: "LH",
  kind: "CONSTRUCTION_RENTAL_COMPLEX",
  municipality: "SEONGNAM",
  district: "분당구",
  legalCategories: ["NATIONAL_RENTAL"],
  name: "판교 봇들마을(6단지)",
  roadAddress: "경기도 성남시 분당구 동판교로 212",
  addressAliases: ["경기도 성남시 분당구 동판교로 212"],
  parcelNumber: null,
  coordinate: null,
  householdCount: 100,
  completionDate: null,
  properties: [],
  offerings: [],
  sourceRecords: [
    {
      source: "MY_HOME_PUBLIC_RENTAL_API",
      sourceId: "31370001",
      sourceUrl: "https://www.data.go.kr/data/15110581/openapi.do",
      referenceDate: "2026-07-28",
    },
  ],
};

const LH_CSV_CANDIDATE: LhApartmentVerificationCandidate = {
  address: LH_LOCATION.roadAddress,
  buildingCount: "2",
  completionDate: "2020-01-01",
  complexCode: LH_LOCATION.id,
  complexName: LH_LOCATION.name,
  householdCount: "100",
  housingType: "아파트",
  occupancyEndDate: "",
  occupancyStartDate: "",
  regionalHeadquarters: "경기남부",
  rentalType: "국민임대",
  reviewOnly: true,
  source: "lh-national-apartment-csv",
};

const SEONGNAM_CANDIDATE: SeongnamApartmentVerificationCandidate = {
  buildingCount: "1",
  complexName: "단대동 행복주택",
  dataReferenceDate: "2026-07-01",
  district: "수정구",
  dong: "단대동",
  householdCount: "60",
  lotAddress: "단대동 62-11",
  managementOffice: "",
  maximumFloorCount: "6",
  reviewOnly: true,
  roadAddress: "경기도 성남시 수정구 단대로23번길 36",
  source: "seongnam-apartment-csv",
};

test("LH 후보를 정규화한 이름이나 신뢰 가능한 ID로 연결하고 충돌만 보고한다", () => {
  const originalLocation = JSON.stringify(LH_LOCATION);
  const result = createConflictingLhReview();

  expect(JSON.stringify(LH_LOCATION)).toBe(originalLocation);
  expectLeaseConflictSummary(result);
  expectLhCsvConflictSummary(result);
  expect(result.issues.map((issue) => issue.code)).toEqual([
    "HOUSEHOLD_COUNT_CONFLICT",
    "UNMATCHED_CANDIDATE",
    "NAME_CONFLICT",
    "ADDRESS_CONFLICT",
  ]);
});

test("신뢰 ID가 같고 정규화 이름이 다르면 이름 충돌로 분리한다", () => {
  const candidate = createLhCsvCandidate({ complexName: "서로 다른 단지명" });
  const result = reviewPublicRentalSources([LH_LOCATION], [], [candidate], []);
  const issue = result.issues[0];

  expect(result.issues).toHaveLength(1);
  expect(issue?.code).toBe("NAME_CONFLICT");
  expect(issue?.publishedValue).toBe(LH_LOCATION.name);
  expect(issue?.verificationValue).toBe("서로 다른 단지명");
  expect(readSummary(result, "lh-national-apartment-csv").conflictCount).toBe(1);
});

test("일치한 LH 검수 값은 공개 위치를 덮어쓰지 않고 문제도 만들지 않는다", () => {
  const result = reviewPublicRentalSources(
    [LH_LOCATION],
    [createLeaseRecord("판교 봇들마을 (6단지)", "100")],
    [LH_CSV_CANDIDATE],
    [],
  );

  expect(result.issues).toEqual([]);
  expect(readSummary(result, "lh-lease-api").matchedCount).toBe(1);
  expect(readSummary(result, "lh-national-apartment-csv").matchedCount).toBe(1);
});

test("같은 단지의 공급유형별 세대수는 최대 단지 세대수로 검증한다", () => {
  const records = [
    createLeaseRecord("판교 봇들마을 (6단지)", "100"),
    createLeaseRecord("판교 봇들마을 (6단지)", "40"),
  ];
  const result = reviewPublicRentalSources([LH_LOCATION], records, [], []);

  expect(result.issues).toEqual([]);
  expect(readSummary(result, "lh-lease-api").candidateCount).toBe(1);
});

test("성남 CSV는 단대동 주소만 검증하고 숫자 필드는 사용하지 않는다", () => {
  const result = createMatchingCityReview();

  expect(result.issues).toEqual([]);
  expectCityMatchSummary(result);
});

test("단대동 주소 불일치를 검수 문제로 남긴다", () => {
  const location = createDandaeHappyHousingLocation();
  const conflict = reviewPublicRentalSources(
    [location],
    [],
    [],
    [createSeongnamCandidate({ roadAddress: "경기도 성남시 수정구 다른로 1" })],
  );

  expect(conflict.issues[0]?.code).toBe("ADDRESS_CONFLICT");
  expect(readSummary(conflict, "seongnam-apartment-csv").conflictCount).toBe(1);
});

test("단대동 기준 행 누락을 검수 문제로 남긴다", () => {
  const location = createDandaeHappyHousingLocation();
  const missing = reviewPublicRentalSources([location], [], [], []);

  expect(missing.issues[0]?.code).toBe("ADDRESS_REFERENCE_MISSING");
  expect(readSummary(missing, "seongnam-apartment-csv").conflictCount).toBe(1);
});

function createConflictingLhReview() {
  const leaseRecords = [
    createLeaseRecord("판교봇들마을 6단지", "90"),
    createLeaseRecord("성남 미등록 단지", "20"),
  ];
  const csvCandidate = createLhCsvCandidate({
    address: "경기도 성남시 분당구 다른로 1",
    complexName: "이름이 달라도 ID가 같은 단지",
  });
  return reviewPublicRentalSources([LH_LOCATION], leaseRecords, [csvCandidate], []);
}

function expectLeaseConflictSummary(result: ReturnType<typeof reviewPublicRentalSources>) {
  expect(readSummary(result, "lh-lease-api")).toEqual({
    candidateCount: 2,
    conflictCount: 1,
    matchedCount: 1,
    source: "lh-lease-api",
    unmatchedCount: 1,
  });
}

function expectLhCsvConflictSummary(result: ReturnType<typeof reviewPublicRentalSources>) {
  expect(readSummary(result, "lh-national-apartment-csv")).toMatchObject({
    candidateCount: 1,
    conflictCount: 2,
    matchedCount: 1,
  });
}

function createMatchingCityReview() {
  const unrelatedCandidate = createSeongnamCandidate({
    complexName: "일반 공동주택",
    householdCount: "9999",
  });
  const dandaeCandidate = createSeongnamCandidate({ householdCount: "9999" });
  return reviewPublicRentalSources(
    [createDandaeHappyHousingLocation()],
    [],
    [],
    [dandaeCandidate, unrelatedCandidate],
  );
}

function expectCityMatchSummary(result: ReturnType<typeof reviewPublicRentalSources>) {
  expect(readSummary(result, "seongnam-apartment-csv")).toEqual({
    candidateCount: 2,
    conflictCount: 0,
    matchedCount: 1,
    source: "seongnam-apartment-csv",
    unmatchedCount: 1,
  });
}

function createLeaseRecord(complexName: string, householdCount: string): LhLeaseVerificationRecord {
  return {
    ARA_NM: "경기도 성남시 분당구",
    SBD_LGO_NM: complexName,
    SUM_HSH_CNT: householdCount,
    reviewOnly: true,
    source: "lh-lease-api",
  };
}

function createLhCsvCandidate(
  values: Partial<LhApartmentVerificationCandidate>,
): LhApartmentVerificationCandidate {
  return { ...LH_CSV_CANDIDATE, ...values };
}

function createSeongnamCandidate(
  values: Partial<SeongnamApartmentVerificationCandidate>,
): SeongnamApartmentVerificationCandidate {
  return { ...SEONGNAM_CANDIDATE, ...values };
}

function readSummary(
  result: ReturnType<typeof reviewPublicRentalSources>,
  source: (typeof result.summaries)[number]["source"],
) {
  const summary = result.summaries.find((candidate) => candidate.source === source);
  if (!summary) throw new Error(`${source} 검수 요약이 없습니다.`);
  return summary;
}
