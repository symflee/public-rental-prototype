import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  decodeLhRentalCsvBytes,
  parseLhConstructionRentalCsv,
  parseLhPurchaseRentalCsv,
  type LhConstructionRentalCsvRecord,
  type LhPurchaseRentalCsvRecord,
} from "./lh-rental-csv-parser";
import { normalizeLhRentalCsvRecords } from "./lh-rental-csv-normalizer";

const CONSTRUCTION_RECORD: LhConstructionRentalCsvRecord = {
  address: "경기도 성남시 분당구 동판교로",
  classification: "건설",
  completionDate: "3011-11-11",
  complexCode: "C00023",
  complexName: "성남판교 백현 3단지",
  detailAddress: "92 (백현마을)",
  householdCount: "100",
  purchaseDate: "",
  styleName: "39A",
  supplyAreaSquareMeters: "39.6",
  supplyTypeName: "국민임대",
};

const PURCHASE_RECORD: LhPurchaseRentalCsvRecord = {
  address: "경기도 성남시 분당구 동판교로 92(백현동, 백현마을)",
  buildingApprovalDate: "2010-01-01",
  complexName: "기존주택매입임대(성남시)",
  householdCount: "2",
  productReplacementDate: "",
  purchaseYear: "2020",
  sequence: "7",
  supplyAreaSquareMeters: "46.2",
  supplyTypeName: "기존주택매입임대",
};

describe("LH CSV 주소와 위치 정규화", () => {
  test("주소와 상세주소를 결합하고 같은 물리 주소를 핀 하나로 묶는다", async () => {
    const result = await normalizeLhRentalCsvRecords({
      asOfDate: "2026-07-28",
      constructionRecords: [CONSTRUCTION_RECORD, createSecondOffering()],
      purchaseRecords: [PURCHASE_RECORD],
    });

    expect(result.locations.values).toHaveLength(1);
    expect(result.locations.values[0]).toMatchObject({
      addressAliases: expect.arrayContaining([
        "경기도 성남시 분당구 동판교로 92",
        "경기도 성남시 분당구 동판교로 92(백현동, 백현마을)",
      ]),
      district: "분당구",
      householdCount: 152,
      legalCategories: ["NATIONAL_RENTAL", "PURCHASE_RENTAL"],
      municipality: "SEONGNAM",
      roadAddress: "경기도 성남시 분당구 동판교로 92",
    });
    expect(result.locations.values[0]?.properties).toHaveLength(2);
    expect(result.locations.values[0]?.offerings).toHaveLength(3);
  });

  test("주소 SHA-256 앞 16자리로 입력 순서와 무관한 ID를 만든다", async () => {
    const input = {
      asOfDate: "2026-07-28",
      constructionRecords: [CONSTRUCTION_RECORD, createSecondOffering()],
      purchaseRecords: [PURCHASE_RECORD],
    };
    const first = await normalizeLhRentalCsvRecords(input);
    const reversed = await normalizeLhRentalCsvRecords({
      ...input,
      constructionRecords: [...input.constructionRecords].reverse(),
    });
    const address = "경기도 성남시 분당구 동판교로 92";
    const hash = createHash("sha256").update(address).digest("hex").slice(0, 16);

    expect(first.locations.values[0]?.id).toBe(`lh:seongnam:${hash}`);
    expect(reversed.locations.values[0]?.id).toBe(first.locations.values[0]?.id);
  });

  test("지번 사이의 아파트 설명을 제거하고 원문은 주소 별칭으로 보존한다", () => {
    const record = {
      ...CONSTRUCTION_RECORD,
      address: "경기 용인시 기흥구 상갈동 금화마을주공아파트 480번지",
      complexCode: "C00286",
      supplyTypeName: "공공임대(5년)",
    };

    const result = normalizeLhRentalCsvRecords({
      asOfDate: "2026-07-28",
      constructionRecords: [record],
      purchaseRecords: [],
    });

    expect(result.locations.values[0]).toMatchObject({
      addressAliases: expect.arrayContaining([
        "경기도 용인시 기흥구 상갈동 금화마을주공아파트 480번지",
      ]),
      roadAddress: "경기도 용인시 기흥구 상갈동 480번지",
    });
  });
});

describe("LH CSV 포함·제외 규칙", () => {
  test("지원 유형만 남기고 미래·불완전 주소·검수 유형을 격리한다", async () => {
    const result = await normalizeLhRentalCsvRecords({
      asOfDate: "2026-07-28",
      constructionRecords: [
        CONSTRUCTION_RECORD,
        createConstructionRecord("future", "행복주택", "2026-12-31"),
        createConstructionRecord("sale", "공공분양", "2020-01-01"),
        createConstructionRecord("review", "장기임대", "2020-01-01"),
        createIncompleteConstructionRecord(),
      ],
      purchaseRecords: [],
    });

    expect(result.locations.values).toHaveLength(1);
    expect(result.exclusions.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "FUTURE_PROPERTY",
        "INCOMPLETE_ADDRESS",
        "MANUAL_REVIEW_SUPPLY_TYPE",
        "UNSUPPORTED_SUPPLY_TYPE",
      ]),
    );
  });

  test("비정상 미래 준공일은 null로 바꾸되 기존 위치를 제외하지 않는다", async () => {
    const result = await normalizeLhRentalCsvRecords({
      asOfDate: "2026-07-28",
      constructionRecords: [CONSTRUCTION_RECORD],
      purchaseRecords: [],
    });

    expect(result.locations.values[0]?.completionDate).toBeNull();
    expect(result.locations.values[0]?.properties[0]?.completionDate).toBeNull();
    expect(result.warnings[0]?.code).toBe("INVALID_PROPERTY_DATE");
  });
});

