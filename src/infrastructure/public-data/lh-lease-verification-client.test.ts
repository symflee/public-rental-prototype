import { expect, test, vi } from "vitest";

import {
  collectSeongnamLhLeaseVerificationRecords,
  type PublicDataHttpResponse,
} from "./lh-lease-verification-client";

const SERVICE_KEY = "decoded-key";

test("경기도 전체 페이지를 순회하고 성남시 행만 반환한다", async () => {
  const fetchFunction = createPaginatedFetch();

  const result = await collectSeongnamLhLeaseVerificationRecords({
    fetchFunction,
    pageSize: 2,
    serviceKey: SERVICE_KEY,
  });

  expect(result.collectionIssues).toEqual([]);
  expect(result.records.map((record) => record.SBD_LGO_NM)).toEqual(["성남 A", "성남 B"]);
  expect(readRequestedPages(fetchFunction)).toEqual(["1", "2"]);
});

test("LH 결과 코드가 실패이면 검수 문제로 반환한다", async () => {
  const fetchFunction = vi.fn(async () =>
    createResponse([{ dsSch: [] }, { dsList: [], resHeader: [{ SS_CODE: "N" }] }]),
  );

  const result = await collectSeongnamLhLeaseVerificationRecords({
    fetchFunction,
    serviceKey: SERVICE_KEY,
  });

  expect(result.records).toEqual([]);
  expect(result.collectionIssues[0]?.kind).toBe("api-error");
});

function createPaginatedFetch() {
  return vi.fn(async (input: string | URL) => createPageResponse(new URL(input)));
}

function createPageResponse(url: URL) {
  expect(url.searchParams.get("CNP_CD")).toBe("41");
  expect(url.searchParams.get("PG_SZ")).toBe("2");
  expect(url.searchParams.get("ServiceKey")).toBe(SERVICE_KEY);
  if (url.searchParams.get("PAGE") === "1") return createFirstPage();
  return createSecondPage();
}

function createFirstPage() {
  return createLhResponse([
    createRecord("경기도 성남시 분당구", "성남 A"),
    createRecord("경기도 수원시 영통구", "수원 A"),
  ]);
}

function createSecondPage() {
  return createLhResponse([createRecord("경기도 성남시 수정구", "성남 B")]);
}

function createLhResponse(records: ReadonlyArray<object>) {
  return createResponse([
    { dsSch: [{ TOTAL_COUNT: 3 }] },
    { dsList: records, resHeader: [{ SS_CODE: "Y" }] },
  ]);
}

function createRecord(areaName: string, complexName: string) {
  return {
    AIS_TP_CD_NM: "국민임대",
    ARA_NM: areaName,
    SBD_LGO_NM: complexName,
    SUM_HSH_CNT: 100,
  };
}

function createResponse(payload: unknown): PublicDataHttpResponse {
  return { json: async () => payload, ok: true, status: 200 };
}

function readRequestedPages(fetchFunction: ReturnType<typeof createPaginatedFetch>) {
  return fetchFunction.mock.calls.map(([input]) => new URL(input).searchParams.get("PAGE"));
}
