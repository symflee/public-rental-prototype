import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { PublicRentalLocation } from "@/domain/public-rental";
import {
  normalizeLhRentalCsvRecords,
  type LhRentalCsvNormalizationResult,
} from "@/infrastructure/public-data/lh-rental-csv-normalizer";
import {
  decodeLhRentalCsvBytes,
  parseLhConstructionRentalCsv,
  parseLhPurchaseRentalCsv,
} from "@/infrastructure/public-data/lh-rental-csv-parser";
import {
  createPublicRentalReviewCsv,
  createPublicRentalSnapshot,
} from "@/infrastructure/public-data/public-rental-artifacts";
import {
  createEmptyCoordinateCache,
  findUncachedCoordinateRequests,
  mergeLegacySnapshotCoordinates,
  parseRentalCoordinateCache,
  resolveKakaoCoordinates,
  type CoordinateResolutionResult,
  type RentalCoordinateCache,
} from "@/infrastructure/public-rental-csv/kakao-coordinate-resolver";
import { createLhRentalCollectionReport } from "@/infrastructure/public-rental-csv/lh-rental-collection-report";
import { discoverLhRentalCsvFilePaths } from "@/infrastructure/public-rental-csv/lh-rental-csv-file-discovery";
import {
  applyResolvedCoordinates,
  assertExpectedLhLocationProfile,
  createCoordinateRequests,
  findRoadLevelLocations,
} from "@/infrastructure/public-rental-csv/lh-rental-csv-publication";

const WORKSPACE_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));
const DATA_DIRECTORY = fileURLToPath(new URL("../data/", import.meta.url));
const GENERATED_DIRECTORY = fileURLToPath(
  new URL("../src/infrastructure/public-data/generated/", import.meta.url),
);
const SNAPSHOT_PATH = `${GENERATED_DIRECTORY}public-rental-locations.json`;
const REVIEW_CSV_PATH = `${GENERATED_DIRECTORY}public-rental-locations.csv`;
const REPORT_PATH = `${GENERATED_DIRECTORY}collection-report.json`;
const CACHE_PATH = `${GENERATED_DIRECTORY}public-rental-coordinate-cache.json`;

type ParsedSources = Awaited<ReturnType<typeof readParsedSources>>;

type CollectionContext = Readonly<{
  coordinates: CoordinateResolutionResult;
  generatedAt: string;
  locations: readonly PublicRentalLocation[];
  normalization: LhRentalCsvNormalizationResult;
  sources: ParsedSources;
}>;

type OutputFile = Readonly<{
  contents: string;
  path: string;
}>;

async function main() {
  const generatedAt = new Date().toISOString();
  const sources = await readParsedSources();
  assertNoParseIssues(sources);
  const normalization = normalizeSources(sources, generatedAt);
  assertExpectedLhLocationProfile(normalization.locations.values);
  const coordinates = await collectCoordinates(normalization.locations.values);
  const locations = applyResolvedCoordinates(
    normalization.locations.values,
    coordinates.coordinates,
  );
  const context = { coordinates, generatedAt, locations, normalization, sources };
  await writeReviewArtifacts(context);
  assertNoCoordinateFailures(coordinates);
  await publishSnapshot(generatedAt, locations);
  logCollectionResult(locations);
}

async function readParsedSources() {
  const paths = await discoverLhRentalCsvFilePaths(DATA_DIRECTORY);
  const [constructionBytes, purchaseBytes] = await Promise.all([
    readFile(paths.constructionFilePath),
    readFile(paths.purchaseFilePath),
  ]);
  return {
    construction: createConstructionSource(paths.constructionFilePath, constructionBytes),
    purchase: createPurchaseSource(paths.purchaseFilePath, purchaseBytes),
  };
}

function createConstructionSource(filePath: string, bytes: Uint8Array) {
  const parsed = parseLhConstructionRentalCsv(decodeLhRentalCsvBytes(bytes));
  return { fileName: basename(filePath), ...parsed };
}

