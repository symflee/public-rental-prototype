export type LhConstructionRentalCsvRecord = Readonly<{
  address: string;
  classification: string;
  completionDate: string;
  complexCode: string;
  complexName: string;
  detailAddress: string;
  householdCount: string;
  purchaseDate: string;
  styleName: string;
  supplyAreaSquareMeters: string;
  supplyTypeName: string;
}>;

export type LhPurchaseRentalCsvRecord = Readonly<{
  address: string;
  buildingApprovalDate: string;
  complexName: string;
  householdCount: string;
  productReplacementDate: string;
  purchaseYear: string;
  sequence: string;
  supplyAreaSquareMeters: string;
  supplyTypeName: string;
}>;

export type LhRentalCsvParseIssueCode = "EMPTY_CSV" | "MALFORMED_ROW" | "MISSING_HEADERS";

export type LhRentalCsvParseIssue = Readonly<{
  code: LhRentalCsvParseIssueCode;
  message: string;
  rowNumber?: number;
}>;

export type LhRentalCsvParseResult<RecordType> = Readonly<{
  issues: readonly LhRentalCsvParseIssue[];
  records: readonly RecordType[];
}>;

const CONSTRUCTION_HEADERS = [
  "단지코드",
  "단지명",
  "주소",
  "상세주소",
  "준공일자",
  "매입일자",
  "공급유형",
  "형명",
  "공급면적",
  "세대수",
  "구분",
] as const;

const PURCHASE_HEADERS = [
  "순번",
  "단지명",
  "주소",
  "공급유형",
  "공급면적",
  "세대수",
  "건축사용승인일자",
  "제품대체일자",
  "매입년도",
] as const;

type CsvRow = Readonly<Record<string, string>>;

type CsvTable = Readonly<{
  issues: readonly LhRentalCsvParseIssue[];
  rows: readonly CsvRow[];
}>;

type CsvReaderState = {
  cell: string;
  cells: string[];
  index: number;
  quoted: boolean;
  rows: string[][];
  text: string;
};

export function decodeLhRentalCsvBytes(bytes: Uint8Array) {
  const utf8 = decodeUtf8(bytes);
  if (utf8 !== undefined) return utf8;
  return new TextDecoder("euc-kr").decode(bytes);
}

export function parseLhConstructionRentalCsv(
  text: string,
): LhRentalCsvParseResult<LhConstructionRentalCsvRecord> {
  const table = parseCsvTable(text, CONSTRUCTION_HEADERS);
  return { issues: table.issues, records: table.rows.map(createConstructionRecord) };
}

