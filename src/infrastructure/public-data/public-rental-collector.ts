import {
  createSeongnamCityPublicRentalLocations,
  normalizeMyHomeRecords,
  type MyHomeRawRecord,
  type PublicRentalLocation,
} from "@/domain/public-rental";
import {
  reviewPublicRentalSources,
  type PublicRentalReviewIssue,
  type PublicRentalReviewSummary,
} from "@/infrastructure/public-rental-review";

import { geocodeKakaoAddress, type KakaoAddressGeocodeResult } from "./kakao-address-geocoder";
import {
  collectSeongnamLhLeaseVerificationRecords,
  type LhLeaseCollectionIssue,
  type LhLeaseCollectionResult,
} from "./lh-lease-verification-client";
import {
  collectMyHomePublicRentalRecords,
  type MyHomeCollectionResult,
} from "./my-home-public-rental-client";
import {
  createPublicRentalReviewCsv,
  createPublicRentalSnapshot,
  type PublicRentalSnapshot,
} from "./public-rental-artifacts";
import type { PublicDataFetch } from "./public-data-http";
import {
  parseLhApartmentVerificationCandidates,
  parseSeongnamApartmentVerificationCandidates,
  type CsvVerificationIssue,
  type LhApartmentVerificationCandidate,
  type SeongnamApartmentVerificationCandidate,
} from "./verification-csv-parsers";

const SOURCE_URLS = {
  citySeed: "https://www.isdc.co.kr/operBusiness/dandaedong.asp",
  lhApartmentCsv: "https://www.data.go.kr/data/15080989/fileData.do",
  lhLeaseApi: "https://www.data.go.kr/data/15059475/openapi.do",
  myHomeApi: "https://www.data.go.kr/data/15110581/openapi.do",
  seongnamApartmentCsv: "https://www.data.go.kr/data/15000796/fileData.do",
} as const;
const BLOCKING_REVIEW_CODES = new Set([
  "ADDRESS_CONFLICT",
  "ADDRESS_REFERENCE_MISSING",
  "HOUSEHOLD_COUNT_CONFLICT",
  "NAME_CONFLICT",
  "PUBLISHED_LOCATION_MISSING",
]);

export type PublicRentalCollectionConfiguration = Readonly<{
  generatedAt: string;
  kakaoRestApiKey: string;
  lhApartmentCsvText?: string;
  publicDataPortalServiceKey: string;
  seongnamApartmentCsvText?: string;
}>;

export type PublicRentalCollectionServices = {
  collectLhLeaseRecords: (serviceKey: string) => Promise<LhLeaseCollectionResult>;
  collectMyHomeRecords: (serviceKey: string) => Promise<MyHomeCollectionResult>;
  geocodeAddress: (address: string, restApiKey: string) => Promise<KakaoAddressGeocodeResult>;
};

export type CollectionSourceStatus = "not-run" | "review-required" | "verified";
export type CollectionReportStatus = "review-required" | "verified";

export type CollectionSourceReport = Readonly<{
  collectedRecords: number;
  errorCount: number;
  id: string;
  status: CollectionSourceStatus;
  url: string;
}>;

export type CollectionRecordSummary = Readonly<{
  address: string | null;
  name: string | null;
  provider: string | null;
  sourceId: string | null;
  supplyType: string | null;
}>;

export type CollectionDuplicateSummary = Readonly<{
  count: number;
  name: string | null;
  sourceId: string | null;
}>;

export type CollectionReport = Readonly<{
  collectionIssues: readonly CollectionIssue[];
  counts: CollectionCounts;
  duplicateRecords: readonly CollectionDuplicateSummary[];
  excludedRecords: readonly CollectionRecordSummary[];
  generatedAt: string;
  reviewIssues: readonly PublicRentalReviewIssue[];
  reviewSummaries: readonly PublicRentalReviewSummary[];
  schemaVersion: 1;
  scope: CollectionScope;
  sources: readonly CollectionSourceReport[];
  status: CollectionReportStatus;
}>;

export type PublicRentalCollectionArtifacts = Readonly<{
  report: CollectionReport;
  reviewCsv: string;
  snapshot: PublicRentalSnapshot;
}>;

