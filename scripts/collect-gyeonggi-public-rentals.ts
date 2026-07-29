import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { PublicRentalLocation } from "@/domain/public-rental";
import { createGyeonggiPublicRentalCollection } from "@/infrastructure/public-data/gyeonggi-public-rental-collector";
import { collectMyHomePublicRentalRecords } from "@/infrastructure/public-data/my-home-public-rental-client";
import { collectMyHomeRecruitmentRecords } from "@/infrastructure/public-data/my-home-recruitment-client";
import {
  createPublicRentalReviewCsv,
  createPublicRentalSnapshot,
} from "@/infrastructure/public-data/public-rental-artifacts";
import { createRecruitmentReviewFailures } from "@/infrastructure/public-data/recruitment-review";
import {
  applyResolvedCoordinates,
  createCoordinateReviewFailures,
  createCoordinateRequests,
  findRoadLevelLocations,
  selectResolvedLocations,
} from "@/infrastructure/public-rental-csv/lh-rental-csv-publication";
import {
  createEmptyCoordinateCache,
  findUncachedCoordinateRequests,
  mergeLegacySnapshotCoordinates,
  parseRentalCoordinateCache,
  resolveKakaoCoordinates,
  type CoordinateResolutionResult,
  type RentalCoordinateCache,
} from "@/infrastructure/public-rental-csv/kakao-coordinate-resolver";

const GENERATED_DIRECTORY = fileURLToPath(
  new URL("../src/infrastructure/public-data/generated/", import.meta.url),
);
const SNAPSHOT_PATH = `${GENERATED_DIRECTORY}public-rental-locations.json`;
const REVIEW_CSV_PATH = `${GENERATED_DIRECTORY}public-rental-locations.csv`;
const REPORT_PATH = `${GENERATED_DIRECTORY}gyeonggi-collection-report.json`;
const CACHE_PATH = `${GENERATED_DIRECTORY}public-rental-coordinate-cache.json`;
const RECRUITMENT_FAILURE_PATH = `${GENERATED_DIRECTORY}public-rental-recruitment-failures.json`;
const COORDINATE_FAILURE_PATH = `${GENERATED_DIRECTORY}public-rental-coordinate-failures.json`;
const SOURCE_FAILURE_PATH = `${GENERATED_DIRECTORY}public-rental-api-failures.json`;

type OutputFile = Readonly<{ contents: string; path: string }>;
type SourceResults = Awaited<ReturnType<typeof collectSources>>;
type GyeonggiCollection = ReturnType<typeof createGyeonggiPublicRentalCollection>;
type CoordinatePublication = Readonly<{
  coordinates: CoordinateResolutionResult;
  locations: readonly PublicRentalLocation[];
}>;

async function main() {
  const generatedAt = new Date().toISOString();
  const sourceResults = await collectSources();
  await writeSourceFailures(generatedAt, sourceResults);
  const collection = createCollection(sourceResults, generatedAt);
  assertCollectionCanPublish(collection);
  await writeRecruitmentFailures(generatedAt, collection);
  const publication = await createCoordinatePublication(generatedAt, collection);
  await writeReviewArtifacts(generatedAt, sourceResults, collection, publication);
  await publishSnapshot(generatedAt, publication.locations);
  logCollectionResult(publication, sourceResults, collection);
}

async function collectSources() {
  const serviceKey = requireEnvironmentVariable("PUBLIC_DATA_PORTAL_SERVICE_KEY");
  const configuration = { fetchFunction: fetch, serviceKey };
  const [complexes, recruitment] = await Promise.all([
    collectMyHomePublicRentalRecords(configuration),
    collectMyHomeRecruitmentRecords(configuration),
  ]);
  return { complexes, recruitment };
}

function createCollection(sourceResults: SourceResults, generatedAt: string) {
  return createGyeonggiPublicRentalCollection(
    sourceResults.complexes.records,
    sourceResults.recruitment.records,
    generatedAt.slice(0, 10),
  );
}

function assertCollectionCanPublish(collection: GyeonggiCollection) {
  if (collection.locations.length === 0)
    throw new Error("경기도 LH 임대주택 위치를 찾지 못했습니다.");
}

