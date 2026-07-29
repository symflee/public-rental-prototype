import {
  PublicRentalLocations,
  type PublicRentalLocation,
  type PublicRentalProvider,
  type PublicRentalRecruitmentNotice,
  type PublicRentalSourceRecord,
} from "./public-rental-location";
import { findGyeonggiAddressArea } from "./gyeonggi-geography";

const ALLOWED_PROVIDERS = new Set<PublicRentalProvider>(["LH", "SEONGNAM_CITY"]);
const OUT_OF_SCOPE_NAME_TERMS = Object.freeze(["다솜마을", "전세임대", "민간임대"]);

export type PublicRentalValidationIssueCode =
  | "MISSING_ID"
  | "DUPLICATE_ID"
  | "OUT_OF_SCOPE_NAME"
  | "INVALID_ADDRESS"
  | "INVALID_COORDINATE"
  | "INVALID_PROVIDER"
  | "MISSING_LEGAL_CATEGORY"
  | "MISSING_PROPERTY"
  | "MISSING_SOURCE"
  | "INVALID_RECRUITMENT_NOTICE"
  | "DUPLICATE_RECRUITMENT_NOTICE"
  | "INVALID_SOURCE_URL"
  | "INVALID_SOURCE_REFERENCE_DATE";

export type PublicRentalValidationIssue = Readonly<{
  code: PublicRentalValidationIssueCode;
  locationId: string;
  message: string;
}>;

export function validatePublicRentalLocations(
  input: PublicRentalLocations | readonly PublicRentalLocation[],
): readonly PublicRentalValidationIssue[] {
  const issues: PublicRentalValidationIssue[] = [];
  const identifiers = new Set<string>();
  const locations = readLocationValues(input);
  locations.forEach((location) => validateLocation(location, identifiers, issues));
  return Object.freeze(issues);
}

function readLocationValues(input: PublicRentalLocations | readonly PublicRentalLocation[]) {
  if (input instanceof PublicRentalLocations) return input.values;
  return input;
}

function validateLocation(
  location: PublicRentalLocation,
  identifiers: Set<string>,
  issues: PublicRentalValidationIssue[],
) {
  validateIdentifier(location, identifiers, issues);
  validateName(location, issues);
  validateAddress(location, issues);
  validateCoordinate(location, issues);
  validateProvider(location, issues);
  validateLegalCategories(location, issues);
  validateProperties(location, issues);
  validateRecruitmentNotices(location, issues);
  validateSources(location, issues);
}

function validateIdentifier(
  location: PublicRentalLocation,
  identifiers: Set<string>,
  issues: PublicRentalValidationIssue[],
) {
  const identifier = location.id.trim();
  if (!identifier) return addIssue(issues, location, "MISSING_ID", "위치 식별자가 없습니다.");
  if (identifiers.has(identifier)) {
    addIssue(issues, location, "DUPLICATE_ID", "위치 식별자가 중복되었습니다.");
  }
  identifiers.add(identifier);
}

function validateName(location: PublicRentalLocation, issues: PublicRentalValidationIssue[]) {
  const excluded = OUT_OF_SCOPE_NAME_TERMS.some((term) => location.name.includes(term));
  if (!excluded) return;
  addIssue(issues, location, "OUT_OF_SCOPE_NAME", "수집 범위 밖의 주택 이름입니다.");
}

function validateAddress(location: PublicRentalLocation, issues: PublicRentalValidationIssue[]) {
  if (findGyeonggiAddressArea(location.roadAddress)) return;
  addIssue(issues, location, "INVALID_ADDRESS", "경기도의 지도 표시 주소가 아닙니다.");
}

function validateCoordinate(location: PublicRentalLocation, issues: PublicRentalValidationIssue[]) {
  if (isValidCoordinate(location)) return;
  addIssue(issues, location, "INVALID_COORDINATE", "유효한 WGS84 좌표가 없습니다.");
}

