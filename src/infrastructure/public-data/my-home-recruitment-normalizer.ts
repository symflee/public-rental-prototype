import type { PublicRentalRecruitmentCandidate } from "@/domain/public-rental";

import type { MyHomeRecruitmentRawRecord } from "./my-home-recruitment-client";

const MY_HOME_DETAIL_ENDPOINT =
  "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do";
const PROVIDER_FIELDS = [
  "insttNm",
  "suplyInsttNm",
  "supplyInsttNm",
  "splyInsttNm",
  "providerNm",
] as const;
const NOTICE_IDENTIFIER_FIELDS = [
  "pblancId",
  "rcritPblancSn",
  "rcritPblancId",
  "noticeId",
] as const;
const NOTICE_TITLE_FIELDS = [
  "pblancNm",
  "rcritPblancNm",
  "rcritNtcNm",
  "noticeNm",
  "title",
] as const;
const COMPLEX_IDENTIFIER_FIELDS = ["hsmpSn", "hsmpId", "complexId", "rentalHouseId"] as const;
const COMPLEX_NAME_FIELDS = ["hsmpNm", "hsmpName", "complexName", "houseNm", "housNm"] as const;
const NOTICE_DATE_FIELDS = ["pblancDe", "rcritPblancDe", "rcritNtcDe", "noticeDate"] as const;
const STATUS_FIELDS = ["rcritSttusNm", "rcritStatusName", "statusName", "pblancSttusNm"] as const;
const START_DATE_FIELDS = [
  "rcritBeginDe",
  "rcritSttDe",
  "rcritStartDe",
  "recepBeginDe",
  "applyStartDate",
] as const;
const END_DATE_FIELDS = [
  "rcritEndDe",
  "rcritCloseDe",
  "recepEndDe",
  "applyEndDate",
  "rcritEndDate",
] as const;
const DETAIL_URL_FIELDS = [
  "detailUrl",
  "rcritPblancUrl",
  "rcritPblancLink",
  "pblancUrl",
  "noticeUrl",
  "url",
  "linkUrl",
] as const;

export type RecruitmentNormalizationExclusionReason =
  | "MISSING_COMPLEX_REFERENCE"
  | "MISSING_NOTICE_ID"
  | "MISSING_NOTICE_TITLE"
  | "MISSING_NOTICE_URL"
  | "NON_LH_PROVIDER"
  | "NOT_OPEN";

export type RecruitmentNormalizationExclusion = Readonly<{
  announcedAt: string | null;
  complexId: string | null;
  complexName: string | null;
  noticeId: string | null;
  noticeTitle: string | null;
  noticeUrl: string | null;
  reason: RecruitmentNormalizationExclusionReason;
}>;

export type MyHomeRecruitmentNormalizationResult = Readonly<{
  candidates: readonly PublicRentalRecruitmentCandidate[];
  exclusions: readonly RecruitmentNormalizationExclusion[];
}>;

export function normalizeMyHomeRecruitmentRecords(
  records: readonly MyHomeRecruitmentRawRecord[],
  asOfDate = currentDate(),
): MyHomeRecruitmentNormalizationResult {
  const candidates: PublicRentalRecruitmentCandidate[] = [];
  const exclusions: RecruitmentNormalizationExclusion[] = [];
  records.forEach((record) => normalizeRecord(record, asOfDate, candidates, exclusions));
  return { candidates: Object.freeze(candidates), exclusions: Object.freeze(exclusions) };
}

function normalizeRecord(
  record: MyHomeRecruitmentRawRecord,
  asOfDate: string,
  candidates: PublicRentalRecruitmentCandidate[],
  exclusions: RecruitmentNormalizationExclusion[],
) {
  const reason = readExclusionReason(record, asOfDate);
  if (reason) return exclusions.push(createExclusion(record, reason));
  const candidate = createCandidate(record);
  if (candidate) return candidates.push(candidate);
  exclusions.push(createExclusion(record, "MISSING_NOTICE_URL"));
}

function readExclusionReason(
  record: MyHomeRecruitmentRawRecord,
  asOfDate: string,
): RecruitmentNormalizationExclusionReason | undefined {
  if (!isLhProvider(readFirstText(record, PROVIDER_FIELDS))) return "NON_LH_PROVIDER";
  if (!isOpenRecruitment(record, asOfDate)) return "NOT_OPEN";
  if (!readNoticeIdentifier(record)) return "MISSING_NOTICE_ID";
  if (!readFirstText(record, NOTICE_TITLE_FIELDS)) return "MISSING_NOTICE_TITLE";
  if (!hasComplexReference(record)) return "MISSING_COMPLEX_REFERENCE";
  return undefined;
}