type CollectionIssue = Readonly<{
  code: string;
  message: string;
  source: string;
  sourceId?: string;
}>;

type CollectionScope = Readonly<{
  excludedCategories: readonly string[];
  includedMunicipalLocationIds: readonly string[];
  includedProviders: readonly string[];
  municipality: "성남시";
}>;

type CollectionCounts = Readonly<{
  duplicateRecords: number;
  excludedRecords: number;
  groupedOfferingRows: number;
  publishedLhLocations: number;
  publishedLocations: number;
  publishedMunicipalLocations: number;
  rawMyHomeRecords: number;
  reviewIssues: number;
}>;

type SupplementalCandidates = Readonly<{
  cityConfigured: boolean;
  cityIssues: readonly CsvVerificationIssue[];
  cityValues: readonly SeongnamApartmentVerificationCandidate[];
  lhConfigured: boolean;
  lhIssues: readonly CsvVerificationIssue[];
  lhValues: readonly LhApartmentVerificationCandidate[];
}>;

type SourceResults = Readonly<{
  lhLease: LhLeaseCollectionResult;
  myHome: MyHomeCollectionResult;
}>;

type CollectionContext = Readonly<{
  configuration: PublicRentalCollectionConfiguration;
  locations: readonly PublicRentalLocation[];
  review: ReturnType<typeof createSourceReview>;
  sourceResults: SourceResults;
  supplemental: SupplementalCandidates;
}>;

type RecordAnalysis = Readonly<{
  duplicateRecords: readonly CollectionDuplicateSummary[];
  excludedRecords: readonly CollectionRecordSummary[];
}>;

export function createPublicRentalCollectionServices(
  fetchFunction: PublicDataFetch,
): PublicRentalCollectionServices {
  return {
    collectLhLeaseRecords: (serviceKey) =>
      collectSeongnamLhLeaseVerificationRecords({ fetchFunction, serviceKey }),
    collectMyHomeRecords: (serviceKey) =>
      collectMyHomePublicRentalRecords({ fetchFunction, serviceKey }),
    geocodeAddress: (address, restApiKey) =>
      geocodeKakaoAddress(address, { fetchFunction, restApiKey }),
  };
}

export async function collectPublicRentalArtifacts(
  configuration: PublicRentalCollectionConfiguration,
  services: PublicRentalCollectionServices,
): Promise<PublicRentalCollectionArtifacts> {
  const context = await createCollectionContext(configuration, services);
  return createCollectionArtifacts(context);
}

async function createCollectionContext(
  configuration: PublicRentalCollectionConfiguration,
  services: PublicRentalCollectionServices,
): Promise<CollectionContext> {
  const sourceResults = await collectSourceResults(configuration, services);
  assertMyHomeCollection(sourceResults.myHome);
  const locations = await createPublishedLocations(configuration, services, sourceResults.myHome);
  const supplemental = parseSupplementalCandidates(configuration);
  const review = createSourceReview(locations, sourceResults.lhLease, supplemental);
  return { configuration, locations, review, sourceResults, supplemental };
}

function createCollectionArtifacts(context: CollectionContext): PublicRentalCollectionArtifacts {
  return {
    report: createCollectionReport(context),
    reviewCsv: createPublicRentalReviewCsv(context.locations),
    snapshot: createPublicRentalSnapshot(context.configuration.generatedAt, context.locations),
  };
}

async function collectSourceResults(
  configuration: PublicRentalCollectionConfiguration,
  services: PublicRentalCollectionServices,
) {
  const key = configuration.publicDataPortalServiceKey;
  const [myHome, lhLease] = await Promise.all([
    services.collectMyHomeRecords(key),
    services.collectLhLeaseRecords(key),
  ]);
  return { lhLease, myHome };
}

function assertMyHomeCollection(result: MyHomeCollectionResult) {
  if (result.collectionIssues.length === 0) return;
  throw new Error(`마이홈 API 수집 문제 ${result.collectionIssues.length}건을 해결해야 합니다.`);
}

