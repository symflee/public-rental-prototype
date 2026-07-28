import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectPublicRentalArtifacts,
  createPublicRentalCollectionServices,
  type PublicRentalCollectionArtifacts,
  type PublicRentalCollectionConfiguration,
} from "@/infrastructure/public-data/public-rental-collector";

const GENERATED_DIRECTORY = fileURLToPath(
  new URL("../src/infrastructure/public-data/generated/api-review/", import.meta.url),
);
const SNAPSHOT_PATH = `${GENERATED_DIRECTORY}public-rental-locations.json`;
const REVIEW_CSV_PATH = `${GENERATED_DIRECTORY}public-rental-locations.csv`;
const REPORT_PATH = `${GENERATED_DIRECTORY}collection-report.json`;

export async function main() {
  const configuration = await readConfiguration();
  const services = createPublicRentalCollectionServices(fetch);
  const artifacts = await collectPublicRentalArtifacts(configuration, services);
  await writeReviewArtifacts(artifacts);
  await writeAtomicJson(SNAPSHOT_PATH, artifacts.snapshot);
  console.log(`API 검수 위치 ${artifacts.snapshot.locations.length}곳을 별도 저장했습니다.`);
}

async function readConfiguration(): Promise<PublicRentalCollectionConfiguration> {
  return {
    generatedAt: new Date().toISOString(),
    kakaoRestApiKey: requireEnvironmentVariable("KAKAO_REST_API_KEY"),
    lhApartmentCsvText: await readOptionalCsv("LH_APARTMENT_CSV_PATH"),
    publicDataPortalServiceKey: requireEnvironmentVariable("PUBLIC_DATA_PORTAL_SERVICE_KEY"),
    seongnamApartmentCsvText: await readOptionalCsv("SEONGNAM_APARTMENT_CSV_PATH"),
  };
}

async function readOptionalCsv(environmentName: string) {
  const path = process.env[environmentName]?.trim();
  if (!path) return undefined;
  return decodeCsv(await readFile(path));
}

function decodeCsv(contents: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(contents);
  } catch {
    return new TextDecoder("euc-kr").decode(contents);
  }
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  throw new Error(`${name} 환경변수가 필요합니다.`);
}

async function writeReviewArtifacts(artifacts: PublicRentalCollectionArtifacts) {
  await Promise.all([
    writeAtomicFile(REVIEW_CSV_PATH, artifacts.reviewCsv),
    writeAtomicJson(REPORT_PATH, artifacts.report),
  ]);
}

async function writeAtomicJson(path: string, value: unknown) {
  await writeAtomicFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeAtomicFile(path: string, contents: string) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, path);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "알 수 없는 API 수집 오류";
}

function handleCollectionError(error: unknown) {
  console.error(readErrorMessage(error));
  process.exitCode = 1;
}

void main().catch(handleCollectionError);