async function writeSourceFailures(generatedAt: string, sourceResults: SourceResults) {
  const artifact = {
    failures: createSourceFailureReport(sourceResults),
    generatedAt,
    schemaVersion: 1,
    scope: { provider: "LH", region: "경기도" },
  };
  await writeAtomicFiles([{ contents: serializeJson(artifact), path: SOURCE_FAILURE_PATH }]);
}

async function writeRecruitmentFailures(generatedAt: string, collection: GyeonggiCollection) {
  const artifact = {
    failures: createRecruitmentReviewFailures(collection),
    generatedAt,
    schemaVersion: 1,
    scope: { provider: "LH", region: "경기도" },
  };
  await writeAtomicFiles([{ contents: serializeJson(artifact), path: RECRUITMENT_FAILURE_PATH }]);
}

async function writeCoordinateFailures(
  generatedAt: string,
  locations: readonly PublicRentalLocation[],
  coordinates: CoordinateResolutionResult,
) {
  const artifact = {
    failures: createCoordinateReviewFailures(locations, coordinates.failures),
    generatedAt,
    schemaVersion: 1,
    scope: { provider: "LH", region: "경기도" },
  };
  await writeAtomicFiles([{ contents: serializeJson(artifact), path: COORDINATE_FAILURE_PATH }]);
}

async function createCoordinatePublication(
  generatedAt: string,
  collection: GyeonggiCollection,
): Promise<CoordinatePublication> {
  const coordinates = await collectCoordinates(collection.locations);
  await writeCoordinateFailures(generatedAt, collection.locations, coordinates);
  const resolvedLocations = selectResolvedLocations(collection.locations, coordinates.coordinates);
  assertResolvedLocations(resolvedLocations);
  return {
    coordinates,
    locations: applyResolvedCoordinates(resolvedLocations, coordinates.coordinates),
  };
}

async function collectCoordinates(locations: readonly PublicRentalLocation[]) {
  const requests = createCoordinateRequests(locations);
  const storedCache = await readStoredCoordinateCache();
  const snapshot = await readJsonIfExists(SNAPSHOT_PATH);
  const cache = mergeLegacySnapshotCoordinates(requests, storedCache, snapshot);
  const restApiKey = readKakaoRestApiKey(requests, cache);
  return resolveKakaoCoordinates(requests, cache, { fetchFunction: fetch, restApiKey });
}

async function readStoredCoordinateCache() {
  const stored = await readJsonIfExists(CACHE_PATH);
  if (stored === undefined) return createEmptyCoordinateCache();
  return parseRentalCoordinateCache(stored);
}

function readKakaoRestApiKey(
  requests: ReturnType<typeof createCoordinateRequests>,
  cache: RentalCoordinateCache,
) {
  if (findUncachedCoordinateRequests(requests, cache).length === 0) return "";
  return requireEnvironmentVariable("KAKAO_REST_API_KEY");
}

async function writeReviewArtifacts(
  generatedAt: string,
  sourceResults: SourceResults,
  collection: GyeonggiCollection,
  publication: CoordinatePublication,
) {
  const report = createCollectionReport(generatedAt, sourceResults, collection, publication);
  await writeAtomicFiles([
    { contents: createPublicRentalReviewCsv(publication.locations), path: REVIEW_CSV_PATH },
    { contents: serializeJson(publication.coordinates.cache), path: CACHE_PATH },
    { contents: serializeJson(report), path: REPORT_PATH },
  ]);
}

function createCollectionReport(
  generatedAt: string,
  sourceResults: SourceResults,
  collection: GyeonggiCollection,
  publication: CoordinatePublication,
) {
  return {
    apiFailures: createSourceFailureReport(sourceResults),
    collectedLocationCount: collection.locations.length,
    coordinateFailures: createCoordinateReviewFailures(
      collection.locations,
      publication.coordinates.failures,
    ),
    generatedAt,
    publishedLocationCount: publication.locations.length,
    recruitment: createRecruitmentReport(collection, publication.locations),
    roadLevelWarnings: findRoadLevelLocations(publication.locations),
    schemaVersion: 1,
    scope: { provider: "LH", region: "경기도" },
    status: createReportStatus(sourceResults, collection, publication.coordinates),
  };
}