async function createPublishedLocations(
  configuration: PublicRentalCollectionConfiguration,
  services: PublicRentalCollectionServices,
  result: MyHomeCollectionResult,
) {
  const referenceDate = configuration.generatedAt.slice(0, 10);
  const normalized = normalizeMyHomeRecords(result.records, referenceDate);
  assertLhLocationsFound(normalized.values);
  const combined = appendMunicipalLocations(normalized.values);
  const dated = combined.map((location) => attachReferenceDates(location, referenceDate));
  return geocodeLocations(dated, configuration.kakaoRestApiKey, services.geocodeAddress);
}

function assertLhLocationsFound(locations: readonly PublicRentalLocation[]) {
  if (locations.length > 0) return;
  throw new Error("성남시 LH 공공임대 위치를 한 건도 찾지 못했습니다.");
}

function appendMunicipalLocations(locations: readonly PublicRentalLocation[]) {
  const municipalLocations = createSeongnamCityPublicRentalLocations().values;
  return [...locations, ...municipalLocations];
}

function attachReferenceDates(location: PublicRentalLocation, referenceDate: string) {
  return {
    ...location,
    sourceRecords: location.sourceRecords.map((source) => ({
      ...source,
      referenceDate: source.referenceDate ?? referenceDate,
    })),
  };
}

async function geocodeLocations(
  locations: readonly PublicRentalLocation[],
  restApiKey: string,
  geocodeAddress: PublicRentalCollectionServices["geocodeAddress"],
) {
  const results = await Promise.all(
    locations.map((location) => geocodeLocation(location, restApiKey, geocodeAddress)),
  );
  const failures = results.filter(isGeocodeFailure);
  if (failures.length > 0) throw createGeocodeError(failures);
  return results.flatMap(readGeocodedLocation);
}

async function geocodeLocation(
  location: PublicRentalLocation,
  restApiKey: string,
  geocodeAddress: PublicRentalCollectionServices["geocodeAddress"],
) {
  if (location.coordinate) return { location, success: true as const };
  const result = await geocodeAddress(location.roadAddress, restApiKey);
  if (!result.success) return { failure: result.failure, location, success: false as const };
  return { location: attachCoordinate(location, result.coordinate), success: true as const };
}

function attachCoordinate(
  location: PublicRentalLocation,
  coordinate: Readonly<{ latitude: number; longitude: number }>,
): PublicRentalLocation {
  return { ...location, coordinate: { ...coordinate, source: "KAKAO_ADDRESS_SEARCH" } };
}

function isGeocodeFailure(result: Awaited<ReturnType<typeof geocodeLocation>>) {
  return !result.success;
}

function createGeocodeError(failures: readonly Awaited<ReturnType<typeof geocodeLocation>>[]) {
  const names = failures.map((result) => result.location.name).join(", ");
  return new Error(`좌표를 확인하지 못한 위치가 있습니다: ${names}`);
}

function readGeocodedLocation(
  result: Awaited<ReturnType<typeof geocodeLocation>>,
): PublicRentalLocation[] {
  if (!result.success) return [];
  return [result.location];
}

function parseSupplementalCandidates(
  configuration: PublicRentalCollectionConfiguration,
): SupplementalCandidates {
  const lh = parseOptionalLhCsv(configuration.lhApartmentCsvText);
  const city = parseOptionalCityCsv(configuration.seongnamApartmentCsvText);
  return {
    cityConfigured: configuration.seongnamApartmentCsvText !== undefined,
    cityIssues: city.collectionIssues,
    cityValues: city.candidates,
    lhConfigured: configuration.lhApartmentCsvText !== undefined,
    lhIssues: lh.collectionIssues,
    lhValues: lh.candidates,
  };
}

function parseOptionalLhCsv(text: string | undefined) {
  if (text === undefined) return { candidates: [], collectionIssues: [] };
  return parseLhApartmentVerificationCandidates(text);
}

function parseOptionalCityCsv(text: string | undefined) {
  if (text === undefined) return { candidates: [], collectionIssues: [] };
  return parseSeongnamApartmentVerificationCandidates(text);
}

