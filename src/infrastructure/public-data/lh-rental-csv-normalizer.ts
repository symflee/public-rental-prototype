import { createHash } from "node:crypto";

import {
  PublicRentalLocations,
  type PublicRentalDistrict,
  type PublicRentalLegalCategory,
  type PublicRentalLocation,
  type PublicRentalLocationKind,
  type PublicRentalMunicipality,
  type PublicRentalProperty,
  type PublicRentalSourceRecord,
  type RentalOffering,
} from "@/domain/public-rental";

import type {
  LhConstructionRentalCsvRecord,
  LhPurchaseRentalCsvRecord,
} from "./lh-rental-csv-parser";

const CONSTRUCTION_SOURCE_URL = "https://www.data.go.kr/data/15050700/fileData.do";
const PURCHASE_SOURCE_URL = "https://www.data.go.kr/data/15050701/fileData.do";
const CONSTRUCTION_REFERENCE_DATE = "2025-09-18";
const PURCHASE_REFERENCE_DATE = "2022-01-27";
const INVALID_FUTURE_YEAR = 2100;

const SUPPLY_CATEGORIES = new Map<string, PublicRentalLegalCategory>([
  ["국민임대", "NATIONAL_RENTAL"],
  ["영구임대", "PERMANENT_RENTAL"],
  ["행복주택", "HAPPY_HOUSING"],
  ["통합공공임대", "INTEGRATED_PUBLIC_RENTAL"],
  ["공공임대(5년)", "PUBLIC_RENTAL"],
  ["공공임대(10년)", "PUBLIC_RENTAL"],
  ["공공임대(50년)", "PUBLIC_RENTAL"],
  ["공공임대(분납)", "PUBLIC_RENTAL"],
  ["기존주택매입임대", "PURCHASE_RENTAL"],
  ["신축다세대매입임대", "PURCHASE_RENTAL"],
  ["청년신혼부부매입임대", "PURCHASE_RENTAL"],
]);

const MANUAL_REVIEW_TYPES = new Set(["장기임대", "근로복지", "집주인건설개량"]);
const CATEGORY_ORDER: readonly PublicRentalLegalCategory[] = [
  "NATIONAL_RENTAL",
  "PERMANENT_RENTAL",
  "HAPPY_HOUSING",
  "INTEGRATED_PUBLIC_RENTAL",
  "PUBLIC_RENTAL",
  "PURCHASE_RENTAL",
];

export type LhRentalNormalizationIssueCode =
  | "FUTURE_PROPERTY"
  | "INCOMPLETE_ADDRESS"
  | "INVALID_PROPERTY_DATE"
  | "MANUAL_REVIEW_SUPPLY_TYPE"
  | "MISSING_REQUIRED_FIELD"
  | "OUTSIDE_TARGET_AREA"
  | "ROAD_LEVEL_ADDRESS_PRECISION"
  | "UNSUPPORTED_SUPPLY_TYPE";

export type LhRentalNormalizationIssue = Readonly<{
  address: string;
  code: LhRentalNormalizationIssueCode;
  message: string;
  sourceId: string;
  sourceKind: "construction" | "purchase";
}>;

export type LhRentalCsvNormalizationInput = Readonly<{
  asOfDate: string;
  constructionRecords: readonly LhConstructionRentalCsvRecord[];
  purchaseRecords: readonly LhPurchaseRentalCsvRecord[];
}>;

export type LhRentalCsvNormalizationResult = Readonly<{
  exclusions: readonly LhRentalNormalizationIssue[];
  locations: PublicRentalLocations;
  warnings: readonly LhRentalNormalizationIssue[];
}>;

type Geography = Readonly<{
  district: PublicRentalDistrict;
  municipality: PublicRentalMunicipality;
  municipalitySlug: "seongnam" | "yongin";
}>;

