import type { PublicDataFetch, PublicDataHttpResponse } from "./public-data-http";

export type { PublicDataHttpResponse } from "./public-data-http";

const LH_LEASE_ENDPOINT = "https://apis.data.go.kr/B552555/lhLeaseInfo1/lhLeaseInfo1";
const DEFAULT_PAGE_SIZE = 1_000;
const SEONGNAM_AREA_PREFIX = "경기도 성남시";
const LH_LEASE_FIELDS = [
  "RS_DTTM",
  "RNUM",
  "ARA_NM",
  "AIS_TP_CD_NM",
  "SBD_LGO_NM",
  "SUM_HSH_CNT",
  "DDO_AR",
  "HSH_CNT",
  "LS_GMY",
  "RFE",
  "MVIN_XPC_YM",
] as const;

type LhLeaseField = (typeof LH_LEASE_FIELDS)[number];
type UnknownRecord = Record<string, unknown>;

export type LhLeaseVerificationRecord = Readonly<
  Partial<Record<LhLeaseField, string>> & {
    reviewOnly: true;
    source: "lh-lease-api";
  }
>;

export type LhLeaseCollectionIssueKind =
  "api-error" | "http-error" | "malformed-response" | "network-error";

export type LhLeaseCollectionIssue = Readonly<{
  kind: LhLeaseCollectionIssueKind;
  message: string;
  pageNumber: number;
  status?: number;
}>;

export type LhLeaseCollectionResult = Readonly<{
  collectionIssues: ReadonlyArray<LhLeaseCollectionIssue>;
  records: ReadonlyArray<LhLeaseVerificationRecord>;
}>;

export type LhLeaseClientConfiguration = Readonly<{
  fetchFunction: PublicDataFetch;
  pageSize?: number;
  serviceKey: string;
}>;

type PageValue = Readonly<{
  receivedCount: number;
  records: ReadonlyArray<LhLeaseVerificationRecord>;
  totalCount?: number;
}>;

type PageFailure = Readonly<{
  kind: LhLeaseCollectionIssueKind;
  message: string;
  status?: number;
  success: false;
}>;

type PageResult = Readonly<{ success: true; value: PageValue }> | PageFailure;

type TransportResult<T> = Readonly<{ success: true; value: T }> | PageFailure;

export async function collectSeongnamLhLeaseVerificationRecords(
  configuration: LhLeaseClientConfiguration,
): Promise<LhLeaseCollectionResult> {
  const records: LhLeaseVerificationRecord[] = [];
  const collectionIssues: LhLeaseCollectionIssue[] = [];
  const pageSize = resolvePageSize(configuration.pageSize);
  await collectPage(configuration, pageSize, 1, records, collectionIssues);
  return { collectionIssues, records };
}

async function collectPage(
  configuration: LhLeaseClientConfiguration,
  pageSize: number,
  pageNumber: number,
  records: LhLeaseVerificationRecord[],
  collectionIssues: LhLeaseCollectionIssue[],
): Promise<void> {
  const result = await fetchPage(configuration, pageSize, pageNumber);
  if (!result.success) return recordIssue(result, pageNumber, collectionIssues);
  records.push(...result.value.records);
  if (!hasNextPage(result.value, pageSize, pageNumber)) return;
  return collectPage(configuration, pageSize, pageNumber + 1, records, collectionIssues);
}

async function fetchPage(
  configuration: LhLeaseClientConfiguration,
  pageSize: number,
  pageNumber: number,
): Promise<PageResult> {
  const url = createUrl(configuration.serviceKey, pageSize, pageNumber);
  const response = await requestResponse(configuration.fetchFunction, url);
  if (!response.success) return response;
  const validResponse = validateResponse(response.value);
  if (!validResponse.success) return validResponse;
  const payload = await readResponsePayload(response.value);
  if (!payload.success) return payload;
  return parsePage(payload.value);
}

function createUrl(serviceKey: string, pageSize: number, pageNumber: number) {
  const url = new URL(LH_LEASE_ENDPOINT);
  url.searchParams.set("ServiceKey", serviceKey);
  url.searchParams.set("PG_SZ", String(pageSize));
  url.searchParams.set("PAGE", String(pageNumber));
  url.searchParams.set("CNP_CD", "41");
  return url;
}