function createPurchaseSource(filePath: string, bytes: Uint8Array) {
  const parsed = parseLhPurchaseRentalCsv(decodeLhRentalCsvBytes(bytes));
  return { fileName: basename(filePath), ...parsed };
}

function assertNoParseIssues(sources: ParsedSources) {
  const issues = [...sources.construction.issues, ...sources.purchase.issues];
  if (issues.length === 0) return;
  throw new Error(`CSV 파싱 오류 ${issues.length}건으로 수집을 중단했습니다.`);
}

function normalizeSources(sources: ParsedSources, generatedAt: string) {
  return normalizeLhRentalCsvRecords({
    asOfDate: generatedAt.slice(0, 10),
    constructionRecords: sources.construction.records,
    purchaseRecords: sources.purchase.records,
  });
}

async function collectCoordinates(locations: readonly PublicRentalLocation[]) {
  const requests = createCoordinateRequests(locations);
  const storedCache = await readStoredCoordinateCache();
  const legacySnapshot = await readJsonIfExists(SNAPSHOT_PATH);
  const cache = mergeLegacySnapshotCoordinates(requests, storedCache, legacySnapshot);
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
  const value = process.env.KAKAO_REST_API_KEY?.trim();
  if (value) return value;
  throw new Error("좌표 캐시에 없는 주소를 수집하려면 KAKAO_REST_API_KEY가 필요합니다.");
}

async function writeReviewArtifacts(context: CollectionContext) {
  const report = createCollectionReport(context);
  await writeAtomicFiles([
    { contents: createPublicRentalReviewCsv(context.locations), path: REVIEW_CSV_PATH },
    { contents: serializeJson(context.coordinates.cache), path: CACHE_PATH },
    { contents: serializeJson(report), path: REPORT_PATH },
  ]);
}

function createCollectionReport(context: CollectionContext) {
  return createLhRentalCollectionReport({
    constructionFileName: context.sources.construction.fileName,
    constructionParseIssues: context.sources.construction.issues,
    constructionRecords: context.sources.construction.records,
    exclusions: context.normalization.exclusions,
    generatedAt: context.generatedAt,
    geocodingFailures: context.coordinates.failures,
    locations: context.locations,
    purchaseFileName: context.sources.purchase.fileName,
    purchaseParseIssues: context.sources.purchase.issues,
    purchaseRecords: context.sources.purchase.records,
    roadLevelWarnings: findRoadLevelLocations(context.locations),
    warnings: context.normalization.warnings,
  });
}

function assertNoCoordinateFailures(coordinates: CoordinateResolutionResult) {
  if (coordinates.failures.length === 0) return;
  throw new Error(`좌표 검색 ${coordinates.failures.length}건이 실패해 앱 스냅샷을 유지했습니다.`);
}

async function publishSnapshot(generatedAt: string, locations: readonly PublicRentalLocation[]) {
  const snapshot = createPublicRentalSnapshot(generatedAt, locations);
  await writeAtomicFiles([{ contents: serializeJson(snapshot), path: SNAPSHOT_PATH }]);
}

function logCollectionResult(locations: readonly PublicRentalLocation[]) {
  const seongnam = locations.filter((location) => location.municipality === "SEONGNAM").length;
  const yongin = locations.filter((location) => location.municipality === "YONGIN").length;
  console.log(`LH 임대주택 ${locations.length}곳을 저장했습니다. 성남 ${seongnam}, 용인 ${yongin}`);
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
  return "알 수 없는 CSV 수집 오류";
}

function handleCollectionError(error: unknown) {
  console.error(readErrorMessage(error));
  console.error(`앱 스냅샷: ${SNAPSHOT_PATH.replace(`${WORKSPACE_DIRECTORY}/`, "")}`);
  process.exitCode = 1;
}

void main().catch(handleCollectionError);
