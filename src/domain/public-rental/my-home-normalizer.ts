import {
  PublicRentalLocations,
  type PublicRentalLegalCategory,
  type PublicRentalLocation,
  type PublicRentalLocationKind,
  type PublicRentalProperty,
  type PublicRentalSourceRecord,
  type RentalOffering,
} from "./public-rental-location";
import { findGyeonggiAddressArea } from "./gyeonggi-geography";

const MY_HOME_SOURCE_URL = "https://www.data.go.kr/data/15110581/openapi.do";
const PUBLIC_RENTAL_TERM = /(5|10|50)년\s*임대/;

export type MyHomeRawRecord = Readonly<{
  hsmpSn?: string;
  hsmpNm?: string;
  insttNm?: string;
  rnAdres?: string;
  pnu?: string;
  competDe?: string;
  hshldCo?: string;
  suplyTyNm?: string;
  houseTyNm?: string;
  styleNm?: string;
  suplyPrvuseAr?: string;
  suplyCmnuseAr?: string;
  bassRentGtn?: string;
  bassMtRntchrg?: string;
  statusName?: string;
  dataStdrDe?: string;
}>;

export function normalizeMyHomeRecords(
  records: readonly MyHomeRawRecord[],
  asOfDate = currentDate(),
) {
  const locations = new Map<string, PublicRentalLocation>();
  records.forEach((record) => collectRecord(locations, record, asOfDate));
  return new PublicRentalLocations([...locations.values()]);
}

function collectRecord(
  locations: Map<string, PublicRentalLocation>,
  record: MyHomeRawRecord,
  asOfDate: string,
) {
  if (!isIncludedRecord(record, asOfDate)) return;
  const identifier = requiredText(record.hsmpSn);
  const existingLocation = locations.get(identifier);
  if (!existingLocation) return addLocation(locations, record);
  locations.set(identifier, mergeLocation(existingLocation, record));
}

function addLocation(locations: Map<string, PublicRentalLocation>, record: MyHomeRawRecord) {
  const location = createLocation(record);
  locations.set(location.id, location);
}

function createLocation(record: MyHomeRawRecord): PublicRentalLocation {
  const legalCategory = requiredLegalCategory(record.suplyTyNm);
  const offering = createOffering(record, legalCategory);
  const sourceRecord = createSourceRecord(record);
  return {
    ...createIdentity(record),
    ...createHousingDetails(record),
    kind: createLocationKind(legalCategory),
    legalCategories: Object.freeze([legalCategory]),
    coordinate: null,
    properties: Object.freeze([createProperty(record, offering, sourceRecord)]),
    offerings: Object.freeze([offering]),
    sourceRecords: Object.freeze([sourceRecord]),
  };
}

function createIdentity(record: MyHomeRawRecord) {
  const area = readRequiredArea(record.rnAdres);
  return {
    id: requiredText(record.hsmpSn),
    provider: "LH" as const,
    municipality: area.municipality,
    district: area.district,
    name: requiredText(record.hsmpNm),
  };
}

function createHousingDetails(record: MyHomeRawRecord) {
  return {
    roadAddress: requiredText(record.rnAdres),
    addressAliases: Object.freeze([requiredText(record.rnAdres)]),
    parcelNumber: optionalText(record.pnu),
    householdCount: parseNumber(record.hshldCo),
    completionDate: optionalText(record.competDe),
  };
}

function mergeLocation(
  location: PublicRentalLocation,
  record: MyHomeRawRecord,
): PublicRentalLocation {
  const legalCategory = requiredLegalCategory(record.suplyTyNm);
  const offering = createOffering(record, legalCategory);
  return {
    ...location,
    legalCategories: appendLegalCategory(location.legalCategories, legalCategory),
    householdCount: maximumNumber(location.householdCount, parseNumber(record.hshldCo)),
    properties: mergeProperty(location.properties, offering),
    offerings: appendOffering(location.offerings, offering),
  };
}