type PreparedRecord = Readonly<{
  aliases: readonly string[];
  completionDate: string | null;
  geography: Geography;
  name: string;
  offering: RentalOffering;
  propertyKind: PublicRentalLocationKind;
  propertySourceId: string;
  roadAddress: string;
  sourceRecord: PublicRentalSourceRecord;
}>;

type PropertyDraft = {
  completionDate: string | null;
  kind: PublicRentalLocationKind;
  name: string;
  offerings: Map<string, RentalOffering>;
  sourceId: string;
  sourceRecords: PublicRentalSourceRecord[];
};

type LocationDraft = {
  aliases: Set<string>;
  geography: Geography;
  properties: Map<string, PropertyDraft>;
  roadAddress: string;
};

type NormalizationState = {
  exclusions: LhRentalNormalizationIssue[];
  groups: Map<string, LocationDraft>;
  warnings: LhRentalNormalizationIssue[];
};

type PreparedAddress = Readonly<{
  aliases: readonly string[];
  geography: Geography;
  roadLevelPrecision: boolean;
  roadAddress: string;
}>;

export function normalizeLhRentalCsvRecords(
  input: LhRentalCsvNormalizationInput,
): LhRentalCsvNormalizationResult {
  const state = createNormalizationState();
  input.constructionRecords.forEach((record) => collectConstructionRecord(state, input, record));
  input.purchaseRecords.forEach((record) => collectPurchaseRecord(state, input, record));
  const locations = createLocations(state.groups);
  assertNoIdentifierCollisions(locations);
  return createNormalizationResult(state, locations);
}

function createNormalizationState(): NormalizationState {
  return { exclusions: [], groups: new Map(), warnings: [] };
}

function collectConstructionRecord(
  state: NormalizationState,
  input: LhRentalCsvNormalizationInput,
  record: LhConstructionRentalCsvRecord,
) {
  const prepared = prepareConstructionRecord(state, input, record);
  if (!prepared) return;
  addPreparedRecord(state.groups, prepared);
}

function collectPurchaseRecord(
  state: NormalizationState,
  input: LhRentalCsvNormalizationInput,
  record: LhPurchaseRentalCsvRecord,
) {
  const prepared = preparePurchaseRecord(state, input, record);
  if (!prepared) return;
  addPreparedRecord(state.groups, prepared);
}

function prepareConstructionRecord(
  state: NormalizationState,
  input: LhRentalCsvNormalizationInput,
  record: LhConstructionRentalCsvRecord,
) {
  if (!includeRequiredConstructionFields(state, record)) return undefined;
  if (!includeTargetArea(state, constructionIssueContext(record))) return undefined;
  const category = includeSupplyType(state, constructionIssueContext(record));
  if (!category) return undefined;
  const date = normalizeDate(state, constructionIssueContext(record), record.completionDate);
  if (excludeFutureDate(state, constructionIssueContext(record), date, input.asOfDate))
    return undefined;
  const address = includeConstructionAddress(state, record);
  if (!address) return undefined;
  return createConstructionPreparedRecord(record, address, category, date);
}

function preparePurchaseRecord(
  state: NormalizationState,
  input: LhRentalCsvNormalizationInput,
  record: LhPurchaseRentalCsvRecord,
) {
  if (!includeRequiredPurchaseFields(state, record)) return undefined;
  if (!includeTargetArea(state, purchaseIssueContext(record))) return undefined;
  const category = includeSupplyType(state, purchaseIssueContext(record));
  if (!category) return undefined;
  const date = normalizeDate(state, purchaseIssueContext(record), record.buildingApprovalDate);
  if (excludeFutureDate(state, purchaseIssueContext(record), date, input.asOfDate))
    return undefined;
  const address = includePurchaseAddress(state, record);
  if (!address) return undefined;
  return createPurchasePreparedRecord(record, address, category, date);
}

function includeTargetArea(state: NormalizationState, context: LhRentalNormalizationIssue) {
  if (readGeography(normalizeAddressAlias(context.address))) return true;
  state.exclusions.push({
    ...context,
    code: "OUTSIDE_TARGET_AREA",
    message: "성남시·용인시 밖의 주소입니다.",
  });
  return false;
}

