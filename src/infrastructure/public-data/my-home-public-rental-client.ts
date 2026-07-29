import { GYEONGGI_COLLECTION_AREAS } from "@/domain/public-rental/gyeonggi-geography";
import type { MyHomeRawRecord } from "@/domain/public-rental";

import type { PublicDataFetch, PublicDataHttpResponse } from "./public-data-http";

export type { PublicDataHttpResponse } from "./public-data-http";
export type { MyHomeRawRecord } from "@/domain/public-rental";

const MY_HOME_ENDPOINT = "https://apis.data.go.kr/1613000/HWSPR04/rentalHouseGwList";
const DEFAULT_PAGE_SIZE = 1_000;
const GYEONGGI_AREA_CODES = GYEONGGI_COLLECTION_AREAS.map(readAreaCode);
const MY_HOME_RAW_FIELDS = [
  "hsmpSn",
  "insttNm",
  "hsmpNm",
  "rnAdres",
  "pnu",
  "competDe",
  "hshldCo",
  "suplyTyNm",
  "houseTyNm",
  "styleNm",
  "suplyPrvuseAr",
  "suplyCmnuseAr",
  "bassRentGtn",
  "bassMtRntchrg",
  "statusName",
  "dataStdrDe",
] as const satisfies ReadonlyArray<keyof MyHomeRawRecord>;

type MyHomeRawField = (typeof MY_HOME_RAW_FIELDS)[number];
type UnknownRecord = Record<string, unknown>;
type PageValue = Readonly<{ records: ReadonlyArray<MyHomeRawRecord>; totalCount: number }>;
type PageFailure = Readonly<{
  kind: MyHomeCollectionIssueKind;
  message: string;
  status?: number;
  success: false;
}>;
type PageResult = Readonly<{ success: true; value: PageValue }> | PageFailure;
type TransportResult<T> = Readonly<{ success: true; value: T }> | PageFailure;
type CollectionContext = Readonly<{
  areaCode: string;
  collectionIssues: MyHomeCollectionIssue[];
  configuration: MyHomeClientConfiguration;
  pageSize: number;
  records: MyHomeRawRecord[];
}>;

export type MyHomeCollectionIssueKind =
  "api-error" | "http-error" | "malformed-response" | "network-error";

export type MyHomeCollectionIssue = Readonly<{
  areaCode: string;
  kind: MyHomeCollectionIssueKind;
  message: string;
  pageNumber: number;
  status?: number;
}>;

export type MyHomeCollectionResult = Readonly<{
  collectionIssues: ReadonlyArray<MyHomeCollectionIssue>;
  records: ReadonlyArray<MyHomeRawRecord>;
}>;

export type MyHomeClientConfiguration = Readonly<{
  areaCodes?: readonly string[];
  fetchFunction: PublicDataFetch;
  pageSize?: number;
  serviceKey: string;
}>;

export async function collectMyHomePublicRentalRecords(
  configuration: MyHomeClientConfiguration,
): Promise<MyHomeCollectionResult> {
  const records: MyHomeRawRecord[] = [];
  const collectionIssues: MyHomeCollectionIssue[] = [];
  const pageSize = resolvePageSize(configuration.pageSize);
  const areaCodes = resolveAreaCodes(configuration.areaCodes);
  for (const areaCode of areaCodes) {
    await collectArea(configuration, areaCode, pageSize, records, collectionIssues);
  }
  return { collectionIssues, records };
}

async function collectArea(
  configuration: MyHomeClientConfiguration,
  areaCode: string,
  pageSize: number,
  records: MyHomeRawRecord[],
  collectionIssues: MyHomeCollectionIssue[],
) {
  const context = { areaCode, collectionIssues, configuration, pageSize, records };
  return collectAreaPage(context, 1);
}

async function collectAreaPage(context: CollectionContext, pageNumber: number): Promise<void> {
  const result = await fetchMyHomePage(
    context.configuration,
    context.areaCode,
    context.pageSize,
    pageNumber,
  );
  if (!result.success) return recordContextIssue(result, context, pageNumber);
  return collectNextAreaPage(result.value, context, pageNumber);
}