function createOffering(
  record: MyHomeRawRecord,
  legalCategory: PublicRentalLegalCategory,
): RentalOffering {
  return {
    sourceId: createOfferingSourceId(record),
    legalCategory,
    supplyTypeName: requiredText(record.suplyTyNm),
    styleName: optionalText(record.styleNm),
    supplyAreaSquareMeters: parseNumber(record.suplyPrvuseAr),
    householdCount: parseNumber(record.hshldCo),
    exclusiveAreaSquareMeters: parseNumber(record.suplyPrvuseAr),
    commonAreaSquareMeters: parseNumber(record.suplyCmnuseAr),
    depositWon: parseNumber(record.bassRentGtn),
    monthlyRentWon: parseNumber(record.bassMtRntchrg),
  };
}

function createProperty(
  record: MyHomeRawRecord,
  offering: RentalOffering,
  sourceRecord: PublicRentalSourceRecord,
): PublicRentalProperty {
  return {
    sourceId: requiredText(record.hsmpSn),
    name: requiredText(record.hsmpNm),
    kind: createLocationKind(offering.legalCategory),
    parcelNumber: optionalText(record.pnu),
    householdCount: parseNumber(record.hshldCo),
    completionDate: optionalText(record.competDe),
    offerings: Object.freeze([offering]),
    sourceRecords: Object.freeze([sourceRecord]),
  };
}

function mergeProperty(properties: readonly PublicRentalProperty[], offering: RentalOffering) {
  const property = properties[0];
  if (!property) return properties;
  return Object.freeze([{ ...property, offerings: appendOffering(property.offerings, offering) }]);
}

function createOfferingSourceId(record: MyHomeRawRecord) {
  const values = [
    record.hsmpSn,
    record.suplyTyNm,
    record.styleNm,
    record.suplyPrvuseAr,
    record.bassRentGtn,
    record.bassMtRntchrg,
    record.hshldCo,
  ];
  return values.map(requiredText).join(":");
}

function appendOffering(offerings: readonly RentalOffering[], offering: RentalOffering) {
  if (offerings.some((candidate) => candidate.sourceId === offering.sourceId)) return offerings;
  return Object.freeze([...offerings, offering]);
}

function createSourceRecord(record: MyHomeRawRecord): PublicRentalSourceRecord {
  return {
    source: "MY_HOME_PUBLIC_RENTAL_API",
    sourceId: requiredText(record.hsmpSn),
    sourceUrl: MY_HOME_SOURCE_URL,
    referenceDate: optionalText(record.dataStdrDe),
  };
}

function isIncludedRecord(record: MyHomeRawRecord, asOfDate: string) {
  if (!isLhProvider(record.insttNm)) return false;
  if (!hasRequiredIdentity(record)) return false;
  if (!isConcreteGyeonggiAddress(record.rnAdres)) return false;
  if (isExcludedName(record.hsmpNm)) return false;
  if (isExcludedRentalType(record.suplyTyNm)) return false;
  if (!createLegalCategory(record.suplyTyNm)) return false;
  if (isExcludedStatus(record.statusName)) return false;
  return !isFutureCompletion(record.competDe, asOfDate);
}

function isLhProvider(providerName: string | undefined) {
  const normalizedName = optionalText(providerName);
  if (!normalizedName) return false;
  if (normalizedName.includes("한국토지주택공사")) return true;
  return normalizedName.toUpperCase().startsWith("LH");
}

function hasRequiredIdentity(record: MyHomeRawRecord) {
  return Boolean(optionalText(record.hsmpSn) && optionalText(record.hsmpNm));
}

function isConcreteGyeonggiAddress(address: string | undefined) {
  const normalizedAddress = optionalText(address);
  if (!normalizedAddress) return false;
  const area = findGyeonggiAddressArea(normalizedAddress);
  if (!area) return false;
  return hasAddressDetail(normalizedAddress, area.district);
}

