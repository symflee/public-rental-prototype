import { expect, test } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import { createLhRentalCollectionReport } from "./lh-rental-collection-report";

test("원천별 수집·중복과 도시별 게시 수를 보고한다", () => {
  const location = createLocation();
  const report = createLhRentalCollectionReport({
    constructionFileName: "construction.csv",
    constructionParseIssues: [],
    constructionRecords: [{ id: "1" }, { id: "1" }],
    exclusions: [],
    generatedAt: "2026-07-28T00:00:00.000Z",
    geocodingFailures: [],
    locations: [location],
    purchaseFileName: "purchase.csv",
    purchaseParseIssues: [{ code: "MALFORMED_ROW" }],
    purchaseRecords: [{ id: "2" }],
    roadLevelWarnings: [],
    warnings: [],
  });

  expect(report.sources.construction).toMatchObject({
    duplicateRowCount: 1,
    recordCount: 2,
  });
  expect(report.sources.purchase.parseIssues).toHaveLength(1);
  expect(report.publication.municipalities.SEONGNAM).toBe(1);
  expect(report.status).toBe("blocked");
});

function createLocation(): PublicRentalLocation {
  return {
    addressAliases: ["경기도 성남시 수정구 단대로23번길 36"],
    completionDate: null,
    coordinate: {
      latitude: 37.449,
      longitude: 127.161,
      source: "KAKAO_ADDRESS_SEARCH",
    },
    district: "수정구",
    householdCount: 1,
    id: "lh:seongnam:test",
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories: ["NATIONAL_RENTAL"],
    municipality: "SEONGNAM",
    name: "테스트",
    offerings: [],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    roadAddress: "경기도 성남시 수정구 단대로23번길 36",
    sourceRecords: [],
  };
}