export function parseLhPurchaseRentalCsv(
  text: string,
): LhRentalCsvParseResult<LhPurchaseRentalCsvRecord> {
  const table = parseCsvTable(text, PURCHASE_HEADERS);
  return { issues: table.issues, records: table.rows.map(createPurchaseRecord) };
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function parseCsvTable(text: string, requiredHeaders: readonly string[]): CsvTable {
  const matrix = parseCsvMatrix(text.replace(/^\uFEFF/, ""));
  if (matrix.length === 0) return emptyCsvTable();
  const headers = matrix[0] ?? [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) return missingHeaderTable(missingHeaders);
  return createCsvTable(headers, matrix.slice(1));
}

function parseCsvMatrix(text: string) {
  const state = createReaderState(text);
  while (state.index < text.length) consumeCsvCharacter(state);
  finishCsvReader(state);
  return state.rows;
}

function createReaderState(text: string): CsvReaderState {
  return { cell: "", cells: [], index: 0, quoted: false, rows: [], text };
}

function consumeCsvCharacter(state: CsvReaderState) {
  if (consumeEscapedQuote(state)) return;
  if (consumeQuote(state)) return;
  if (consumeComma(state)) return;
  if (consumeLineBreak(state)) return;
  state.cell += state.text[state.index] ?? "";
  state.index += 1;
}

function consumeEscapedQuote(state: CsvReaderState) {
  if (!state.quoted) return false;
  if (state.text.slice(state.index, state.index + 2) !== '""') return false;
  state.cell += '"';
  state.index += 2;
  return true;
}

function consumeQuote(state: CsvReaderState) {
  if (state.text[state.index] !== '"') return false;
  state.quoted = !state.quoted;
  state.index += 1;
  return true;
}

function consumeComma(state: CsvReaderState) {
  if (state.quoted) return false;
  if (state.text[state.index] !== ",") return false;
  appendCell(state);
  state.index += 1;
  return true;
}

function consumeLineBreak(state: CsvReaderState) {
  if (state.quoted) return false;
  const width = readLineBreakWidth(state);
  if (width === 0) return false;
  appendRow(state);
  state.index += width;
  return true;
}

function readLineBreakWidth(state: CsvReaderState) {
  if (state.text.slice(state.index, state.index + 2) === "\r\n") return 2;
  if (state.text[state.index] === "\n") return 1;
  if (state.text[state.index] === "\r") return 1;
  return 0;
}

function appendCell(state: CsvReaderState) {
  state.cells.push(state.cell.trim());
  state.cell = "";
}

function appendRow(state: CsvReaderState) {
  appendCell(state);
  if (!isEmptyRow(state.cells)) state.rows.push(state.cells);
  state.cells = [];
}

function finishCsvReader(state: CsvReaderState) {
  if (state.cell.length === 0 && state.cells.length === 0) return;
  appendRow(state);
}

function isEmptyRow(cells: readonly string[]) {
  return cells.every((cell) => cell.length === 0);
}

function createCsvTable(headers: readonly string[], matrix: readonly (readonly string[])[]) {
  const issues = matrix.flatMap((cells, index) => createRowIssue(cells, headers, index));
  const rows = matrix.flatMap((cells) => createRow(cells, headers));
  return { issues, rows };
}

function createRowIssue(cells: readonly string[], headers: readonly string[], index: number) {
  if (cells.length === headers.length) return [];
  return [
    {
      code: "MALFORMED_ROW" as const,
      message: "CSV 열 개수가 헤더와 일치하지 않습니다.",
      rowNumber: index + 2,
    },
  ];
}

function createRow(cells: readonly string[], headers: readonly string[]) {
  if (cells.length !== headers.length) return [];
  return [Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))];
}

function emptyCsvTable(): CsvTable {
  return { issues: [{ code: "EMPTY_CSV", message: "CSV 데이터가 비어 있습니다." }], rows: [] };
}

function missingHeaderTable(headers: readonly string[]): CsvTable {
  const message = `필수 CSV 헤더가 없습니다: ${headers.join(", ")}`;
  return { issues: [{ code: "MISSING_HEADERS", message }], rows: [] };
}

function createConstructionRecord(row: CsvRow): LhConstructionRentalCsvRecord {
  return {
    address: readCell(row, "주소"),
    classification: readCell(row, "구분"),
    completionDate: readCell(row, "준공일자"),
    complexCode: readCell(row, "단지코드"),
    complexName: readCell(row, "단지명"),
    detailAddress: readCell(row, "상세주소"),
    householdCount: readCell(row, "세대수"),
    purchaseDate: readCell(row, "매입일자"),
    styleName: readCell(row, "형명"),
    supplyAreaSquareMeters: readCell(row, "공급면적"),
    supplyTypeName: readCell(row, "공급유형"),
  };
}

function createPurchaseRecord(row: CsvRow): LhPurchaseRentalCsvRecord {
  return {
    address: readCell(row, "주소"),
    buildingApprovalDate: readCell(row, "건축사용승인일자"),
    complexName: readCell(row, "단지명"),
    householdCount: readCell(row, "세대수"),
    productReplacementDate: readCell(row, "제품대체일자"),
    purchaseYear: readCell(row, "매입년도"),
    sequence: readCell(row, "순번"),
    supplyAreaSquareMeters: readCell(row, "공급면적"),
    supplyTypeName: readCell(row, "공급유형"),
  };
}

function readCell(row: CsvRow, header: string) {
  return row[header] ?? "";
}
