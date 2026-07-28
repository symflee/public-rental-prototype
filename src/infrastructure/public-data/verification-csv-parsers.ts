const CSV_CELL_PATTERN = /(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g;
const LH_REQUIRED_HEADERS = ["단지코드", "단지명", "주소"] as const;
const SEONGNAM_REQUIRED_HEADERS = ["구", "동", "단지명", "도로명주소"] as const;

type CsvRow = Readonly<Record<string, string>>;

export type CsvVerificationIssue = Readonly<{
  lineNumber?: number;
  message: string;
}>;

export type CsvVerificationParseResult<T> = Readonly<{
  candidates: ReadonlyArray<T>;
  collectionIssues: ReadonlyArray<CsvVerificationIssue>;
}>;

export type LhApartmentVerificationCandidate = Readonly<{
  address: string;
  buildingCount: string;
  completionDate: string;
  complexCode: string;
  complexName: string;
  householdCount: string;
  housingType: string;
  occupancyEndDate: string;
  occupancyStartDate: string;
  regionalHeadquarters: string;
  rentalType: string;
  reviewOnly: true;
  source: "lh-national-apartment-csv";
}>;

export type SeongnamApartmentVerificationCandidate = Readonly<{
  buildingCount: string;
  complexName: string;
  dataReferenceDate: string;
  district: string;
  dong: string;
  householdCount: string;
  lotAddress: string;
  managementOffice: string;
  maximumFloorCount: string;
  reviewOnly: true;
  roadAddress: string;
  source: "seongnam-apartment-csv";
}>;

type CsvTableResult = Readonly<{
  collectionIssues: ReadonlyArray<CsvVerificationIssue>;
  headers: ReadonlyArray<string>;
  rows: ReadonlyArray<CsvRow>;
}>;

export function parseLhApartmentVerificationCandidates(
  text: string,
): CsvVerificationParseResult<LhApartmentVerificationCandidate> {
  const table = parseCsvTable(text);
  const missingHeaders = findMissingHeaders(table.headers, LH_REQUIRED_HEADERS);
  if (missingHeaders.length > 0) return missingHeaderResult(missingHeaders);
  const candidates = table.rows.map(createLhCandidate).filter(isSeongnamLhCandidate);
  return { candidates, collectionIssues: table.collectionIssues };
}

export function parseSeongnamApartmentVerificationCandidates(
  text: string,
): CsvVerificationParseResult<SeongnamApartmentVerificationCandidate> {
  const table = parseCsvTable(text);
  const missingHeaders = findMissingHeaders(table.headers, SEONGNAM_REQUIRED_HEADERS);
  if (missingHeaders.length > 0) return missingHeaderResult(missingHeaders);
  const candidates = table.rows.map(createSeongnamCandidate).filter(hasComplexName);
  return { candidates, collectionIssues: table.collectionIssues };
}

function parseCsvTable(text: string): CsvTableResult {
  const lines = readNonEmptyLines(text);
  if (lines.length === 0) return emptyTable();
  const headers = parseCsvLine(lines[0] ?? "");
  const parsedRows = lines.slice(1).map((line, index) => parseRow(line, index + 2, headers));
  const rows = parsedRows.flatMap(readParsedRow);
  const collectionIssues = parsedRows.flatMap(readParsedIssue);
  return { collectionIssues, headers, rows };
}

function readParsedRow(result: Readonly<{ row?: CsvRow }>) {
  if (!result.row) return [];
  return [result.row];
}

function readParsedIssue(result: Readonly<{ issue?: CsvVerificationIssue }>) {
  if (!result.issue) return [];
  return [result.issue];
}

function readNonEmptyLines(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
}

function parseCsvLine(line: string) {
  return Array.from(line.matchAll(CSV_CELL_PATTERN), readCsvCell);
}

function readCsvCell(match: RegExpMatchArray) {
  const quoted = match[1];
  if (quoted !== undefined) return quoted.replaceAll('""', '"').trim();
  return (match[2] ?? "").trim();
}

function parseRow(
  line: string,
  lineNumber: number,
  headers: ReadonlyArray<string>,
): Readonly<{ issue?: CsvVerificationIssue; row?: CsvRow }> {
  const cells = parseCsvLine(line);
  if (cells.length !== headers.length) return malformedRow(lineNumber);
  return { row: createCsvRow(headers, cells) };
}

function createCsvRow(headers: ReadonlyArray<string>, cells: ReadonlyArray<string>) {
  return headers.reduce<Record<string, string>>((row, header, index) => {
    row[header] = cells[index] ?? "";
    return row;
  }, {});
}

function malformedRow(lineNumber: number) {
  return {
    issue: { lineNumber, message: "CSV 열 개수가 헤더와 일치하지 않습니다." },
  };
}

function emptyTable(): CsvTableResult {
  return {
    collectionIssues: [{ message: "CSV 데이터가 비어 있습니다." }],
    headers: [],
    rows: [],
  };
}

function findMissingHeaders(
  headers: ReadonlyArray<string>,
  requiredHeaders: ReadonlyArray<string>,
) {
  return requiredHeaders.filter((header) => !headers.includes(header));
}

function missingHeaderResult<T>(
  missingHeaders: ReadonlyArray<string>,
): CsvVerificationParseResult<T> {
  const message = `필수 CSV 헤더가 없습니다: ${missingHeaders.join(", ")}`;
  return { candidates: [], collectionIssues: [{ message }] };
}

function createLhCandidate(row: CsvRow): LhApartmentVerificationCandidate {
  return {
    ...createLhComplexCells(row),
    ...createLhOccupancyCells(row),
    regionalHeadquarters: readFirstCell(row, ["지역본부", "지역본부명"]),
    rentalType: readCell(row, "임대유형"),
    reviewOnly: true,
    source: "lh-national-apartment-csv",
  };
}

function createSeongnamCandidate(row: CsvRow): SeongnamApartmentVerificationCandidate {
  return {
    ...createSeongnamIdentityCells(row),
    ...createSeongnamBuildingCells(row),
    reviewOnly: true,
    roadAddress: readCell(row, "도로명주소"),
    source: "seongnam-apartment-csv",
  };
}

function createLhComplexCells(row: CsvRow) {
  return {
    address: readCell(row, "주소"),
    buildingCount: readCell(row, "동수"),
    completionDate: readCell(row, "준공일"),
    complexCode: readCell(row, "단지코드"),
    complexName: readCell(row, "단지명"),
    householdCount: readCell(row, "세대수"),
    housingType: readCell(row, "주택유형"),
  };
}

function createLhOccupancyCells(row: CsvRow) {
  return {
    occupancyEndDate: readCell(row, "입주지정종료일"),
    occupancyStartDate: readCell(row, "입주지정시작일"),
  };
}

function createSeongnamIdentityCells(row: CsvRow) {
  return {
    complexName: readCell(row, "단지명"),
    district: readCell(row, "구"),
    dong: readCell(row, "동"),
    lotAddress: readCell(row, "지번주소"),
  };
}

function createSeongnamBuildingCells(row: CsvRow) {
  return {
    buildingCount: readCell(row, "동수"),
    dataReferenceDate: readCell(row, "데이터기준일자"),
    householdCount: readCell(row, "세대수"),
    managementOffice: readCell(row, "관리사무소"),
    maximumFloorCount: readCell(row, "지상층(고)"),
  };
}

function isSeongnamLhCandidate(candidate: LhApartmentVerificationCandidate) {
  return candidate.address.includes("성남시") || candidate.complexName.includes("성남시");
}

function hasComplexName(candidate: SeongnamApartmentVerificationCandidate) {
  return candidate.complexName.length > 0;
}

function readCell(row: CsvRow, header: string) {
  return row[header] ?? "";
}

function readFirstCell(row: CsvRow, headers: ReadonlyArray<string>) {
  return headers.map((header) => readCell(row, header)).find((value) => value.length > 0) ?? "";
}
