import type { PublicDataFetch, PublicDataHttpResponse } from "./public-data-http";
import type { MyHomeRawRecord } from "@/domain/public-rental";

export type { PublicDataHttpResponse } from "./public-data-http";
export type { MyHomeRawRecord } from "@/domain/public-rental";

const MY_HOME_ENDPOINT = "https://apis.data.go.kr/1613000/HWSPR04/rentalHouseGwList";
const SEONGNAM_DISTRICT_CODES = ["131", "133", "135"] as const;
const DEFAULT_PAGE_SIZE = 1_000;
const MY_HOME_RAW_FIELDS = [
  "hsmpSn",
  "insttNm",
  "hsmpNm",
  "rnAdres",
  "pnu",
  "competDe",
  "hshldCo",
  "suplyTyNm",
  "styleNm",
  "suplyPrvuseAr",
  "suplyCmnuseAr",
  "bassRentGtn",
  "bassMtRntchrg",
  "statusName",
  "dataStdrDe",
] as const satisfies ReadonlyArray<keyof MyHomeRawRecord>;

export type MyHomeDistrictCode = (typeof SEONGNAM_DISTRICT_CODES)[number];
type MyHomeRawField = (typeof MY_HOME_RAW_FIELDS)[number];

export type MyHomeCollectionIssueKind =
  "api-error" | "http-error" | "malformed-response" | "network-error";

export type MyHomeCollectionIssue = Readonly<{
  districtCode: MyHomeDistrictCode;
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
  fetchFunction: PublicDataFetch;
  pageSize?: number;
  serviceKey: string;
}>;

type PageValue = Readonly<{
  records: ReadonlyArray<MyHomeRawRecord>;
  totalCount: number;
}>;

type DistrictCollectionContext = Readonly<{
  collectionIssues: MyHomeCollectionIssue[];
  configuration: MyHomeClientConfiguration;
  districtCode: MyHomeDistrictCode;
  pageSize: number;
  records: MyHomeRawRecord[];
}>;

type PageFailure = Readonly<{
  kind: MyHomeCollectionIssueKind;
  message: string;
  status?: number;
  success: false;
}>;

type PageResult = Readonly<{ success: true; value: PageValue }> | PageFailure;

type TransportResult<T> = Readonly<{ success: true; value: T }> | PageFailure;

type UnknownRecord = Record<string, unknown>;

export async function collectMyHomePublicRentalRecords(
  configuration: MyHomeClientConfiguration,
): Promise<MyHomeCollectionResult> {
  const records: MyHomeRawRecord[] = [];
  const collectionIssues: MyHomeCollectionIssue[] = [];
  const pageSize = resolvePageSize(configuration.pageSize);
  for (const districtCode of SEONGNAM_DISTRICT_CODES) {
    await collectDistrict(configuration, districtCode, pageSize, records, collectionIssues);
  }
  return { collectionIssues, records };
}

async function collectDistrict(
  configuration: MyHomeClientConfiguration,
  districtCode: MyHomeDistrictCode,
  pageSize: number,
  records: MyHomeRawRecord[],
  collectionIssues: MyHomeCollectionIssue[],
) {
  const context = { collectionIssues, configuration, districtCode, pageSize, records };
  return collectDistrictPage(context, 1);
}

async function collectDistrictPage(
  context: DistrictCollectionContext,
  pageNumber: number,
): Promise<void> {
  const result = await fetchMyHomePage(
    context.configuration,
    context.districtCode,
    context.pageSize,
    pageNumber,
  );
  if (!result.success) return recordContextIssue(result, context, pageNumber);
  return collectNextDistrictPage(result.value, context, pageNumber);
}

async function collectNextDistrictPage(
  value: PageValue,
  context: DistrictCollectionContext,
  pageNumber: number,
) {
  context.records.push(...value.records);
  if (!hasNextPage(value.totalCount, context.pageSize, pageNumber)) return;
  return collectDistrictPage(context, pageNumber + 1);
}

function recordContextIssue(
  failure: PageFailure,
  context: DistrictCollectionContext,
  pageNumber: number,
) {
  return recordIssue(failure, context.districtCode, pageNumber, context.collectionIssues);
}

async function fetchMyHomePage(
  configuration: MyHomeClientConfiguration,
  districtCode: MyHomeDistrictCode,
  pageSize: number,
  pageNumber: number,
): Promise<PageResult> {
  const url = createMyHomeUrl(configuration.serviceKey, districtCode, pageSize, pageNumber);
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
  districtCode: MyHomeDistrictCode,
  pageSize: number,
  pageNumber: number,
) {
  const url = new URL(MY_HOME_ENDPOINT);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("brtcCode", "41");
  url.searchParams.set("signguCode", districtCode);
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

function hasApiError(root: UnknownRecord) {
  const code = readText(root.code);
  if (code !== undefined) return !isSuccessfulCode(code);
  const header = readSingleRecord(root.header);
  const resultCode = readText(header?.resultCode);
  if (resultCode === undefined) return false;
  return !isSuccessfulCode(resultCode);
}

function isSuccessfulCode(code: string) {
  return code === "0" || code === "00" || code === "000";
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

function hasNextPage(totalCount: number, pageSize: number, pageNumber: number) {
  return pageNumber * pageSize < totalCount;
}

function recordIssue(
  failure: PageFailure,
  districtCode: MyHomeDistrictCode,
  pageNumber: number,
  collectionIssues: MyHomeCollectionIssue[],
) {
  collectionIssues.push({
    districtCode,
    kind: failure.kind,
    message: failure.message,
    pageNumber,
    status: failure.status,
  });
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