function createReportStatus(
  sourceResults: SourceResults,
  collection: GyeonggiCollection,
  coordinates: CoordinateResolutionResult,
) {
  if (countSourceFailures(sourceResults) > 0) return "review-required";
  if (createRecruitmentReviewFailures(collection).length > 0) return "review-required";
  if (coordinates.failures.length > 0) return "review-required";
  return "verified";
}

function createSourceFailureReport(sourceResults: SourceResults) {
  return {
    complexApiIssues: sourceResults.complexes.collectionIssues,
    recruitmentApiIssues: sourceResults.recruitment.collectionIssues,
  };
}

function countSourceFailures(sourceResults: SourceResults) {
  return (
    sourceResults.complexes.collectionIssues.length +
    sourceResults.recruitment.collectionIssues.length
  );
}

function createRecruitmentReport(
  collection: GyeonggiCollection,
  publishedLocations: readonly PublicRentalLocation[],
) {
  return {
    ambiguousCandidates: collection.recruitmentAttachment.ambiguousCandidates,
    attachedNoticeCount: countAttachedNotices(publishedLocations),
    collectedAttachedNoticeCount: countAttachedNotices(collection.locations),
    excludedRecords: collection.recruitmentNormalization.exclusions,
    reviewFailures: createRecruitmentReviewFailures(collection),
    unmatchedCandidates: collection.recruitmentAttachment.unmatchedCandidates,
  };
}

function countAttachedNotices(locations: readonly PublicRentalLocation[]) {
  return locations.reduce(countLocationNotices, 0);
}

function countLocationNotices(total: number, location: PublicRentalLocation) {
  return total + (location.recruitmentNotices?.length ?? 0);
}

function assertResolvedLocations(locations: readonly PublicRentalLocation[]) {
  if (locations.length > 0) return;
  throw new Error("좌표가 확인된 경기도 LH 임대주택이 없어 앱 스냅샷을 유지했습니다.");
}

async function publishSnapshot(generatedAt: string, locations: readonly PublicRentalLocation[]) {
  const snapshot = createPublicRentalSnapshot(generatedAt, locations);
  await writeAtomicFiles([{ contents: serializeJson(snapshot), path: SNAPSHOT_PATH }]);
}

function logCollectionResult(
  publication: CoordinatePublication,
  sourceResults: SourceResults,
  collection: GyeonggiCollection,
) {
  const noticeCount = countAttachedNotices(publication.locations);
  const failureCount = createRecruitmentReviewFailures(collection).length;
  console.log(
    `경기도 LH 임대주택 ${publication.locations.length}곳과 모집공고 ${noticeCount}건을 저장했습니다.`,
  );
  console.log(`검수 필요 모집공고 ${failureCount}건: ${RECRUITMENT_FAILURE_PATH}`);
  console.log(
    `검수 필요 좌표 ${publication.coordinates.failures.length}건: ${COORDINATE_FAILURE_PATH}`,
  );
  console.log(`검수 필요 API 요청 ${countSourceFailures(sourceResults)}건: ${SOURCE_FAILURE_PATH}`);
}

async function readJsonIfExists(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) return false;
  return "code" in error && error.code === "ENOENT";
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  throw new Error(`${name} 환경변수가 필요합니다.`);
}

function serializeJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeAtomicFiles(files: readonly OutputFile[]) {
  const stagedFiles = await Promise.all(files.map(stageOutputFile));
  await Promise.all(stagedFiles.map(commitOutputFile));
}

async function stageOutputFile(file: OutputFile) {
  const temporaryPath = `${file.path}.${process.pid}.tmp`;
  await mkdir(dirname(file.path), { recursive: true });
  await writeFile(temporaryPath, file.contents, "utf8");
  return { path: file.path, temporaryPath };
}

async function commitOutputFile(file: { path: string; temporaryPath: string }) {
  await rename(file.temporaryPath, file.path);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "알 수 없는 경기도 공공임대 수집 오류";
}

function handleCollectionError(error: unknown) {
  console.error(readErrorMessage(error));
  console.error(`앱 스냅샷: ${SNAPSHOT_PATH}`);
  process.exitCode = 1;
}

void main().catch(handleCollectionError);