function createCandidate(
  record: MyHomeRecruitmentRawRecord,
): PublicRentalRecruitmentCandidate | undefined {
  const id = readNoticeIdentifier(record);
  const title = readFirstText(record, NOTICE_TITLE_FIELDS);
  const url = readNoticeUrl(record);
  if (!id || !title || !url) return undefined;
  return {
    complexId: readFirstText(record, COMPLEX_IDENTIFIER_FIELDS) ?? null,
    complexName: readFirstText(record, COMPLEX_NAME_FIELDS) ?? null,
    notice: {
      announcedAt: readFirstDate(record, NOTICE_DATE_FIELDS),
      applicationEndsAt: readFirstDate(record, END_DATE_FIELDS),
      applicationStartsAt: readFirstDate(record, START_DATE_FIELDS),
      id,
      sourceKind: "AUTOMATED_IMPORT",
      title,
      url,
    },
  };
}

function createExclusion(
  record: MyHomeRecruitmentRawRecord,
  reason: RecruitmentNormalizationExclusionReason,
): RecruitmentNormalizationExclusion {
  return {
    announcedAt: readFirstDate(record, NOTICE_DATE_FIELDS),
    complexId: readFirstText(record, COMPLEX_IDENTIFIER_FIELDS) ?? null,
    complexName: readFirstText(record, COMPLEX_NAME_FIELDS) ?? null,
    noticeId: readNoticeIdentifier(record) ?? null,
    noticeTitle: readFirstText(record, NOTICE_TITLE_FIELDS) ?? null,
    noticeUrl: readNoticeUrl(record) ?? null,
    reason,
  };
}

export function requiresRecruitmentReview(exclusion: RecruitmentNormalizationExclusion) {
  if (exclusion.reason === "NON_LH_PROVIDER") return false;
  return exclusion.reason !== "NOT_OPEN";
}

function isLhProvider(providerName: string | undefined) {
  if (!providerName) return false;
  if (providerName.includes("한국토지주택공사")) return true;
  return providerName.toUpperCase().startsWith("LH");
}

function isOpenRecruitment(record: MyHomeRecruitmentRawRecord, asOfDate: string) {
  const status = readFirstText(record, STATUS_FIELDS);
  if (status && isClosedStatus(status)) return false;
  if (status && isOpenStatus(status)) return true;
  return isWithinRecruitmentPeriod(record, asOfDate);
}

function isClosedStatus(status: string) {
  return /(마감|종료|완료|취소|예정)/u.test(status);
}

function isOpenStatus(status: string) {
  return /(모집\s*중|접수\s*중|공고\s*중)/u.test(status);
}

function isWithinRecruitmentPeriod(record: MyHomeRecruitmentRawRecord, asOfDate: string) {
  const today = normalizeDate(asOfDate);
  if (!today) return false;
  const startDate = readFirstDate(record, START_DATE_FIELDS);
  const endDate = readFirstDate(record, END_DATE_FIELDS);
  if (startDate && startDate > today) return false;
  if (endDate && endDate < today) return false;
  return true;
}

function hasComplexReference(record: MyHomeRecruitmentRawRecord) {
  if (readFirstText(record, COMPLEX_IDENTIFIER_FIELDS)) return true;
  return Boolean(readFirstText(record, COMPLEX_NAME_FIELDS));
}

function readNoticeIdentifier(record: MyHomeRecruitmentRawRecord) {
  return readFirstText(record, NOTICE_IDENTIFIER_FIELDS);
}

function readNoticeUrl(record: MyHomeRecruitmentRawRecord) {
  const suppliedUrl = readFirstText(record, DETAIL_URL_FIELDS);
  if (isHttpUrl(suppliedUrl)) return suppliedUrl;
  return createMyHomeDetailUrl(readFirstText(record, ["pblancId"]));
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function createMyHomeDetailUrl(pblancId: string | undefined) {
  if (!pblancId) return undefined;
  const url = new URL(MY_HOME_DETAIL_ENDPOINT);
  url.searchParams.set("pblancId", pblancId);
  return url.toString();
}

function readFirstDate(record: MyHomeRecruitmentRawRecord, fields: readonly string[]) {
  const value = readFirstText(record, fields);
  if (!value) return null;
  return normalizeDate(value);
}

function normalizeDate(value: string) {
  const digits = value.replace(/\D/gu, "");
  if (digits.length < 8) return null;
  const isoDate = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (!date.toISOString().startsWith(isoDate)) return null;
  return isoDate;
}

function readFirstText(record: MyHomeRecruitmentRawRecord, fields: readonly string[]) {
  return fields.map((field) => readText(record[field])).find(isDefined);
}

function readText(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}