function hasAddressDetail(address: string, district: string) {
  const index = address.indexOf(district);
  if (index < 0) return false;
  const detail = address.slice(index + district.length).trim();
  return detail.length > 0;
}

function readRequiredArea(address: string | undefined) {
  const area = findGyeonggiAddressArea(requiredText(address));
  if (area) return area;
  throw new Error("경기도 시군구 주소가 필요합니다.");
}

function isExcludedName(name: string | undefined) {
  const normalizedName = optionalText(name);
  if (!normalizedName) return false;
  return normalizedName.includes("다솜마을");
}

function isExcludedRentalType(supplyTypeName: string | undefined) {
  const normalizedName = optionalText(supplyTypeName);
  if (!normalizedName) return true;
  if (normalizedName.includes("전세임대")) return true;
  if (normalizedName.includes("민간임대")) return true;
  return normalizedName.includes("분양") && !normalizedName.includes("임대");
}

function isExcludedStatus(statusName: string | undefined) {
  const normalizedName = optionalText(statusName);
  if (!normalizedName) return false;
  return /(계획|예정|공사\s*중|준공\s*전|분양전환\s*완료)/.test(normalizedName);
}

function isFutureCompletion(completionDate: string | undefined, asOfDate: string) {
  const normalizedCompletionDate = normalizeDate(completionDate);
  const normalizedAsOfDate = normalizeDate(asOfDate);
  if (!normalizedCompletionDate || !normalizedAsOfDate) return false;
  return normalizedCompletionDate > normalizedAsOfDate;
}

function createLegalCategory(
  supplyTypeName: string | undefined,
): PublicRentalLegalCategory | undefined {
  const normalizedName = optionalText(supplyTypeName);
  if (!normalizedName) return undefined;
  if (normalizedName.includes("매입임대")) return "PURCHASE_RENTAL";
  if (normalizedName.includes("통합공공임대")) return "INTEGRATED_PUBLIC_RENTAL";
  if (normalizedName.includes("행복주택")) return "HAPPY_HOUSING";
  if (normalizedName.includes("국민임대")) return "NATIONAL_RENTAL";
  if (normalizedName.includes("영구임대")) return "PERMANENT_RENTAL";
  if (normalizedName.includes("공공임대")) return "PUBLIC_RENTAL";
  if (PUBLIC_RENTAL_TERM.test(normalizedName)) return "PUBLIC_RENTAL";
}

function requiredLegalCategory(supplyTypeName: string | undefined) {
  const legalCategory = createLegalCategory(supplyTypeName);
  if (!legalCategory) throw new Error("법정 공공임대 유형이 필요합니다.");
  return legalCategory;
}

function createLocationKind(legalCategory: PublicRentalLegalCategory): PublicRentalLocationKind {
  if (legalCategory === "PURCHASE_RENTAL") return "PURCHASE_RENTAL_BUILDING";
  return "CONSTRUCTION_RENTAL_COMPLEX";
}

function appendLegalCategory(
  categories: readonly PublicRentalLegalCategory[],
  category: PublicRentalLegalCategory,
) {
  if (categories.includes(category)) return categories;
  return Object.freeze([...categories, category]);
}

function maximumNumber(first: number | null, second: number | null) {
  if (first === null) return second;
  if (second === null) return first;
  return Math.max(first, second);
}

function parseNumber(value: string | undefined) {
  const normalizedValue = optionalText(value)
    ?.replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  if (!normalizedValue) return null;
  const number = Number(normalizedValue);
  if (!Number.isFinite(number)) return null;
  return number;
}

function optionalText(value: string | undefined) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  return normalizedValue;
}

function requiredText(value: string | undefined) {
  return optionalText(value) ?? "";
}

function normalizeDate(value: string | undefined) {
  const digits = optionalText(value)?.replace(/\D/g, "");
  if (digits?.length !== 8) return null;
  return digits;
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}