function includeRequiredConstructionFields(
  state: NormalizationState,
  record: LhConstructionRentalCsvRecord,
) {
  if (record.complexCode.trim() && record.complexName.trim() && record.address.trim()) return true;
  state.exclusions.push(createMissingFieldIssue(constructionIssueContext(record)));
  return false;
}

function includeRequiredPurchaseFields(
  state: NormalizationState,
  record: LhPurchaseRentalCsvRecord,
) {
  if (record.sequence.trim() && record.complexName.trim() && record.address.trim()) return true;
  state.exclusions.push(createMissingFieldIssue(purchaseIssueContext(record)));
  return false;
}

function createMissingFieldIssue(context: LhRentalNormalizationIssue) {
  return {
    ...context,
    code: "MISSING_REQUIRED_FIELD" as const,
    message: "원천 ID, 이름 또는 주소가 없습니다.",
  };
}

function includeSupplyType(state: NormalizationState, context: LhRentalNormalizationIssue) {
  const category = SUPPLY_CATEGORIES.get(context.message);
  if (category) return category;
  const code = readSupplyExclusionCode(context.message);
  state.exclusions.push({
    ...context,
    code,
    message: createSupplyExclusionMessage(context.message),
  });
  return undefined;
}

function readSupplyExclusionCode(supplyTypeName: string) {
  if (MANUAL_REVIEW_TYPES.has(supplyTypeName)) return "MANUAL_REVIEW_SUPPLY_TYPE" as const;
  return "UNSUPPORTED_SUPPLY_TYPE" as const;
}

function createSupplyExclusionMessage(supplyTypeName: string) {
  if (MANUAL_REVIEW_TYPES.has(supplyTypeName)) return `검수가 필요한 공급유형: ${supplyTypeName}`;
  return `수집 범위 밖의 공급유형: ${supplyTypeName}`;
}

function includeConstructionAddress(
  state: NormalizationState,
  record: LhConstructionRentalCsvRecord,
) {
  const address = createConstructionAddress(record);
  return includeAddress(state, constructionIssueContext(record), address);
}

function includePurchaseAddress(state: NormalizationState, record: LhPurchaseRentalCsvRecord) {
  const address = createPurchaseAddress(record.address);
  return includeAddress(state, purchaseIssueContext(record), address);
}

function includeAddress(
  state: NormalizationState,
  context: LhRentalNormalizationIssue,
  address: PreparedAddress | undefined,
) {
  if (address) {
    appendAddressPrecisionWarning(state, context, address);
    return address;
  }
  state.exclusions.push(createAddressExclusion(context));
  return undefined;
}

function appendAddressPrecisionWarning(
  state: NormalizationState,
  context: LhRentalNormalizationIssue,
  address: PreparedAddress,
) {
  if (!address.roadLevelPrecision) return;
  state.warnings.push({
    ...context,
    address: address.roadAddress,
    code: "ROAD_LEVEL_ADDRESS_PRECISION",
    message: "별도 건물번호 없이 숫자가 포함된 도로명 단위 주소입니다.",
  });
}

function createAddressExclusion(context: LhRentalNormalizationIssue) {
  const geography = readGeography(context.address);
  if (!geography) return { ...context, code: "OUTSIDE_TARGET_AREA" as const };
  return {
    ...context,
    code: "INCOMPLETE_ADDRESS" as const,
    message: "건물번호가 확인되는 주소가 아닙니다.",
  };
}

function createConstructionAddress(record: LhConstructionRentalCsvRecord) {
  const original = normalizeAddressAlias(record.address);
  const joined = joinDetailAddress(original, record.detailAddress);
  return createPreparedAddress(joined, [original, joined]);
}

function createPurchaseAddress(address: string) {
  const original = normalizeAddressAlias(address);
  return createPreparedAddress(original, [original]);
}

