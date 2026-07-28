import { describe, expect, test } from "vitest";

import { normalizeMyHomeRecords, type MyHomeRawRecord } from "./my-home-normalizer";
import type { PublicRentalLocation } from "./public-rental-location";

const BASE_RECORD: MyHomeRawRecord = {
  hsmpSn: "12345",
  hsmpNm: "성남 국민임대",
  insttNm: "한국토지주택공사",
  rnAdres: "경기도 성남시 분당구 판교로 123",
  pnu: "4113510900100010000",
  competDe: "2020-01-31",
  hshldCo: "500",
  suplyTyNm: "국민임대",
  suplyPrvuseAr: "36.70",
  suplyCmnuseAr: "18.30",
  bassRentGtn: "12,000,000",
  bassMtRntchrg: "180,000",
};

describe("normalizeMyHomeRecords 단지 병합", () => {
  test("같은 단지의 주택형을 하나의 위치와 여러 공급조건으로 묶는다", testGrouping);
});

describe("normalizeMyHomeRecords 포함 규칙", () => {
  test("구체적인 주소가 있는 매입임대 건물을 별도 위치 유형으로 분류한다", testPurchase);
});

describe("normalizeMyHomeRecords 제외 규칙", () => {
  test("LH가 아니거나 법정 공공임대 운영 재고가 아닌 행을 제외한다", testExclusions);
  test("주소가 없거나 시 단위로만 집계된 행을 제외한다", testAddressExclusions);
  test("준공일이 기준일 이후인 단지를 제외한다", testFutureCompletion);
});

function testGrouping() {
  const firstOffering = createOfferingRecord("36.70", "12,000,000");
  const secondOffering = createOfferingRecord("46.70", "18,000,000");
  const locations = normalizeMyHomeRecords([firstOffering, secondOffering]);

  expectGroupedLocation(locations.values[0]);
  expect(locations.values[0]?.offerings).toHaveLength(2);
}

function testPurchase() {
  const record = createRecord({
    hsmpSn: "purchase-1",
    insttNm: "LH경기남부지역본부",
    suplyTyNm: "매입임대",
  });
  const locations = normalizeMyHomeRecords([record]);

  expect(locations.values[0]).toMatchObject({
    kind: "PURCHASE_RENTAL_BUILDING",
    legalCategories: ["PURCHASE_RENTAL"],
  });
}

function testExclusions() {
  const records = [
    createRecord(),
    createRecord({ hsmpSn: "gh", insttNm: "경기주택도시공사" }),
    createRecord({ hsmpSn: "sale", suplyTyNm: "공공분양" }),
    createRecord({ hsmpSn: "planned", statusName: "사업계획" }),
    createRecord({ hsmpSn: "jeonse", suplyTyNm: "전세임대" }),
  ];
  const locations = normalizeMyHomeRecords(records);

  expect(locations.values.map((location) => location.id)).toEqual(["12345"]);
}

function testAddressExclusions() {
  const records = [
    createRecord({ hsmpSn: "missing-address", rnAdres: "" }),
    createRecord({ hsmpSn: "city-summary", rnAdres: "경기도 성남시" }),
  ];
  const locations = normalizeMyHomeRecords(records);

  expect(locations.values).toHaveLength(0);
}

function testFutureCompletion() {
  const record = createRecord({ hsmpSn: "future", competDe: "2099-12-31" });
  const locations = normalizeMyHomeRecords([record], "2026-07-28");

  expect(locations.values).toHaveLength(0);
}

function expectGroupedLocation(location: PublicRentalLocation | undefined) {
  expect(location).toMatchObject({
    id: "12345",
    provider: "LH",
    legalCategories: ["NATIONAL_RENTAL"],
    householdCount: 500,
  });
}

function createOfferingRecord(area: string, deposit: string) {
  return createRecord({
    suplyPrvuseAr: area,
    bassRentGtn: deposit,
  });
}

function createRecord(overrides: Partial<MyHomeRawRecord> = {}): MyHomeRawRecord {
  return { ...BASE_RECORD, ...overrides };
}
