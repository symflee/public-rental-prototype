import {
  createGyeonggiMunicipalities,
  GYEONGGI_COLLECTION_AREAS,
  validatePublicRentalLocations,
  type PublicRentalCoordinate,
  type PublicRentalCoordinateSource,
  type PublicRentalLegalCategory,
  type PublicRentalLocation,
  type PublicRentalLocationKind,
  type PublicRentalMunicipality,
  type PublicRentalDistrict,
  type PublicRentalProperty,
  type PublicRentalProvider,
  type PublicRentalRecruitmentNotice,
  type PublicRentalSource,
  type PublicRentalSourceRecord,
  type RentalOffering,
} from "@/domain/public-rental";

import generatedSnapshot from "./generated/public-rental-locations.json";
import type { PublicRentalSnapshot } from "./public-rental-artifacts";

const PROVIDERS = ["LH", "SEONGNAM_CITY"] as const satisfies readonly PublicRentalProvider[];
const LOCATION_KINDS = [
  "CONSTRUCTION_RENTAL_COMPLEX",
  "PURCHASE_RENTAL_BUILDING",
] as const satisfies readonly PublicRentalLocationKind[];
const MUNICIPALITIES = createGyeonggiMunicipalities() satisfies readonly PublicRentalMunicipality[];
const DISTRICTS = [
  ...new Set(GYEONGGI_COLLECTION_AREAS.map((area) => area.district)),
] satisfies readonly PublicRentalDistrict[];
const LEGAL_CATEGORIES = [
  "NATIONAL_RENTAL",
  "PERMANENT_RENTAL",
  "HAPPY_HOUSING",
  "INTEGRATED_PUBLIC_RENTAL",
  "PUBLIC_RENTAL",
  "PURCHASE_RENTAL",
] as const satisfies readonly PublicRentalLegalCategory[];
const COORDINATE_SOURCES = [
  "KAKAO_ADDRESS_SEARCH",
  "MY_HOME_PUBLIC_RENTAL_API",
  "SEONGNAM_PUBLIC_WIFI",
] as const satisfies readonly PublicRentalCoordinateSource[];
const PUBLIC_RENTAL_SOURCES = [
  "MY_HOME_PUBLIC_RENTAL_API",
  "LH_CONSTRUCTION_RENTAL_CSV",
  "LH_PURCHASE_RENTAL_CSV",
  "SEONGNAM_URBAN_DEVELOPMENT_CORPORATION",
  "SEONGNAM_PUBLIC_WIFI",
] as const satisfies readonly PublicRentalSource[];
const RECRUITMENT_NOTICE_SOURCE_KINDS = [
  "AUTOMATED_IMPORT",
  "MANUAL_REVIEW",
] as const satisfies readonly PublicRentalRecruitmentNotice["sourceKind"][];

type UnknownRecord = Record<string, unknown>;

export const publicRentalSnapshot = parsePublicRentalSnapshot(generatedSnapshot);

export function parsePublicRentalSnapshot(value: unknown): PublicRentalSnapshot {
  if (!isPublicRentalSnapshot(value)) {
    throw new Error("공공임대 스냅샷 형식이 올바르지 않습니다.");
  }
  const issues = validatePublicRentalLocations(value.locations);
  if (issues.length > 0) {
    throw new Error("공공임대 스냅샷 형식이 올바르지 않습니다.");
  }
  return value;
}

function isPublicRentalSnapshot(value: unknown): value is PublicRentalSnapshot {
  if (!isUnknownRecord(value)) return false;
  if (value.schemaVersion !== 2) return false;
  if (value.status !== "partial" && value.status !== "verified") return false;
  if (typeof value.generatedAt !== "string") return false;
  return isArrayOf(value.locations, isPublicRentalLocation);
}

function isPublicRentalLocation(value: unknown): value is PublicRentalLocation {
  if (!isUnknownRecord(value)) return false;
  if (!hasLocationIdentity(value)) return false;
  if (!hasLocationClassification(value)) return false;
  if (!hasLocationDetails(value)) return false;
  if (!isNullableCoordinate(value.coordinate)) return false;
  if (!hasRecruitmentNotices(value)) return false;
  if (!isArrayOf(value.properties, isPublicRentalProperty)) return false;
  if (!isArrayOf(value.offerings, isRentalOffering)) return false;
  return isArrayOf(value.sourceRecords, isSourceRecord);
}

function hasLocationIdentity(value: UnknownRecord) {
  if (!isNonEmptyString(value.id)) return false;
  if (!isNonEmptyString(value.name)) return false;
  if (!isNonEmptyString(value.roadAddress)) return false;
  return isArrayOf(value.addressAliases, isNonEmptyString);
}