function createSourceReview(
  locations: readonly PublicRentalLocation[],
  leaseResult: LhLeaseCollectionResult,
  supplemental: SupplementalCandidates,
) {
  const review = reviewPublicRentalSources(
    locations,
    leaseResult.records,
    supplemental.lhValues,
    supplemental.cityValues,
  );
  if (supplemental.cityConfigured) return review;
  return { ...review, issues: review.issues.filter(isNotUnconfiguredCityIssue) };
}

function isNotUnconfiguredCityIssue(issue: PublicRentalReviewIssue) {
  if (issue.source !== "seongnam-apartment-csv") return true;
  return issue.code !== "ADDRESS_REFERENCE_MISSING";
}

function createCollectionReport(context: CollectionContext): CollectionReport {
  const records = context.sourceResults.myHome.records;
  const analysis = createRecordAnalysis(records, context.configuration.generatedAt);
  const collectionIssues = createCollectionIssues(
    context.sourceResults.myHome.records,
    context.sourceResults.lhLease,
    context.supplemental,
  );
  return assembleCollectionReport(context, analysis, collectionIssues);
}

function createRecordAnalysis(
  records: readonly MyHomeRawRecord[],
  generatedAt: string,
): RecordAnalysis {
  return {
    duplicateRecords: findDuplicateRecords(records),
    excludedRecords: findExcludedRecords(records, generatedAt),
  };
}

function assembleCollectionReport(
  context: CollectionContext,
  analysis: RecordAnalysis,
  collectionIssues: readonly CollectionIssue[],
): CollectionReport {
  return {
    ...createReportIdentity(context, collectionIssues),
    ...createReportEvidence(context, analysis, collectionIssues),
  };
}

function createReportIdentity(
  context: CollectionContext,
  collectionIssues: readonly CollectionIssue[],
) {
  const blockingIssues = countBlockingIssues(context.review.issues, collectionIssues);
  return {
    generatedAt: context.configuration.generatedAt,
    schemaVersion: 1 as const,
    scope: createCollectionScope(),
    status: readReportStatus(blockingIssues),
  };
}

function createReportEvidence(
  context: CollectionContext,
  analysis: RecordAnalysis,
  collectionIssues: readonly CollectionIssue[],
) {
  return {
    collectionIssues,
    counts: createCounts(context, analysis),
    duplicateRecords: analysis.duplicateRecords,
    excludedRecords: analysis.excludedRecords,
    reviewIssues: context.review.issues,
    reviewSummaries: context.review.summaries,
    sources: createSourceReports(context),
  };
}

function createCollectionScope(): CollectionScope {
  return {
    excludedCategories: [
      "다솜마을",
      "GH",
      "민간임대",
      "공공분양",
      "계획사업",
      "주소 없는 전세임대 집계",
    ],
    includedMunicipalLocationIds: ["seongnam:dandae-happy-housing"],
    includedProviders: ["LH", "SEONGNAM_CITY"],
    municipality: "성남시",
  };
}

function findExcludedRecords(records: readonly MyHomeRawRecord[], generatedAt: string) {
  const referenceDate = generatedAt.slice(0, 10);
  return records
    .filter((record) => normalizeMyHomeRecords([record], referenceDate).values.length === 0)
    .map(createRecordSummary);
}

function createRecordSummary(record: MyHomeRawRecord): CollectionRecordSummary {
  return {
    address: record.rnAdres ?? null,
    name: record.hsmpNm ?? null,
    provider: record.insttNm ?? null,
    sourceId: record.hsmpSn ?? null,
    supplyType: record.suplyTyNm ?? null,
  };
}

function findDuplicateRecords(records: readonly MyHomeRawRecord[]) {
  const groups = new Map<string, MyHomeRawRecord[]>();
  records.forEach((record) => addDuplicateGroup(groups, record));
  return [...groups.values()].filter(hasDuplicates).map(createDuplicateSummary);
}

function addDuplicateGroup(groups: Map<string, MyHomeRawRecord[]>, record: MyHomeRawRecord) {
  const signature = JSON.stringify(record);
  const existing = groups.get(signature) ?? [];
  groups.set(signature, [...existing, record]);
}