function isValidCoordinate(location: PublicRentalLocation) {
  const coordinate = location.coordinate;
  if (!coordinate) return false;
  if (!Number.isFinite(coordinate.latitude)) return false;
  if (!Number.isFinite(coordinate.longitude)) return false;
  if (coordinate.latitude < -90 || coordinate.latitude > 90) return false;
  return coordinate.longitude >= -180 && coordinate.longitude <= 180;
}

function validateProvider(location: PublicRentalLocation, issues: PublicRentalValidationIssue[]) {
  if (ALLOWED_PROVIDERS.has(location.provider)) return;
  addIssue(issues, location, "INVALID_PROVIDER", "허용되지 않은 운영주체입니다.");
}

function validateLegalCategories(
  location: PublicRentalLocation,
  issues: PublicRentalValidationIssue[],
) {
  if (location.legalCategories.length > 0) return;
  addIssue(issues, location, "MISSING_LEGAL_CATEGORY", "법정 공공임대 유형이 없습니다.");
}

function validateProperties(location: PublicRentalLocation, issues: PublicRentalValidationIssue[]) {
  if (location.properties.length > 0) return;
  addIssue(issues, location, "MISSING_PROPERTY", "원천 주택 속성이 없습니다.");
}

function validateRecruitmentNotices(
  location: PublicRentalLocation,
  issues: PublicRentalValidationIssue[],
) {
  const identifiers = new Set<string>();
  const notices = location.recruitmentNotices ?? [];
  notices.forEach((notice) => validateRecruitmentNotice(location, notice, identifiers, issues));
}

function validateRecruitmentNotice(
  location: PublicRentalLocation,
  notice: PublicRentalRecruitmentNotice,
  identifiers: Set<string>,
  issues: PublicRentalValidationIssue[],
) {
  if (!isValidRecruitmentNotice(notice)) {
    addIssue(issues, location, "INVALID_RECRUITMENT_NOTICE", "모집공고 정보가 유효하지 않습니다.");
  }
  if (identifiers.has(notice.id)) {
    addIssue(issues, location, "DUPLICATE_RECRUITMENT_NOTICE", "모집공고 식별자가 중복되었습니다.");
  }
  identifiers.add(notice.id);
}

function isValidRecruitmentNotice(notice: PublicRentalRecruitmentNotice) {
  if (!notice.id.trim() || !notice.title.trim()) return false;
  if (!isValidSourceUrl(notice.url)) return false;
  if (notice.announcedAt === null) return true;
  return isValidReferenceDate(notice.announcedAt);
}

function validateSources(location: PublicRentalLocation, issues: PublicRentalValidationIssue[]) {
  if (location.sourceRecords.length === 0) {
    addIssue(issues, location, "MISSING_SOURCE", "출처가 없습니다.");
  }
  location.sourceRecords.forEach((source) => validateSource(location, source, issues));
}

function validateSource(
  location: PublicRentalLocation,
  source: PublicRentalSourceRecord,
  issues: PublicRentalValidationIssue[],
) {
  if (!isValidSourceUrl(source.sourceUrl)) {
    addIssue(issues, location, "INVALID_SOURCE_URL", "출처 URL이 유효하지 않습니다.");
  }
  if (!isValidReferenceDate(source.referenceDate)) {
    addIssue(issues, location, "INVALID_SOURCE_REFERENCE_DATE", "출처 기준일이 유효하지 않습니다.");
  }
}

function isValidSourceUrl(value: string) {
  try {
    const sourceUrl = new URL(value);
    return sourceUrl.protocol === "https:" || sourceUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidReferenceDate(value: string | null) {
  const digits = value?.replace(/\D/g, "");
  if (!digits || digits.length !== 8) return false;
  const isoDate = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) return false;
  return parsedDate.toISOString().startsWith(isoDate);
}

function addIssue(
  issues: PublicRentalValidationIssue[],
  location: PublicRentalLocation,
  code: PublicRentalValidationIssueCode,
  message: string,
) {
  issues.push({ code, locationId: location.id.trim(), message });
}