test("원천 ID·면적·세대수·CSV 출처와 기준일을 보존한다", async () => {
  const result = await normalizeLhRentalCsvRecords({
    asOfDate: "2026-07-28",
    constructionRecords: [CONSTRUCTION_RECORD],
    purchaseRecords: [PURCHASE_RECORD],
  });
  const location = result.locations.values[0];
  const construction = location?.properties.find((property) => property.sourceId === "C00023");

  expect(construction?.sourceRecords[0]).toEqual({
    referenceDate: "2025-09-18",
    source: "LH_CONSTRUCTION_RENTAL_CSV",
    sourceId: "C00023",
    sourceUrl: "https://www.data.go.kr/data/15050700/fileData.do",
  });
  expect(construction?.offerings[0]).toMatchObject({
    householdCount: 100,
    sourceId: "C00023:국민임대:39A:39.6:100",
    supplyAreaSquareMeters: 39.6,
  });
});

test("실제 CSV에서 성남 87곳과 용인 182곳을 만든다", async () => {
  const records = await readRealCsvRecords();
  const result = await normalizeLhRentalCsvRecords({
    ...records,
    asOfDate: "2026-07-28",
  });

  expect(countMunicipality(result, "SEONGNAM")).toBe(87);
  expect(countMunicipality(result, "YONGIN")).toBe(182);
  expect(result.locations.values).toHaveLength(269);
  expect(countSourceLocations(result, "LH_CONSTRUCTION_RENTAL_CSV")).toEqual([38, 30]);
  expect(countSourceLocations(result, "LH_PURCHASE_RENTAL_CSV")).toEqual([49, 152]);
  expect(readIncompleteAddressProfile(result)).toEqual({ addresses: 5, rows: 10 });
  expect(readExcludedConstructionCodes(result, "INCOMPLETE_ADDRESS")).toHaveLength(3);
  expect(readExcludedConstructionCodes(result, "FUTURE_PROPERTY")).toHaveLength(2);
  expect(result.warnings.some((issue) => issue.code === "ROAD_LEVEL_ADDRESS_PRECISION")).toBe(true);
});

function createSecondOffering(): LhConstructionRentalCsvRecord {
  return {
    ...CONSTRUCTION_RECORD,
    householdCount: "50",
    styleName: "46A",
    supplyAreaSquareMeters: "46.8",
  };
}

function createConstructionRecord(
  complexCode: string,
  supplyTypeName: string,
  completionDate: string,
): LhConstructionRentalCsvRecord {
  return {
    ...CONSTRUCTION_RECORD,
    completionDate,
    complexCode,
    supplyTypeName,
  };
}

function createIncompleteConstructionRecord(): LhConstructionRentalCsvRecord {
  return {
    ...CONSTRUCTION_RECORD,
    address: "경기도 성남시 분당구 백현동",
    complexCode: "incomplete",
    detailAddress: "",
  };
}

async function readRealCsvRecords() {
  const directory = path.resolve(process.cwd(), "data");
  const fileNames = await readdir(directory);
  const construction = findFileName(fileNames, "_건설_20250918.csv");
  const purchase = findFileName(fileNames, "_매입_20220127.csv");
  return {
    constructionRecords: await readConstructionRecords(directory, construction),
    purchaseRecords: await readPurchaseRecords(directory, purchase),
  };
}

function findFileName(fileNames: readonly string[], suffix: string) {
  const fileName = fileNames.find((candidate) => candidate.normalize("NFC").endsWith(suffix));
  if (!fileName) throw new Error(`CSV 파일을 찾을 수 없습니다: ${suffix}`);
  return fileName;
}

async function readConstructionRecords(directory: string, fileName: string) {
  const bytes = await readFile(path.join(directory, fileName));
  const text = decodeLhRentalCsvBytes(bytes);
  return parseLhConstructionRentalCsv(text).records;
}

async function readPurchaseRecords(directory: string, fileName: string) {
  const bytes = await readFile(path.join(directory, fileName));
  const text = decodeLhRentalCsvBytes(bytes);
  return parseLhPurchaseRentalCsv(text).records;
}

function countMunicipality(
  result: Awaited<ReturnType<typeof normalizeLhRentalCsvRecords>>,
  municipality: "SEONGNAM" | "YONGIN",
) {
  return result.locations.values.filter((location) => location.municipality === municipality)
    .length;
}

function countSourceLocations(
  result: Awaited<ReturnType<typeof normalizeLhRentalCsvRecords>>,
  source: "LH_CONSTRUCTION_RENTAL_CSV" | "LH_PURCHASE_RENTAL_CSV",
) {
  return ["SEONGNAM", "YONGIN"].map(
    (municipality) =>
      result.locations.values.filter(
        (location) =>
          location.municipality === municipality &&
          location.sourceRecords.some((record) => record.source === source),
      ).length,
  );
}

function readIncompleteAddressProfile(
  result: Awaited<ReturnType<typeof normalizeLhRentalCsvRecords>>,
) {
  const issues = result.exclusions.filter((issue) => issue.code === "INCOMPLETE_ADDRESS");
  const purchaseIssues = issues.filter((issue) => issue.sourceKind === "purchase");
  return {
    addresses: new Set(purchaseIssues.map((issue) => issue.address)).size,
    rows: purchaseIssues.length,
  };
}

function readExcludedConstructionCodes(
  result: Awaited<ReturnType<typeof normalizeLhRentalCsvRecords>>,
  code: "FUTURE_PROPERTY" | "INCOMPLETE_ADDRESS",
) {
  const issues = result.exclusions.filter((issue) => issue.code === code);
  return [
    ...new Set(issues.filter((issue) => issue.sourceKind === "construction").map(readSourceId)),
  ];
}

function readSourceId(issue: { sourceId: string }) {
  return issue.sourceId;
}
