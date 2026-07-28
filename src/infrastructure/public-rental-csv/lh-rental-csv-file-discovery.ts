import { readdir } from "node:fs/promises";
import { join } from "node:path";

const CONSTRUCTION_FILE_PATTERN = /_건설_\d{8}\.csv$/u;
const PURCHASE_FILE_PATTERN = /_매입_\d{8}\.csv$/u;

export type LhRentalCsvFileNames = Readonly<{
  constructionFileName: string;
  purchaseFileName: string;
}>;

export type LhRentalCsvFilePaths = Readonly<{
  constructionFilePath: string;
  purchaseFilePath: string;
}>;

export async function discoverLhRentalCsvFilePaths(
  directoryPath: string,
): Promise<LhRentalCsvFilePaths> {
  const fileNames = await readdir(directoryPath);
  const selected = chooseLhRentalCsvFileNames(fileNames);
  return createFilePaths(directoryPath, selected);
}

export function chooseLhRentalCsvFileNames(fileNames: readonly string[]): LhRentalCsvFileNames {
  return {
    constructionFileName: selectUniqueFile(fileNames, CONSTRUCTION_FILE_PATTERN, "건설"),
    purchaseFileName: selectUniqueFile(fileNames, PURCHASE_FILE_PATTERN, "매입"),
  };
}

function selectUniqueFile(fileNames: readonly string[], pattern: RegExp, label: string) {
  const matchingFileNames = fileNames.filter((fileName) => pattern.test(fileName.normalize("NFC")));
  if (matchingFileNames.length === 1) return matchingFileNames[0] as string;
  throw new Error(`${label} CSV 파일이 ${matchingFileNames.length}개 발견되었습니다.`);
}

function createFilePaths(
  directoryPath: string,
  fileNames: LhRentalCsvFileNames,
): LhRentalCsvFilePaths {
  return {
    constructionFilePath: join(directoryPath, fileNames.constructionFileName),
    purchaseFilePath: join(directoryPath, fileNames.purchaseFileName),
  };
}