function createPreparedAddress(address: string, aliases: readonly string[]) {
  const roadAddress = readCanonicalAddress(address);
  const geography = readGeography(roadAddress);
  if (!geography) return undefined;
  if (!hasResolvableAddressNumber(roadAddress)) return undefined;
  const normalizedAliases = createAddressAliases(aliases, roadAddress);
  const roadLevelPrecision = !hasExplicitBuildingNumber(roadAddress);
  return { aliases: normalizedAliases, geography, roadAddress, roadLevelPrecision };
}

function createAddressAliases(aliases: readonly string[], roadAddress: string) {
  const normalized = aliases.map(normalizeAddressAlias).filter(Boolean);
  return Object.freeze([...new Set([roadAddress, ...normalized])].sort(compareKoreanText));
}

function joinDetailAddress(address: string, detailAddress: string) {
  const baseAddress = readCanonicalAddress(address);
  if (hasResolvableAddressNumber(baseAddress)) return address;
  const buildingNumber = detailAddress.match(/^\s*(\d+(?:-\d+)?)/u)?.[1];
  if (!buildingNumber) return address;
  return normalizeAddressAlias(`${baseAddress} ${buildingNumber}`);
}

function readCanonicalAddress(address: string) {
  const withoutParentheses = address.replace(/\s*\([^)]*\).*$/u, "");
  return removeParcelBuildingDescription(normalizeAddressAlias(withoutParentheses));
}

function removeParcelBuildingDescription(address: string) {
  return address.replace(/((?:동|리))\s+.+?\s+(\d+(?:-\d+)?번지)$/u, "$1 $2");
}