function hasDuplicates(records: readonly MyHomeRawRecord[]) {
  return records.length > 1;
}

function createDuplicateSummary(records: readonly MyHomeRawRecord[]) {
  const record = records[0];
  return {
    count: records.length,
    name: record?.hsmpNm ?? null,
    sourceId: record?.hsmpSn ?? null,
  };
}

function createCollectionIssues(
  myHomeRecords: readonly MyHomeRawRecord[],
  leaseResult: LhLeaseCollectionResult,
  supplemental: SupplementalCandidates,
) {
  return [
    ...findMyHomeIdentityIssues(myHomeRecords),
    ...leaseResult.collectionIssues.map(createLeaseIssue),
    ...supplemental.lhIssues.map(createLhCsvIssue),
    ...supplemental.cityIssues.map(createCityCsvIssue),
  ];
}

function findMyHomeIdentityIssues(records: readonly MyHomeRawRecord[]) {
  const groups = new Map<string, MyHomeRawRecord[]>();
  records.forEach((record) => addMyHomeIdentityGroup(groups, record));
  return [...groups.entries()].flatMap(([sourceId, values]) =>
    createMyHomeIdentityIssues(sourceId, values),
  );
}

function addMyHomeIdentityGroup(groups: Map<string, MyHomeRawRecord[]>, record: MyHomeRawRecord) {
  const sourceId = record.hsmpSn?.trim();
  if (!sourceId) return;
  groups.set(sourceId, [...(groups.get(sourceId) ?? []), record]);
}

function createMyHomeIdentityIssues(sourceId: string, records: readonly MyHomeRawRecord[]) {
  return [
    ...createMyHomeFieldIssue(sourceId, records, "name-conflict", readRecordName),
    ...createMyHomeFieldIssue(sourceId, records, "address-conflict", readRecordAddress),
  ];
}

function createMyHomeFieldIssue(
  sourceId: string,
  records: readonly MyHomeRawRecord[],
  code: string,
  readValue: (record: MyHomeRawRecord) => string,
) {
  const values = new Set(records.map(readValue).filter(hasText));
  if (values.size <= 1) return [];
  const message = `같은 hsmpSn(${sourceId})의 이름 또는 주소가 서로 다릅니다.`;
  return [{ code, message, source: "my-home-public-rental-api", sourceId }];
}

function readRecordName(record: MyHomeRawRecord) {
  return normalizeIdentityText(record.hsmpNm);
}

function readRecordAddress(record: MyHomeRawRecord) {
  return normalizeIdentityText(record.rnAdres);
}

function normalizeIdentityText(value: string | undefined) {
  return value?.normalize("NFKC").replace(/\s+/g, "") ?? "";
}

function hasText(value: string) {
  return value.length > 0;
}

function createLeaseIssue(issue: LhLeaseCollectionIssue): CollectionIssue {
  return { code: issue.kind, message: issue.message, source: "lh-lease-api" };
}

function createLhCsvIssue(issue: CsvVerificationIssue): CollectionIssue {
  return { code: "csv-error", message: issue.message, source: "lh-national-apartment-csv" };
}

function createCityCsvIssue(issue: CsvVerificationIssue): CollectionIssue {
  return { code: "csv-error", message: issue.message, source: "seongnam-apartment-csv" };
}

function countBlockingIssues(
  reviewIssues: readonly PublicRentalReviewIssue[],
  collectionIssues: readonly CollectionIssue[],
) {
  const reviewCount = reviewIssues.filter(isBlockingReviewIssue).length;
  return reviewCount + collectionIssues.length;
}

function isBlockingReviewIssue(issue: PublicRentalReviewIssue) {
  return BLOCKING_REVIEW_CODES.has(issue.code);
}

function createCounts(context: CollectionContext, analysis: RecordAnalysis): CollectionCounts {
  const lhLocations = context.locations.filter((location) => location.provider === "LH");
  const offeringCount = lhLocations.reduce(countOfferings, 0);
  return {
    ...createRecordCounts(context, analysis),
    groupedOfferingRows: Math.max(0, offeringCount - lhLocations.length),
    publishedLhLocations: lhLocations.length,
    publishedLocations: context.locations.length,
    publishedMunicipalLocations: context.locations.length - lhLocations.length,
  };
}

