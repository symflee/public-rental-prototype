import {
  validatePublicRentalLocations,
  type PublicRentalLocation,
  type PublicRentalProperty,
  type PublicRentalValidationIssue,
  type RentalOffering,
} from "@/domain/public-rental";

const CSV_HEADERS = [
  "locationId",
  "provider",
  "municipality",
  "district",
  "locationKind",
  "legalCategory",
  "name",
  "roadAddress",
  "addressAliases",
  "parcelNumber",
  "latitude",
  "longitude",
  "householdCount",
  "completionDate",
  "recruitmentNoticeIds",
  "recruitmentNoticeTitles",
  "recruitmentNoticeUrls",
  "recruitmentNoticeDates",
  "propertySourceId",
  "propertyName",
  "propertyKind",
  "propertyHouseholdCount",
  "propertyCompletionDate",
  "offeringSourceId",
  "supplyTypeName",
  "styleName",
  "supplyAreaSquareMeters",
  "offeringHouseholdCount",
  "exclusiveAreaSquareMeters",
  "commonAreaSquareMeters",
  "depositWon",
  "monthlyRentWon",
  "sourceUrls",
  "sourceReferenceDates",
] as const;

export type PublicRentalSnapshot = Readonly<{
  generatedAt: string;
  locations: readonly PublicRentalLocation[];
  schemaVersion: 2;
  status: "partial" | "verified";
}>;

export function createPublicRentalSnapshot(
  generatedAt: string,
  locations: readonly PublicRentalLocation[],
): PublicRentalSnapshot {
  const issues = validatePublicRentalLocations(locations);
  if (issues.length > 0) throw createValidationError(issues);
  return {
    generatedAt,
    locations: Object.freeze([...locations].sort(compareLocationIdentifiers)),
    schemaVersion: 2,
    status: "verified",
  };
}

function createValidationError(issues: readonly PublicRentalValidationIssue[]) {
  const details = issues.map(formatValidationIssue).join("\n");
  return new Error(`공공임대 배포 조건을 충족하지 못했습니다: ${issues.length}건\n${details}`);
}

function formatValidationIssue(issue: PublicRentalValidationIssue) {
  return `- ${issue.locationId} [${issue.code}] ${issue.message}`;
}

export function createPublicRentalReviewCsv(locations: readonly PublicRentalLocation[]) {
  const rows = locations.flatMap(createLocationRows);
  return `\uFEFF${[CSV_HEADERS, ...rows].map(createCsvRow).join("\n")}\n`;
}

function createLocationRows(location: PublicRentalLocation) {
  if (location.properties.length === 0) return [createLocationRow(location)];
  return location.properties.flatMap((property) => createPropertyRows(location, property));
}

function createPropertyRows(location: PublicRentalLocation, property: PublicRentalProperty) {
  if (property.offerings.length === 0) return [createLocationRow(location, property)];
  return property.offerings.map((offering) => createLocationRow(location, property, offering));
}

function createLocationRow(
  location: PublicRentalLocation,
  property?: PublicRentalProperty,
  offering?: RentalOffering,
) {
  return [
    ...createLocationIdentityCells(location),
    ...createPropertyCells(property),
    ...createOfferingCells(offering),
    createSourceUrls(property?.sourceRecords ?? location.sourceRecords),
    createSourceReferenceDates(property?.sourceRecords ?? location.sourceRecords),
  ];
}

function createLocationIdentityCells(location: PublicRentalLocation) {
  return [
    location.id,
    location.provider,
    location.municipality,
    location.district,
    location.kind,
    location.legalCategories.join("|"),
    location.name,
    location.roadAddress,
    location.addressAliases.join("|"),
    location.parcelNumber ?? "",
    serializeNumber(location.coordinate?.latitude),
    serializeNumber(location.coordinate?.longitude),
    serializeNumber(location.householdCount),
    location.completionDate ?? "",
    ...createRecruitmentNoticeCells(location),
  ];
}

function createRecruitmentNoticeCells(location: PublicRentalLocation) {
  const notices = location.recruitmentNotices ?? [];
  return [
    notices.map((notice) => notice.id).join("|"),
    notices.map((notice) => notice.title).join("|"),
    notices.map((notice) => notice.url).join("|"),
    notices.flatMap(readNoticeDate).join("|"),
  ];
}

function readNoticeDate(notice: NonNullable<PublicRentalLocation["recruitmentNotices"]>[number]) {
  if (!notice.announcedAt) return [];
  return [notice.announcedAt];
}

function createPropertyCells(property: PublicRentalProperty | undefined) {
  if (!property) return ["", "", "", "", ""];
  return [
    property.sourceId,
    property.name,
    property.kind,
    serializeNumber(property.householdCount),
    property.completionDate ?? "",
  ];
}

function createOfferingCells(offering: RentalOffering | undefined) {
  if (!offering) return ["", "", "", "", "", "", "", "", ""];
  return [
    offering.sourceId,
    offering.supplyTypeName,
    offering.styleName ?? "",
    serializeNumber(offering.supplyAreaSquareMeters),
    serializeNumber(offering.householdCount),
    serializeNumber(offering.exclusiveAreaSquareMeters),
    serializeNumber(offering.commonAreaSquareMeters),
    serializeNumber(offering.depositWon),
    serializeNumber(offering.monthlyRentWon),
  ];
}

function createSourceUrls(sourceRecords: PublicRentalLocation["sourceRecords"]) {
  return sourceRecords.map((source) => source.sourceUrl).join("|");
}

function createSourceReferenceDates(sourceRecords: PublicRentalLocation["sourceRecords"]) {
  const dates = sourceRecords.flatMap(readReferenceDate);
  return [...new Set(dates)].join("|");
}

function readReferenceDate(source: PublicRentalLocation["sourceRecords"][number]) {
  if (!source.referenceDate) return [];
  return [source.referenceDate];
}

function createCsvRow(values: readonly string[]) {
  return values.map(escapeCsvValue).join(",");
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function serializeNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function compareLocationIdentifiers(first: PublicRentalLocation, second: PublicRentalLocation) {
  return first.id.localeCompare(second.id, "ko");
}
