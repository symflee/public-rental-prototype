import { expect, test, vi } from "vitest";

import {
  collectMyHomeRecruitmentRecords,
  type PublicDataHttpResponse,
} from "./my-home-recruitment-client";

const SERVICE_KEY = "decoded service key+/=";

test("경기도 시군구별 모집공고의 모든 페이지와 원본 필드를 수집한다", async () => {
  const fetchFunction = createPaginatedFetch();
  const result = await collectMyHomeRecruitmentRecords({
    areaCodes: ["131", "133"],
    fetchFunction,
    pageSize: 2,
    serviceKey: SERVICE_KEY,
  });

  expect(readNoticeIdentifiers(result.records)).toEqual(["131-1", "131-2", "131-3", "133-1"]);
  expect(result.records[0]?.additionalField).toBe("preserved");
  expect(result.collectionIssues).toEqual([]);
  expect(readRequestedPages(fetchFunction)).toEqual(["131:1", "131:2", "133:1"]);
});

test("데이터가 없는 시군구는 실패 없이 건너뛴다", async () => {
  const fetchFunction = vi.fn(async () => createNoDataResponse());
  const result = await collectMyHomeRecruitmentRecords({
    areaCodes: ["150"],
    fetchFunction,
    serviceKey: SERVICE_KEY,
  });

  expect(result).toEqual({ collectionIssues: [], records: [] });
});

test("인증 오류를 기록하되 서비스 키를 노출하지 않는다", async () => {
  const fetchFunction = vi.fn(async () => createResponse({ code: "500", msg: SERVICE_KEY }));
  const result = await collectMyHomeRecruitmentRecords({
    areaCodes: ["131"],
    fetchFunction,
    serviceKey: SERVICE_KEY,
  });

  expect(result.collectionIssues.map((issue) => issue.kind)).toEqual(["api-error"]);
  expect(JSON.stringify(result.collectionIssues)).not.toContain(SERVICE_KEY);
});

function createPaginatedFetch() {
  return vi.fn(async (input: string | URL) => createPaginatedResponse(new URL(input)));
}

function createPaginatedResponse(url: URL) {
  expectCommonParameters(url);
  const areaCode = url.searchParams.get("signguCode");
  const pageNumber = url.searchParams.get("pageNo");
  if (areaCode === "131") return createSujeongResponse(pageNumber);
  return createRecruitmentResponse([createRecord("133-1")], 1);
}

function createSujeongResponse(pageNumber: string | null) {
  if (pageNumber === "1")
    return createRecruitmentResponse([createRecord("131-1"), createRecord("131-2")], 3);
  return createRecruitmentResponse([createRecord("131-3")], 3);
}

function createRecord(identifier: string) {
  return {
    additionalField: "preserved",
    hsmpNm: `단지 ${identifier}`,
    hsmpSn: identifier,
    insttNm: "한국토지주택공사",
    rcritPblancSn: identifier,
  };
}

function createRecruitmentResponse(records: ReadonlyArray<object>, totalCount: number) {
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
  return { json: async () => payload, ok: status >= 200 && status < 300, status };
}

function expectCommonParameters(url: URL) {
  expect(url.origin).toBe("https://apis.data.go.kr");
  expect(url.pathname).toBe("/1613000/HWSPR02/rsdtRcritNtcList");
  expect(url.searchParams.get("serviceKey")).toBe(SERVICE_KEY);
  expect(url.searchParams.get("brtcCode")).toBe("41");
  expect(url.searchParams.get("numOfRows")).toBe("2");
}

function readNoticeIdentifiers(records: readonly Record<string, string>[]) {
  return records.flatMap((record) => record.rcritPblancSn ?? []).sort();
}

function readRequestedPages(fetchFunction: ReturnType<typeof createPaginatedFetch>) {
  return fetchFunction.mock.calls.map(([input]) => readRequestedPage(new URL(input)));
}

function readRequestedPage(url: URL) {
  return `${url.searchParams.get("signguCode")}:${url.searchParams.get("pageNo")}`;
}