function createRecordCounts(context: CollectionContext, analysis: RecordAnalysis) {
  return {
    duplicateRecords: analysis.duplicateRecords.length,
    excludedRecords: analysis.excludedRecords.length,
    rawMyHomeRecords: context.sourceResults.myHome.records.length,
    reviewIssues: context.review.issues.length,
  };
}

function countOfferings(total: number, location: PublicRentalLocation) {
  return total + location.offerings.length;
}

function createSourceReports(context: CollectionContext): readonly CollectionSourceReport[] {
  return [
    ...createPrimarySourceReports(context),
    ...createCsvSourceReports(context.supplemental, context.review.summaries),
  ];
}

function createPrimarySourceReports(context: CollectionContext) {
  return [
    createSourceReport(
      "my-home-public-rental-api",
      SOURCE_URLS.myHomeApi,
      "verified",
      context.sourceResults.myHome.records.length,
      0,
    ),
    createSourceReport("seongnam-dandae-managed-seed", SOURCE_URLS.citySeed, "verified", 1, 0),
    createLeaseSourceReport(context.sourceResults.lhLease, context.review.summaries),
  ];
}

function createCsvSourceReports(
  supplemental: SupplementalCandidates,
  summaries: readonly PublicRentalReviewSummary[],
) {
  return [
    createLhCsvSourceReport(supplemental, summaries),
    createCityCsvSourceReport(supplemental, summaries),
  ];
}

function createLhCsvSourceReport(
  supplemental: SupplementalCandidates,
  summaries: readonly PublicRentalReviewSummary[],
) {
  const conflicts = readConflictCount(summaries, "lh-national-apartment-csv");
  return createCsvSourceReport(
    "lh-national-apartment-csv",
    SOURCE_URLS.lhApartmentCsv,
    supplemental.lhConfigured,
    supplemental.lhValues.length,
    supplemental.lhIssues.length,
    conflicts,
  );
}

function createCityCsvSourceReport(
  supplemental: SupplementalCandidates,
  summaries: readonly PublicRentalReviewSummary[],
) {
  const conflicts = readConflictCount(summaries, "seongnam-apartment-csv");
  return createCsvSourceReport(
    "seongnam-apartment-csv",
    SOURCE_URLS.seongnamApartmentCsv,
    supplemental.cityConfigured,
    supplemental.cityValues.length,
    supplemental.cityIssues.length,
    conflicts,
  );
}

function createLeaseSourceReport(
  result: LhLeaseCollectionResult,
  summaries: readonly PublicRentalReviewSummary[],
) {
  const conflicts = readConflictCount(summaries, "lh-lease-api");
  const status = readSourceStatus(true, result.collectionIssues.length + conflicts);
  return createSourceReport(
    "lh-lease-api",
    SOURCE_URLS.lhLeaseApi,
    status,
    result.records.length,
    result.collectionIssues.length,
  );
}

function createCsvSourceReport(
  id: string,
  url: string,
  configured: boolean,
  collectedRecords: number,
  errorCount: number,
  conflictCount: number,
) {
  const status = readSourceStatus(configured, errorCount + conflictCount);
  return createSourceReport(id, url, status, collectedRecords, errorCount);
}

function readConflictCount(
  summaries: readonly PublicRentalReviewSummary[],
  source: PublicRentalReviewSummary["source"],
) {
  return summaries.find((summary) => summary.source === source)?.conflictCount ?? 0;
}

function readSourceStatus(configured: boolean, errorCount: number): CollectionSourceStatus {
  if (!configured) return "not-run";
  if (errorCount > 0) return "review-required";
  return "verified";
}

function createSourceReport(
  id: string,
  url: string,
  status: CollectionSourceStatus,
  collectedRecords: number,
  errorCount: number,
): CollectionSourceReport {
  return { collectedRecords, errorCount, id, status, url };
}

function readReportStatus(blockingIssueCount: number): CollectionReportStatus {
  if (blockingIssueCount > 0) return "review-required";
  return "verified";
}