async function collectNextAreaPage(
  value: PageValue,
  context: CollectionContext,
  pageNumber: number,
) {
  context.records.push(...value.records);
  if (!hasNextPage(value.totalCount, context.pageSize, pageNumber)) return;
  return collectAreaPage(context, pageNumber + 1);
}

function recordContextIssue(failure: PageFailure, context: CollectionContext, pageNumber: number) {
  return recordIssue(failure, context.areaCode, pageNumber, context.collectionIssues);
}

async function fetchMyHomePage(
  configuration: MyHomeClientConfiguration,
  areaCode: string,
  pageSize: number,
  pageNumber: number,
): Promise<PageResult> {
  const url = createMyHomeUrl(configuration.serviceKey, areaCode, pageSize, pageNumber);
  const response = await requestResponse(configuration.fetchFunction, url);
  if (!response.success) return response;
  const validResponse = validateResponse(response.value);
  if (!validResponse.success) return validResponse;
  const payload = await readResponsePayload(response.value);
  if (!payload.success) return payload;
  return parseMyHomePage(payload.value);
}

function createMyHomeUrl(
  serviceKey: string,
  areaCode: string,
  pageSize: number,
  pageNumber: number,
) {
  const url = new URL(MY_HOME_ENDPOINT);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("brtcCode", "41");
  url.searchParams.set("signguCode", areaCode);
  url.searchParams.set("numOfRows", String(pageSize));
  url.searchParams.set("pageNo", String(pageNumber));
  return url;
}

async function requestResponse(
  fetchFunction: PublicDataFetch,
  url: URL,
): Promise<TransportResult<PublicDataHttpResponse>> {
  try {
    return succeed(await fetchFunction(url));
  } catch {
    return fail("network-error", "마이홈 API 요청에 실패했습니다.");
  }
}

function validateResponse(
  response: PublicDataHttpResponse,
): TransportResult<PublicDataHttpResponse> {
  if (response.ok) return succeed(response);
  return fail("http-error", "마이홈 API가 오류 상태를 반환했습니다.", response.status);
}

async function readResponsePayload(
  response: PublicDataHttpResponse,
): Promise<TransportResult<unknown>> {
  try {
    return succeed(await response.json());
  } catch {
    return fail("malformed-response", "마이홈 API 응답을 해석할 수 없습니다.");
  }
}

function parseMyHomePage(payload: unknown): PageResult {
  const root = readResponseRoot(payload);
  if (!root) return fail("malformed-response", "마이홈 API 응답 형식이 올바르지 않습니다.");
  if (hasNoData(root)) return succeed({ records: [], totalCount: 0 });
  if (hasApiError(root)) return fail("api-error", "마이홈 API가 오류 코드를 반환했습니다.");
  const values = readRecordValues(root);
  if (!values) return fail("malformed-response", "마이홈 단지 목록이 없습니다.");
  const records = parseRawRecords(values);
  if (!records) return fail("malformed-response", "마이홈 단지 데이터가 올바르지 않습니다.");
  const totalCount = readTotalCount(root, values);
  if (totalCount === undefined) return fail("malformed-response", "전체 결과 수가 없습니다.");
  return succeed({ records, totalCount });
}

function readResponseRoot(payload: unknown): UnknownRecord | undefined {
  const combined = combineArrayEnvelope(payload);
  if (combined) return combined;
  if (!isUnknownRecord(payload)) return undefined;
  if (isUnknownRecord(payload.response)) return payload.response;
  return payload;
}

function combineArrayEnvelope(payload: unknown): UnknownRecord | undefined {
  if (!Array.isArray(payload)) return undefined;
  const records = payload.filter(isUnknownRecord);
  if (records.length !== payload.length) return undefined;
  return Object.assign({}, ...records);
}

function hasNoData(root: UnknownRecord) {
  return readApiCode(root) === "03";
}

function hasApiError(root: UnknownRecord) {
  const code = readApiCode(root);
  if (code === undefined) return false;
  return !isSuccessfulCode(code) && !isNoDataCode(code);
}

