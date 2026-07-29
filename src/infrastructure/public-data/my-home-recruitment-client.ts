import { GYEONGGI_COLLECTION_AREAS } from "@/domain/public-rental/gyeonggi-geography";

import type { PublicDataFetch, PublicDataHttpResponse } from "./public-data-http";

export type { PublicDataHttpResponse } from "./public-data-http";

const MY_HOME_RECRUITMENT_ENDPOINT = "https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList";
const DEFAULT_PAGE_SIZE = 1_000;
const GYEONGGI_AREA_CODES = GYEONGGI_COLLECTION_AREAS.map(readAreaCode);

export type MyHomeRecruitmentRawRecord = Readonly<Record<string, string>>;

export type MyHomeRecruitmentCollectionIssueKind =
  "api-error" | "http-error" | "malformed-response" | "network-error";

export type MyHomeRecruitmentCollectionIssue = Readonly<{
  areaCode: string;
  kind: MyHomeRecruitmentCollectionIssueKind;
  message: string;
  pageNumber: number;
  status?: number;
}>;

export type MyHomeRecruitmentCollectionResult = Readonly<{
  collectionIssues: readonly MyHomeRecruitmentCollectionIssue[];
  records: readonly MyHomeRecruitmentRawRecord[];
}>;

export type MyHomeRecruitmentClientConfiguration = Readonly<{
  areaCodes?: readonly string[];
  fetchFunction: PublicDataFetch;
  pageSize?: number;
  serviceKey: string;
}>;

type UnknownRecord = Record<string, unknown>;
type PageValue = Readonly<{ records: readonly MyHomeRecruitmentRawRecord[]; totalCount: number }>;
type PageFailure = Readonly<{
  kind: MyHomeRecruitmentCollectionIssueKind;
  message: string;
  status?: number;
  success: false;
}>;
type PageResult = Readonly<{ success: true; value: PageValue }> | PageFailure;
type TransportResult<T> = Readonly<{ success: true; value: T }> | PageFailure;
type CollectionContext = Readonly<{
  areaCode: string;
  collectionIssues: MyHomeRecruitmentCollectionIssue[];
  configuration: MyHomeRecruitmentClientConfiguration;
  pageSize: number;
  records: MyHomeRecruitmentRawRecord[];
}>;

export async function collectMyHomeRecruitmentRecords(
  configuration: MyHomeRecruitmentClientConfiguration,
): Promise<MyHomeRecruitmentCollectionResult> {
  const records: MyHomeRecruitmentRawRecord[] = [];
  const collectionIssues: MyHomeRecruitmentCollectionIssue[] = [];
  const pageSize = resolvePageSize(configuration.pageSize);
  const areaCodes = resolveAreaCodes(configuration.areaCodes);
  for (const areaCode of areaCodes) {
    await collectArea(configuration, areaCode, pageSize, records, collectionIssues);
  }
  return { collectionIssues, records };
}

async function collectArea(
  configuration: MyHomeRecruitmentClientConfiguration,
  areaCode: string,
  pageSize: number,
  records: MyHomeRecruitmentRawRecord[],
  collectionIssues: MyHomeRecruitmentCollectionIssue[],
) {
  const context = { areaCode, collectionIssues, configuration, pageSize, records };
  return collectAreaPage(context, 1);
}

async function collectAreaPage(context: CollectionContext, pageNumber: number): Promise<void> {
  const result = await fetchRecruitmentPage(
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
  context.collectionIssues.push({
    areaCode: context.areaCode,
    kind: failure.kind,
    message: failure.message,
    pageNumber,
    status: failure.status,
  });
}

async function fetchRecruitmentPage(
  configuration: MyHomeRecruitmentClientConfiguration,
  areaCode: string,
  pageSize: number,
  pageNumber: number,
): Promise<PageResult> {
  const url = createRecruitmentUrl(configuration.serviceKey, areaCode, pageSize, pageNumber);
  const response = await requestResponse(configuration.fetchFunction, url);
  if (!response.success) return response;
  if (!response.value.ok)
    return fail("http-error", "모집공고 API가 오류 상태를 반환했습니다.", response.value.status);
  const payload = await readResponsePayload(response.value);
  if (!payload.success) return payload;
  return parseRecruitmentPage(payload.value);
}

function createRecruitmentUrl(
  serviceKey: string,
  areaCode: string,
  pageSize: number,
  pageNumber: number,
) {
  const url = new URL(MY_HOME_RECRUITMENT_ENDPOINT);
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
    return fail("network-error", "모집공고 API 요청에 실패했습니다.");
  }
}

