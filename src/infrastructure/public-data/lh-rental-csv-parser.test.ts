import { describe, expect, test } from "vitest";

import {
  decodeLhRentalCsvBytes,
  parseLhConstructionRentalCsv,
  parseLhPurchaseRentalCsv,
} from "./lh-rental-csv-parser";

describe("LH 임대주택 CSV 디코딩", () => {
  test("UTF-8과 CP949 바이트를 모두 문자열로 변환한다", () => {
    const utf8 = new TextEncoder().encode("성남시");
    const cp949 = Uint8Array.from([0xbc, 0xba, 0xb3, 0xb2, 0xbd, 0xc3]);

    expect(decodeLhRentalCsvBytes(utf8)).toBe("성남시");
    expect(decodeLhRentalCsvBytes(cp949)).toBe("성남시");
  });
});

describe("LH 건설임대 CSV 파싱", () => {
  test("인용부호 안의 쉼표와 줄바꿈을 보존한다", () => {
    const csv = [
      constructionHeaders(),
      'C00023,"성남, 백현\n3단지",경기도 성남시 분당구 동판교로,92,2020-01-01,,국민임대,39A,39.6,100,건설',
    ].join("\n");

    const result = parseLhConstructionRentalCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.records[0]).toMatchObject({
      complexCode: "C00023",
      complexName: "성남, 백현\n3단지",
      detailAddress: "92",
      supplyTypeName: "국민임대",
    });
  });

  test("필수 헤더가 없으면 행을 반환하지 않는다", () => {
    const result = parseLhConstructionRentalCsv("단지명,주소\n테스트,주소");

    expect(result.records).toEqual([]);
    expect(result.issues[0]?.code).toBe("MISSING_HEADERS");
  });
});

describe("LH 매입임대 CSV 파싱", () => {
  test("BOM을 제거하고 헤더 이름으로 원문 필드를 변환한다", () => {
    const csv = [
      `\uFEFF${purchaseHeaders()}`,
      "7,기존주택매입임대,경기도 용인시 수지구 테스트로 7,기존주택매입임대,46.2,2,2019-01-01,,2020",
    ].join("\r\n");

    const result = parseLhPurchaseRentalCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.records[0]).toEqual({
      address: "경기도 용인시 수지구 테스트로 7",
      buildingApprovalDate: "2019-01-01",
      complexName: "기존주택매입임대",
      householdCount: "2",
      productReplacementDate: "",
      purchaseYear: "2020",
      sequence: "7",
      supplyAreaSquareMeters: "46.2",
      supplyTypeName: "기존주택매입임대",
    });
  });
});

function constructionHeaders() {
  return "단지코드,단지명,주소,상세주소,준공일자,매입일자,공급유형,형명,공급면적,세대수,구분";
}

function purchaseHeaders() {
  return "순번,단지명,주소,공급유형,공급면적,세대수,건축사용승인일자,제품대체일자,매입년도";
}