function readApiCode(root: UnknownRecord) {
  const topLevelCode = readText(root.code);
  if (topLevelCode !== undefined) return topLevelCode;
  const header = readSingleRecord(root.header);
  return readText(header?.resultCode);
}

function isSuccessfulCode(code: string) {
  return code === "0" || code === "00" || code === "000";
}

function isNoDataCode(code: string) {
  return code === "03";
}

function readRecordValues(root: UnknownRecord): ReadonlyArray<unknown> | undefined {
  if (Array.isArray(root.hsmpList)) return root.hsmpList;
  const body = readSingleRecord(root.body);
  if (!body) return undefined;
  if (Array.isArray(body.item)) return body.item;
  if (Array.isArray(body.items)) return body.items;
  return readNestedItems(body.items);
}

function readNestedItems(value: unknown): ReadonlyArray<unknown> | undefined {
  if (!isUnknownRecord(value)) return undefined;
  if (!Array.isArray(value.item)) return undefined;
  return value.item;
}

function parseRawRecords(
  values: ReadonlyArray<unknown>,
): ReadonlyArray<MyHomeRawRecord> | undefined {
  if (!values.every(isUnknownRecord)) return undefined;
  return values.map(parseRawRecord);
}

function parseRawRecord(value: UnknownRecord): MyHomeRawRecord {
  return MY_HOME_RAW_FIELDS.reduce(copyRawField(value), {});
}

function copyRawField(value: UnknownRecord) {
  return (record: Partial<Record<MyHomeRawField, string>>, field: MyHomeRawField) => {
    const text = readText(value[field]);
    if (text !== undefined) record[field] = text;
    return record;
  };
}

function readTotalCount(root: UnknownRecord, values: ReadonlyArray<unknown>): number | undefined {
  const body = readSingleRecord(root.body);
  const firstRecord = readSingleRecord(values[0]);
  const candidates = [root.totalCount, body?.totalCount, firstRecord?.totalCount];
  const totalCount = candidates.map(readCount).find(isDefined);
  if (totalCount !== undefined) return totalCount;
  if (values.length === 0) return 0;
  return undefined;
}

function readCount(value: unknown): number | undefined {
  const count = Number(readText(value));
  if (!Number.isSafeInteger(count) || count < 0) return undefined;
  return count;
}

function readSingleRecord(value: unknown): UnknownRecord | undefined {
  if (isUnknownRecord(value)) return value;
  if (!Array.isArray(value)) return undefined;
  const first = value[0];
  if (!isUnknownRecord(first)) return undefined;
  return first;
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return String(value);
}

function resolvePageSize(pageSize: number | undefined) {
  if (Number.isSafeInteger(pageSize) && Number(pageSize) > 0) return Number(pageSize);
  return DEFAULT_PAGE_SIZE;
}

function resolveAreaCodes(areaCodes: readonly string[] | undefined) {
  if (!areaCodes || areaCodes.length === 0) return GYEONGGI_AREA_CODES;
  return [...new Set(areaCodes.map(normalizeAreaCode).filter(Boolean))];
}

function normalizeAreaCode(areaCode: string) {
  return areaCode.trim();
}

function hasNextPage(totalCount: number, pageSize: number, pageNumber: number) {
  return pageNumber * pageSize < totalCount;
}

function recordIssue(
  failure: PageFailure,
  areaCode: string,
  pageNumber: number,
  collectionIssues: MyHomeCollectionIssue[],
) {
  collectionIssues.push({
    areaCode,
    kind: failure.kind,
    message: failure.message,
    pageNumber,
    status: failure.status,
  });
}

function readAreaCode(area: (typeof GYEONGGI_COLLECTION_AREAS)[number]) {
  return area.code;
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function succeed<T>(value: T): Readonly<{ success: true; value: T }> {
  return { success: true, value };
}

function fail(kind: MyHomeCollectionIssueKind, message: string, status?: number): PageFailure {
  return { kind, message, status, success: false };
}