function hasLocationClassification(value: UnknownRecord) {
  if (!isOneOf(value.provider, PROVIDERS)) return false;
  if (!isOneOf(value.kind, LOCATION_KINDS)) return false;
  if (!isOneOf(value.municipality, MUNICIPALITIES)) return false;
  if (!isOneOf(value.district, DISTRICTS)) return false;
  return isArrayOf(value.legalCategories, isLegalCategory);
}

function hasLocationDetails(value: UnknownRecord) {
  if (!isNullableString(value.parcelNumber)) return false;
  if (!isNullableFiniteNumber(value.householdCount)) return false;
  return isNullableString(value.completionDate);
}

function hasRecruitmentNotices(value: UnknownRecord) {
  if (value.recruitmentNotices === undefined) return true;
  return isArrayOf(value.recruitmentNotices, isRecruitmentNotice);
}

function isRecruitmentNotice(value: unknown): value is PublicRentalRecruitmentNotice {
  if (!isUnknownRecord(value)) return false;
  if (!isNonEmptyString(value.id)) return false;
  if (!isNonEmptyString(value.title)) return false;
  if (!isNullableString(value.announcedAt)) return false;
  if (!isOptionalNullableString(value.applicationStartsAt)) return false;
  if (!isOptionalNullableString(value.applicationEndsAt)) return false;
  if (!isOptionalSourceKind(value.sourceKind)) return false;
  if (!isOptionalNullableUrl(value.evidenceUrl)) return false;
  return isValidHttpUrl(value.url);
}

function isOptionalSourceKind(value: unknown) {
  if (value === undefined) return true;
  return isOneOf(value, RECRUITMENT_NOTICE_SOURCE_KINDS);
}

function isOptionalNullableString(value: unknown) {
  if (value === undefined) return true;
  return isNullableString(value);
}

function isOptionalNullableUrl(value: unknown) {
  if (value === undefined || value === null) return true;
  return isValidHttpUrl(value);
}

function isValidHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isNullableCoordinate(value: unknown): value is PublicRentalCoordinate | null {
  if (value === null) return true;
  if (!isUnknownRecord(value)) return false;
  if (!isFiniteNumber(value.latitude)) return false;
  if (!isFiniteNumber(value.longitude)) return false;
  return isOneOf(value.source, COORDINATE_SOURCES);
}

function isRentalOffering(value: unknown): value is RentalOffering {
  if (!isUnknownRecord(value)) return false;
  if (!isNonEmptyString(value.sourceId)) return false;
  if (!isLegalCategory(value.legalCategory)) return false;
  if (!isNonEmptyString(value.supplyTypeName)) return false;
  if (!isNullableString(value.styleName)) return false;
  return hasOfferingNumbers(value);
}

function hasOfferingNumbers(value: UnknownRecord) {
  const fields = [
    value.supplyAreaSquareMeters,
    value.householdCount,
    value.exclusiveAreaSquareMeters,
    value.commonAreaSquareMeters,
    value.depositWon,
    value.monthlyRentWon,
  ];
  return fields.every(isNullableFiniteNumber);
}

function isPublicRentalProperty(value: unknown): value is PublicRentalProperty {
  if (!isUnknownRecord(value)) return false;
  if (!hasPropertyIdentity(value)) return false;
  if (!hasPropertyDetails(value)) return false;
  if (!isArrayOf(value.offerings, isRentalOffering)) return false;
  return isArrayOf(value.sourceRecords, isSourceRecord);
}

function hasPropertyIdentity(value: UnknownRecord) {
  if (!isNonEmptyString(value.sourceId)) return false;
  if (!isNonEmptyString(value.name)) return false;
  return isOneOf(value.kind, LOCATION_KINDS);
}

function hasPropertyDetails(value: UnknownRecord) {
  if (!isNullableString(value.parcelNumber)) return false;
  if (!isNullableFiniteNumber(value.householdCount)) return false;
  return isNullableString(value.completionDate);
}

function isSourceRecord(value: unknown): value is PublicRentalSourceRecord {
  if (!isUnknownRecord(value)) return false;
  if (!isOneOf(value.source, PUBLIC_RENTAL_SOURCES)) return false;
  if (!isNonEmptyString(value.sourceId)) return false;
  if (!isNonEmptyString(value.sourceUrl)) return false;
  return isNullableString(value.referenceDate);
}

function isLegalCategory(value: unknown): value is PublicRentalLegalCategory {
  return isOneOf(value, LEGAL_CATEGORIES);
}

function isOneOf<Value extends string>(
  value: unknown,
  candidates: readonly Value[],
): value is Value {
  if (typeof value !== "string") return false;
  return candidates.some((candidate) => candidate === value);
}

function isArrayOf<Value>(
  value: unknown,
  predicate: (item: unknown) => item is Value,
): value is readonly Value[] {
  if (!Array.isArray(value)) return false;
  return value.every(predicate);
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