async function readResponsePayload(
  response: PublicDataHttpResponse,
): Promise<TransportResult<unknown>> {
  try {
    return succeed(await response.json());
  } catch {
    return fail("malformed-response", "모집공고 API 응답을 해석할 수 없습니다.");
  }
}

function parseRecruitmentPage(payload: unknown): PageResult {
  const root = readResponseRoot(payload);
  if (!root) return fail("malformed-response", "모집공고 API 응답 형식이 올바르지 않습니다.");
  if (hasNoData(root)) return succeed({ records: [], totalCount: 0 });
  if (hasApiError(root)) return fail("api-error", "모집공고 API가 오류 코드를 반환했습니다.");
  const values = readRecordValues(root);
  if (!values) return fail("malformed-response", "모집공고 목록이 없습니다.");
  const records = parseRawRecords(values);
  if (!records) return fail("malformed-response", "모집공고 데이터가 올바르지 않습니다.");
  return createPageValue(root, values, records);
}

function createPageValue(
  root: UnknownRecord,
  values: readonly unknown[],
  records: readonly MyHomeRecruitmentRawRecord[],
): PageResult {
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
  if (!payload.every(isUnknownRecord)) return undefined;
  return Object.assign({}, ...payload);
}

function hasNoData(root: UnknownRecord) {
  return readApiCode(root) === "03";
}

function hasApiError(root: UnknownRecord) {
  const code = readApiCode(root);
  if (code === undefined) return false;
  if (isSuccessfulCode(code)) return false;
  return !hasNoData(root);
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

function readRecordValues(root: UnknownRecord): readonly unknown[] | undefined {
  const direct = readItems(root);
  if (direct) return direct;
  const body = readSingleRecord(root.body);
  if (!body) return undefined;
  return readItems(body);
}

function readItems(value: UnknownRecord): readonly unknown[] | undefined {
  const item = asItemArray(value.item);
  if (item) return item;
  const items = asItemArray(value.items);
  if (items) return items;
  return readNestedItems(value.items);
}

function asItemArray(value: unknown): readonly unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (!isUnknownRecord(value)) return undefined;
  return [value];
}

function readNestedItems(value: unknown): readonly unknown[] | undefined {
  if (!isUnknownRecord(value)) return undefined;
  return asItemArray(value.item);
}

function parseRawRecords(values: readonly unknown[]) {
  if (!values.every(isUnknownRecord)) return undefined;
  return values.map(parseRawRecord);
}

function parseRawRecord(value: UnknownRecord): MyHomeRecruitmentRawRecord {
  return Object.fromEntries(Object.entries(value).flatMap(readTextEntry));
}

function readTextEntry([key, value]: [string, unknown]) {
  const text = readText(value);
  if (text === undefined) return [];
  return [[key, text]];
}

function readTotalCount(root: UnknownRecord, values: readonly unknown[]) {
  const body = readSingleRecord(root.body);
  const firstRecord = readSingleRecord(values[0]);
  const candidates = [root.totalCount, body?.totalCount, firstRecord?.totalCount];
  const totalCount = candidates.map(readCount).find(isDefined);
  if (totalCount !== undefined) return totalCount;
  if (values.length === 0) return 0;
  return undefined;
}

function readCount(value: unknown) {
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
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
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

function fail(
  kind: MyHomeRecruitmentCollectionIssueKind,
  message: string,
  status?: number,
): PageFailure {
  return { kind, message, status, success: false };
}
