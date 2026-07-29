import { expect, test, vi } from "vitest";

import {
  collectMyHomePublicRentalRecords,
  type PublicDataHttpResponse,
} from "./my-home-public-rental-client";

const SERVICE_KEY = "decoded service key+/=";
const AREA_CODES = ["131", "133", "461"] as const;

test("설정한 경기도 시군구의 모든 페이지를 수집한다", async () => {
  const fetchFunction = createPaginatedFetch();

  const result = await collectMyHomePublicRentalRecords({
    areaCodes: AREA_CODES,
    fetchFunction,
    pageSize: 2,
    serviceKey: SERVICE_KEY,
  });

  expect(readRecordIdentifiers(result.records)).toEqual(["131-1", "131-2", "131-3", "133-1"]);
  expect(result.collectionIssues).toEqual([]);
  expect(readRequestedPages(fetchFunction)).toEqual(["131:1", "131:2", "133:1", "461:1"]);
});

test("데이터가 없는 시군구는 수집 실패로 처리하지 않는다", async () => {
  const fetchFunction = vi.fn(async () => createNoDataResponse());

  const result = await collectMyHomePublicRentalRecords({
    areaCodes: ["150"],
    fetchFunction,
    serviceKey: SERVICE_KEY,
  });

  expect(result).toEqual({ collectionIssues: [], records: [] });
});

test("HTTP 오류와 잘못된 응답을 기록하고 나머지 시군구를 계속 수집한다", async () => {
  const fetchFunction = createFailingFetch();

  const result = await collectMyHomePublicRentalRecords({
    areaCodes: AREA_CODES,
    fetchFunction,
    serviceKey: SERVICE_KEY,
  });

  expect(readRecordIdentifiers(result.records)).toEqual(["461-1"]);
  expect(result.collectionIssues.map((issue) => issue.kind)).toEqual([
    "http-error",
    "malformed-response",
  ]);
});

test("API 오류 코드를 인증키가 없는 수집 문제로 반환한다", async () => {
  const fetchFunction = vi.fn(async () => createResponse({ code: "500", msg: SERVICE_KEY }));

  const result = await collectMyHomePublicRentalRecords({
    areaCodes: AREA_CODES,
    fetchFunction,
    serviceKey: SERVICE_KEY,
  });

  expect(result.records).toEqual([]);
  expect(result.collectionIssues).toHaveLength(3);
  expect(JSON.stringify(result.collectionIssues)).not.toContain(SERVICE_KEY);
});

function createPaginatedFetch() {
  return vi.fn(async (input: string | URL) => createPaginatedResponse(new URL(input)));
}

function createPaginatedResponse(url: URL) {
  expectCommonMyHomeParameters(url);
  const areaCode = url.searchParams.get("signguCode");
  const pageNumber = url.searchParams.get("pageNo");
  if (areaCode === "131") return createSujeongResponse(pageNumber);
  if (areaCode === "133") return createMyHomeResponse([createRecord("133-1")], 1);
  return createMyHomeResponse([], 0);
}

function createSujeongResponse(pageNumber: string | null) {
  if (pageNumber === "1") {
    return createMyHomeResponse([createRecord("131-1"), createRecord("131-2")], 3);
  }
  return createMyHomeResponse([createRecord("131-3")], 3);
}

function createFailingFetch() {
  return vi.fn(async (input: string | URL) => createFailureResponse(new URL(input)));
}

function createFailureResponse(url: URL) {
  const areaCode = url.searchParams.get("signguCode");
  if (areaCode === "131") return createResponse({}, 503);
  if (areaCode === "133") return createResponse({ unexpected: true });
  return createMyHomeResponse([createRecord("461-1")], 1);
}

function createRecord(identifier: string) {
  return {
    bassMtRntchrg: 150_000,
    hsmpNm: `단지 ${identifier}`,
    hsmpSn: identifier,
    insttNm: "LH 경기남부지역본부",
    rnAdres: "경기도 성남시 분당구 테스트로 1",
  };
}

function createMyHomeResponse(records: ReadonlyArray<object>, totalCount: number) {
  return createResponse({
    response: {
      body: { item: records, totalCount },
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE" },
    },
  });
}

function createNoDataResponse() {
  return createResponse({ response: { header: { resultCode: "03", resultMsg: "NODATA_ERROR" } } });
}

function createResponse(payload: unknown, status = 200): PublicDataHttpResponse {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
  };
}

function expectCommonMyHomeParameters(url: URL) {
  expect(url.origin).toBe("https://apis.data.go.kr");
  expect(url.pathname).toBe("/1613000/HWSPR04/rentalHouseGwList");
  expect(url.searchParams.get("serviceKey")).toBe(SERVICE_KEY);
  expect(url.searchParams.get("brtcCode")).toBe("41");
  expect(url.searchParams.get("numOfRows")).toBe("2");
}

function readRecordIdentifiers(records: ReadonlyArray<{ hsmpSn?: string }>) {
  return records.flatMap((record) => record.hsmpSn ?? []).sort();
}

function readRequestedPages(fetchFunction: ReturnType<typeof createPaginatedFetch>) {
  return fetchFunction.mock.calls.map(([input]) => readRequestedPage(new URL(input)));
}

function readRequestedPage(url: URL) {
  return `${url.searchParams.get("signguCode")}:${url.searchParams.get("pageNo")}`;
}