async function requestResponse(
  fetchFunction: PublicDataFetch,
  url: URL,
): Promise<TransportResult<PublicDataHttpResponse>> {
  try {
    return succeed(await fetchFunction(url));
  } catch {
    return fail("network-error", "LH 임대주택 API 요청에 실패했습니다.");
  }
}

function validateResponse(
  response: PublicDataHttpResponse,
): TransportResult<PublicDataHttpResponse> {
  if (response.ok) return succeed(response);
  return fail("http-error", "LH 임대주택 API가 오류 상태를 반환했습니다.", response.status);
}

async function readResponsePayload(
  response: PublicDataHttpResponse,
): Promise<TransportResult<unknown>> {
  try {
    return succeed(await response.json());
  } catch {
    return fail("malformed-response", "LH 임대주택 API 응답을 해석할 수 없습니다.");
  }
}

function parsePage(payload: unknown): PageResult {
  const envelope = readEnvelope(payload);
  if (!envelope) return fail("malformed-response", "LH 임대주택 응답 형식이 올바르지 않습니다.");
  const resultCode = readResultCode(envelope);
  if (!resultCode) return fail("malformed-response", "LH 임대주택 결과 코드가 없습니다.");
  if (resultCode !== "Y") return fail("api-error", "LH 임대주택 API가 실패를 반환했습니다.");
  if (!Array.isArray(envelope.dsList))
    return fail("malformed-response", "LH 단지 목록이 없습니다.");
  const records = parseRecords(envelope.dsList);
  if (!records) return fail("malformed-response", "LH 단지 데이터가 올바르지 않습니다.");
  return succeed(createPageValue(envelope, records, envelope.dsList.length));
}

function readEnvelope(payload: unknown): UnknownRecord | undefined {
  if (isUnknownRecord(payload)) return payload;
  if (!Array.isArray(payload)) return undefined;
  const records = payload.filter(isUnknownRecord);
  if (records.length !== payload.length) return undefined;
  return Object.assign({}, ...records);
}

function readResultCode(envelope: UnknownRecord) {
  const header = readSingleRecord(envelope.resHeader);
  return readText(header?.SS_CODE);
}

function parseRecords(
  values: ReadonlyArray<unknown>,
): ReadonlyArray<LhLeaseVerificationRecord> | undefined {
  if (!values.every(isUnknownRecord)) return undefined;
  return values.map(parseRecord).filter(isSeongnamRecord);
}

function parseRecord(value: UnknownRecord): LhLeaseVerificationRecord {
  const fields = LH_LEASE_FIELDS.reduce(copyField(value), {});
  return { ...fields, reviewOnly: true, source: "lh-lease-api" };
}

function copyField(value: UnknownRecord) {
  return (record: Partial<Record<LhLeaseField, string>>, field: LhLeaseField) => {
    const text = readText(value[field]);
    if (text !== undefined) record[field] = text;
    return record;
  };
}

function isSeongnamRecord(record: LhLeaseVerificationRecord) {
  return record.ARA_NM?.startsWith(SEONGNAM_AREA_PREFIX) === true;
}

function createPageValue(
  envelope: UnknownRecord,
  records: ReadonlyArray<LhLeaseVerificationRecord>,
  receivedCount: number,
): PageValue {
  const totalCount = readTotalCount(envelope);
  return { receivedCount, records, totalCount };
}

function readTotalCount(envelope: UnknownRecord): number | undefined {
  const search = readSingleRecord(envelope.dsSch);
  if (!search) return undefined;
  const candidates = [
    search.TOTAL_COUNT,
    search.totalCount,
    search.ALL_CNT,
    search.TOT_CNT,
    search.COUNT,
  ];
  return candidates.map(readCount).find(isDefined);
}

function readCount(value: unknown): number | undefined {
  const count = Number(readText(value));
  if (!Number.isSafeInteger(count) || count < 0) return undefined;
  return count;
}

function hasNextPage(value: PageValue, pageSize: number, pageNumber: number) {
  if (value.totalCount !== undefined) return pageNumber * pageSize < value.totalCount;
  return value.receivedCount === pageSize;
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

function recordIssue(
  failure: PageFailure,
  pageNumber: number,
  collectionIssues: LhLeaseCollectionIssue[],
) {
  collectionIssues.push({
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

function fail(kind: LhLeaseCollectionIssueKind, message: string, status?: number): PageFailure {
  return { kind, message, status, success: false };
}