function normalizeAddressAlias(value: string) {
  return value
    .normalize("NFC")
    .replace(/^경기\s+/u, "경기도 ")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasResolvableAddressNumber(address: string) {
  return /\d/u.test(address);
}

function hasExplicitBuildingNumber(address: string) {
  if (/\S+(?:로|길)\s+\d+(?:-\d+)?(?:\s|$)/u.test(address)) return true;
  if (/[가-힣0-9]+(?:동|리)\s+.*\d+(?:-\d+)?번지(?:\s|$)/u.test(address)) return true;
  return /[가-힣0-9]+(?:동|리)\s+\d+(?:-\d+)?(?:\s|$)/u.test(address);
}

function readGeography(address: string): Geography | undefined {
  if (address.includes("성남시 수정구")) return seongnamGeography("수정구");
  if (address.includes("성남시 중원구")) return seongnamGeography("중원구");
  if (address.includes("성남시 분당구")) return seongnamGeography("분당구");
  if (address.includes("용인시 처인구")) return yonginGeography("처인구");
  if (address.includes("용인시 기흥구")) return yonginGeography("기흥구");
  if (address.includes("용인시 수지구")) return yonginGeography("수지구");
  return undefined;
}

function seongnamGeography(district: "수정구" | "중원구" | "분당구"): Geography {
  return { district, municipality: "SEONGNAM", municipalitySlug: "seongnam" };
}

function yonginGeography(district: "처인구" | "기흥구" | "수지구"): Geography {
  return { district, municipality: "YONGIN", municipalitySlug: "yongin" };
}

function normalizeDate(
  state: NormalizationState,
  context: LhRentalNormalizationIssue,
  rawValue: string,
): string | null {
  const value = parseDate(rawValue);
  if (!rawValue.trim()) return null;
  if (value && Number(value.slice(0, 4)) <= INVALID_FUTURE_YEAR) return value;
  const warning = createDateWarning(context, rawValue);
  state.warnings.push(warning);
  return null;
}

function parseDate(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return undefined;
  const isoDate = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (!parsed.toISOString().startsWith(isoDate)) return undefined;
  return isoDate;
}

function createDateWarning(context: LhRentalNormalizationIssue, value: string) {
  return {
    ...context,
    code: "INVALID_PROPERTY_DATE" as const,
    message: `유효하지 않은 준공·사용승인일: ${value}`,
  };
}

function excludeFutureDate(
  state: NormalizationState,
  context: LhRentalNormalizationIssue,
  date: string | null,
  asOfDate: string,
) {
  if (!date || date <= asOfDate) return false;
  state.exclusions.push({
    ...context,
    code: "FUTURE_PROPERTY",
    message: `기준일 이후 준공·사용승인 예정: ${date}`,
  });
  return true;
}

function createConstructionPreparedRecord(
  record: LhConstructionRentalCsvRecord,
  address: PreparedAddress,
  category: PublicRentalLegalCategory,
  completionDate: string | null,
): PreparedRecord {
  const offering = createConstructionOffering(record, category);
  return {
    ...address,
    completionDate,
    name: record.complexName,
    offering,
    propertyKind: readPropertyKind(category),
    propertySourceId: record.complexCode,
    sourceRecord: createSourceRecord("construction", record.complexCode),
  };
}

function createPurchasePreparedRecord(
  record: LhPurchaseRentalCsvRecord,
  address: PreparedAddress,
  category: PublicRentalLegalCategory,
  completionDate: string | null,
): PreparedRecord {
  return {
    ...address,
    completionDate,
    name: record.complexName,
    offering: createPurchaseOffering(record, category),
    propertyKind: "PURCHASE_RENTAL_BUILDING",
    propertySourceId: record.sequence,
    sourceRecord: createSourceRecord("purchase", record.sequence),
  };
}

function createConstructionOffering(
  record: LhConstructionRentalCsvRecord,
  legalCategory: PublicRentalLegalCategory,
): RentalOffering {
  const supplyArea = parseNullableNumber(record.supplyAreaSquareMeters);
  const householdCount = parseNullableNumber(record.householdCount);
  return createOffering(
    {
      sourceId: createConstructionOfferingId(record),
      legalCategory,
      supplyTypeName: record.supplyTypeName,
      styleName: nullableText(record.styleName),
    },
    supplyArea,
    householdCount,
  );
}

function createPurchaseOffering(
  record: LhPurchaseRentalCsvRecord,
  legalCategory: PublicRentalLegalCategory,
): RentalOffering {
  const supplyArea = parseNullableNumber(record.supplyAreaSquareMeters);
  const householdCount = parseNullableNumber(record.householdCount);
  return createOffering(
    {
      sourceId: record.sequence,
      legalCategory,
      supplyTypeName: record.supplyTypeName,
      styleName: null,
    },
    supplyArea,
    householdCount,
  );
}

function createOffering(
  identity: Pick<RentalOffering, "sourceId" | "legalCategory" | "supplyTypeName" | "styleName">,
  supplyArea: number | null,
  householdCount: number | null,
): RentalOffering {
  return {
    ...identity,
    supplyAreaSquareMeters: supplyArea,
    householdCount,
    exclusiveAreaSquareMeters: supplyArea,
    commonAreaSquareMeters: null,
    depositWon: null,
    monthlyRentWon: null,
  };
}

function createConstructionOfferingId(record: LhConstructionRentalCsvRecord) {
  const values = [
    record.complexCode,
    record.supplyTypeName,
    record.styleName,
    record.supplyAreaSquareMeters,
    record.householdCount,
  ];
  return values.join(":");
}

function readPropertyKind(category: PublicRentalLegalCategory): PublicRentalLocationKind {
  if (category === "PURCHASE_RENTAL") return "PURCHASE_RENTAL_BUILDING";
  return "CONSTRUCTION_RENTAL_COMPLEX";
}

function createSourceRecord(
  sourceKind: "construction" | "purchase",
  sourceId: string,
): PublicRentalSourceRecord {
  if (sourceKind === "construction") return createConstructionSourceRecord(sourceId);
  return createPurchaseSourceRecord(sourceId);
}

function createConstructionSourceRecord(sourceId: string): PublicRentalSourceRecord {
  return {
    source: "LH_CONSTRUCTION_RENTAL_CSV",
    sourceId,
    sourceUrl: CONSTRUCTION_SOURCE_URL,
    referenceDate: CONSTRUCTION_REFERENCE_DATE,
  };
}

function createPurchaseSourceRecord(sourceId: string): PublicRentalSourceRecord {
  return {
    source: "LH_PURCHASE_RENTAL_CSV",
    sourceId,
    sourceUrl: PURCHASE_SOURCE_URL,
    referenceDate: PURCHASE_REFERENCE_DATE,
  };
}

function addPreparedRecord(groups: Map<string, LocationDraft>, record: PreparedRecord) {
  const draft = readOrCreateLocationDraft(groups, record);
  record.aliases.forEach((alias) => draft.aliases.add(alias));
  const property = readOrCreatePropertyDraft(draft, record);
  property.offerings.set(record.offering.sourceId, record.offering);
}

function readOrCreateLocationDraft(groups: Map<string, LocationDraft>, record: PreparedRecord) {
  const existing = groups.get(record.roadAddress);
  if (existing) return existing;
  const created = createLocationDraft(record);
  groups.set(record.roadAddress, created);
  return created;
}

function createLocationDraft(record: PreparedRecord): LocationDraft {
  return {
    aliases: new Set(record.aliases),
    geography: record.geography,
    properties: new Map(),
    roadAddress: record.roadAddress,
  };
}

function readOrCreatePropertyDraft(draft: LocationDraft, record: PreparedRecord) {
  const key = createPropertyKey(record);
  const existing = draft.properties.get(key);
  if (existing) return existing;
  const created = createPropertyDraft(record);
  draft.properties.set(key, created);
  return created;
}

function createPropertyKey(record: PreparedRecord) {
  return `${record.sourceRecord.source}:${record.propertySourceId}`;
}

function createPropertyDraft(record: PreparedRecord): PropertyDraft {
  return {
    completionDate: record.completionDate,
    kind: record.propertyKind,
    name: record.name,
    offerings: new Map(),
    sourceId: record.propertySourceId,
    sourceRecords: [record.sourceRecord],
  };
}

function createLocations(groups: Map<string, LocationDraft>) {
  const drafts = [...groups.values()].sort(compareLocationDrafts);
  return drafts.map(createLocation);
}

function createLocation(draft: LocationDraft): PublicRentalLocation {
  const properties = createProperties(draft.properties);
  const offerings = properties.flatMap((property) => property.offerings);
  const sourceRecords = properties.flatMap((property) => property.sourceRecords);
  return {
    ...createLocationIdentity(draft, properties),
    ...createLocationDetails(draft, properties, offerings),
    coordinate: null,
    properties,
    offerings: Object.freeze(offerings),
    sourceRecords: Object.freeze(sourceRecords),
  };
}

function createLocationIdentity(draft: LocationDraft, properties: readonly PublicRentalProperty[]) {
  const primary = properties[0];
  return {
    id: createLocationIdentifier(draft),
    provider: "LH" as const,
    kind: primary?.kind ?? "CONSTRUCTION_RENTAL_COMPLEX",
    municipality: draft.geography.municipality,
    district: draft.geography.district,
    legalCategories: readLegalCategories(properties),
    name: primary?.name ?? draft.roadAddress,
  };
}

function createLocationDetails(
  draft: LocationDraft,
  properties: readonly PublicRentalProperty[],
  offerings: readonly RentalOffering[],
) {
  return {
    roadAddress: draft.roadAddress,
    addressAliases: Object.freeze([...draft.aliases].sort(compareKoreanText)),
    parcelNumber: null,
    householdCount: sumOfferingHouseholds(offerings),
    completionDate: readAggregateCompletionDate(properties),
  };
}

function createProperties(drafts: Map<string, PropertyDraft>) {
  return Object.freeze([...drafts.values()].sort(comparePropertyDrafts).map(createProperty));
}

function createProperty(draft: PropertyDraft): PublicRentalProperty {
  const offerings = Object.freeze([...draft.offerings.values()].sort(compareOfferings));
  return {
    sourceId: draft.sourceId,
    name: draft.name,
    kind: draft.kind,
    parcelNumber: null,
    householdCount: sumOfferingHouseholds(offerings),
    completionDate: draft.completionDate,
    offerings,
    sourceRecords: Object.freeze([...draft.sourceRecords]),
  };
}

function readLegalCategories(properties: readonly PublicRentalProperty[]) {
  const categories = new Set(properties.flatMap(readPropertyCategories));
  return Object.freeze(CATEGORY_ORDER.filter((category) => categories.has(category)));
}

function readPropertyCategories(property: PublicRentalProperty) {
  return property.offerings.map((offering) => offering.legalCategory);
}

function readAggregateCompletionDate(properties: readonly PublicRentalProperty[]) {
  const dates = properties.flatMap(readPropertyDate).sort();
  return dates[0] ?? null;
}

function readPropertyDate(property: PublicRentalProperty) {
  if (!property.completionDate) return [];
  return [property.completionDate];
}

function sumOfferingHouseholds(offerings: Iterable<RentalOffering>) {
  return [...offerings].reduce(addOfferingHouseholds, 0);
}

function addOfferingHouseholds(total: number, offering: RentalOffering) {
  return total + (offering.householdCount ?? 0);
}

function createLocationIdentifier(draft: LocationDraft) {
  const hash = createHash("sha256").update(draft.roadAddress).digest("hex").slice(0, 16);
  return `lh:${draft.geography.municipalitySlug}:${hash}`;
}

function assertNoIdentifierCollisions(locations: readonly PublicRentalLocation[]) {
  const addresses = new Map<string, string>();
  locations.forEach((location) => assertLocationIdentifier(addresses, location));
}

function assertLocationIdentifier(addresses: Map<string, string>, location: PublicRentalLocation) {
  const previous = addresses.get(location.id);
  if (previous && previous !== location.roadAddress) {
    throw new Error(`위치 ID 해시 충돌: ${location.id}`);
  }
  addresses.set(location.id, location.roadAddress);
}

function createNormalizationResult(
  state: NormalizationState,
  locations: readonly PublicRentalLocation[],
): LhRentalCsvNormalizationResult {
  return {
    exclusions: Object.freeze([...state.exclusions]),
    locations: new PublicRentalLocations(locations),
    warnings: Object.freeze([...state.warnings]),
  };
}

function constructionIssueContext(
  record: LhConstructionRentalCsvRecord,
): LhRentalNormalizationIssue {
  return {
    address: record.address,
    code: "MISSING_REQUIRED_FIELD",
    message: record.supplyTypeName,
    sourceId: record.complexCode,
    sourceKind: "construction",
  };
}

function purchaseIssueContext(record: LhPurchaseRentalCsvRecord): LhRentalNormalizationIssue {
  return {
    address: record.address,
    code: "MISSING_REQUIRED_FIELD",
    message: record.supplyTypeName,
    sourceId: record.sequence,
    sourceKind: "purchase",
  };
}

function parseNullableNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function nullableText(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function compareLocationDrafts(first: LocationDraft, second: LocationDraft) {
  return compareKoreanText(first.roadAddress, second.roadAddress);
}

function comparePropertyDrafts(first: PropertyDraft, second: PropertyDraft) {
  const kindComparison = first.kind.localeCompare(second.kind);
  if (kindComparison !== 0) return kindComparison;
  return compareKoreanText(first.sourceId, second.sourceId);
}

function compareOfferings(first: RentalOffering, second: RentalOffering) {
  return compareKoreanText(first.sourceId, second.sourceId);
}

function compareKoreanText(first: string, second: string) {
  return first.localeCompare(second, "ko");
}
