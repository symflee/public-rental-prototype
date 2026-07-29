import type { PublicRentalLocation } from "@/domain/public-rental";
import { createGyeonggiMunicipalities } from "@/domain/public-rental/gyeonggi-geography";
import type {
  LhRentalNormalizationIssue,
  LhRentalNormalizationIssueCode,
} from "@/infrastructure/public-data/lh-rental-csv-normalizer";

import type { CoordinateResolutionFailure } from "./kakao-coordinate-resolver";
import type { RoadLevelLocationWarning } from "./lh-rental-csv-publication";

type ParseIssue = Readonly<{ code: string; [field: string]: unknown }>;

export type LhRentalCollectionReportInput = Readonly<{
  constructionFileName: string;
  constructionParseIssues: readonly ParseIssue[];
  constructionRecords: readonly unknown[];
  exclusions: readonly LhRentalNormalizationIssue[];
  generatedAt: string;
  geocodingFailures: readonly CoordinateResolutionFailure[];
  locations: readonly PublicRentalLocation[];
  purchaseFileName: string;
  purchaseParseIssues: readonly ParseIssue[];
  purchaseRecords: readonly unknown[];
  roadLevelWarnings: readonly RoadLevelLocationWarning[];
  warnings: readonly LhRentalNormalizationIssue[];
}>;

export function createLhRentalCollectionReport(input: LhRentalCollectionReportInput) {
  return {
    generatedAt: input.generatedAt,
    normalization: createNormalizationReport(input),
    publication: createPublicationReport(input),
    schemaVersion: 2,
    sources: createSourceReport(input),
    status: readReportStatus(input),
  };
}

function createSourceReport(input: LhRentalCollectionReportInput) {
  return {
    construction: createSourceDetails(
      input.constructionFileName,
      input.constructionRecords,
      input.constructionParseIssues,
    ),
    purchase: createSourceDetails(
      input.purchaseFileName,
      input.purchaseRecords,
      input.purchaseParseIssues,
    ),
  };
}

function createSourceDetails(
  fileName: string,
  records: readonly unknown[],
  parseIssues: readonly ParseIssue[],
) {
  return {
    duplicateRowCount: countExactDuplicateRows(records),
    fileName,
    parseIssues,
    recordCount: records.length,
  };
}

function createNormalizationReport(input: LhRentalCollectionReportInput) {
  return {
    exclusionCounts: countIssueCodes(input.exclusions),
    exclusions: input.exclusions.filter(isTargetIssue),
    warningCounts: countIssueCodes(input.warnings),
    warnings: input.warnings.filter(isTargetIssue),
  };
}

function createPublicationReport(input: LhRentalCollectionReportInput) {
  return {
    coordinateCount: input.locations.filter(hasCoordinate).length,
    geocodingFailures: input.geocodingFailures,
    locationCount: input.locations.length,
    municipalities: countMunicipalities(input.locations),
    offeringCount: input.locations.flatMap((location) => location.offerings).length,
    propertyCount: input.locations.flatMap((location) => location.properties).length,
    roadLevelWarnings: input.roadLevelWarnings,
  };
}

function readReportStatus(input: LhRentalCollectionReportInput) {
  if (input.constructionParseIssues.length > 0) return "blocked" as const;
  if (input.purchaseParseIssues.length > 0) return "blocked" as const;
  if (input.geocodingFailures.length > 0) return "blocked" as const;
  return "verified" as const;
}

function countExactDuplicateRows(records: readonly unknown[]) {
  const counts = new Map<string, number>();
  records.forEach((record) => incrementCount(counts, JSON.stringify(record)));
  return [...counts.values()].reduce(countDuplicateRows, 0);
}

function countDuplicateRows(total: number, count: number) {
  return total + Math.max(count - 1, 0);
}

function countIssueCodes(issues: readonly LhRentalNormalizationIssue[]) {
  const counts = new Map<LhRentalNormalizationIssueCode, number>();
  issues.forEach((issue) => incrementCount(counts, issue.code));
  return Object.fromEntries(counts);
}

function countMunicipalities(locations: readonly PublicRentalLocation[]) {
  const counts = createMunicipalityCounts();
  locations.forEach((location) => incrementMunicipalityCount(counts, location));
  return counts;
}

function createMunicipalityCounts() {
  return Object.fromEntries(createGyeonggiMunicipalities().map(createMunicipalityCount));
}

function createMunicipalityCount(municipality: PublicRentalLocation["municipality"]) {
  return [municipality, 0] as const;
}

function incrementMunicipalityCount(
  counts: Record<string, number>,
  location: PublicRentalLocation,
) {
  counts[location.municipality] = (counts[location.municipality] ?? 0) + 1;
}

function incrementCount<Key>(counts: Map<Key, number>, key: Key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function hasCoordinate(location: PublicRentalLocation) {
  return location.coordinate !== null;
}

function isTargetIssue(issue: LhRentalNormalizationIssue) {
  if (issue.address.includes("성남시")) return true;
  return issue.address.includes("용인시");
}
