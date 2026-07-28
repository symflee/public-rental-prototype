import type { PublicRentalLocation } from "@/domain/public-rental";
import type { LhLeaseVerificationRecord } from "@/infrastructure/public-data/lh-lease-verification-client";
import type {
  LhApartmentVerificationCandidate,
  SeongnamApartmentVerificationCandidate,
} from "@/infrastructure/public-data/verification-csv-parsers";

const DANDAE_LOCATION_ID = "seongnam:dandae-happy-housing";
const DANDAE_LOCATION_NAME = "단대동 행복주택";

export type PublicRentalReviewSource =
  "lh-lease-api" | "lh-national-apartment-csv" | "seongnam-apartment-csv";

export type PublicRentalReviewIssueCode =
  | "ADDRESS_CONFLICT"
  | "ADDRESS_REFERENCE_MISSING"
  | "HOUSEHOLD_COUNT_CONFLICT"
  | "NAME_CONFLICT"
  | "PUBLISHED_LOCATION_MISSING"
  | "UNMATCHED_CANDIDATE";

export type PublicRentalReviewIssue = Readonly<{
  candidateIdentifier: string | null;
  candidateName: string;
  code: PublicRentalReviewIssueCode;
  locationId: string | null;
  message: string;
  publishedValue: string | null;
  source: PublicRentalReviewSource;
  verificationValue: string | null;
}>;

export type PublicRentalReviewSummary = Readonly<{
  candidateCount: number;
  conflictCount: number;
  matchedCount: number;
  source: PublicRentalReviewSource;
  unmatchedCount: number;
}>;

export type PublicRentalReviewResult = Readonly<{
  issues: ReadonlyArray<PublicRentalReviewIssue>;
  summaries: ReadonlyArray<PublicRentalReviewSummary>;
}>;

type VerificationCandidate = Readonly<{
  address: string | null;
  householdCount: string | null;
  identifier: string | null;
  name: string;
  source: PublicRentalReviewSource;
}>;

type CandidateMatch =
  | Readonly<{
      candidate: VerificationCandidate;
      location: PublicRentalLocation;
      matched: true;
      method: "identifier" | "name";
    }>
  | Readonly<{ candidate: VerificationCandidate; matched: false }>;

type MatchedCandidate = Extract<CandidateMatch, Readonly<{ matched: true }>>;

type SourceReview = Readonly<{
  issues: ReadonlyArray<PublicRentalReviewIssue>;
  summary: PublicRentalReviewSummary;
}>;

export function reviewPublicRentalSources(
  locations: ReadonlyArray<PublicRentalLocation>,
  leaseRecords: ReadonlyArray<LhLeaseVerificationRecord>,
  lhCandidates: ReadonlyArray<LhApartmentVerificationCandidate>,
  seongnamCandidates: ReadonlyArray<SeongnamApartmentVerificationCandidate>,
): PublicRentalReviewResult {
  return mergeSourceReviews([
    reviewLeaseSource(locations, leaseRecords),
    reviewLhCsvSource(locations, lhCandidates),
    reviewCitySource(locations, seongnamCandidates),
  ]);
}

function mergeSourceReviews(reviews: ReadonlyArray<SourceReview>) {
  return {
    issues: reviews.flatMap((review) => review.issues),
    summaries: reviews.map((review) => review.summary),
  };
}

function reviewLeaseSource(
  locations: ReadonlyArray<PublicRentalLocation>,
  records: ReadonlyArray<LhLeaseVerificationRecord>,
) {
  return reviewLhSource(locations, createLeaseCandidates(records), "lh-lease-api");
}

function createLeaseCandidates(records: ReadonlyArray<LhLeaseVerificationRecord>) {
  const candidates = new Map<string, VerificationCandidate>();
  records
    .map(toLeaseCandidate)
    .forEach((candidate) => collectLeaseCandidate(candidates, candidate));
  return [...candidates.values()];
}

function collectLeaseCandidate(
  candidates: Map<string, VerificationCandidate>,
  candidate: VerificationCandidate,
) {
  const identifier = normalizeName(candidate.name);
  const current = candidates.get(identifier);
  if (!current) return void candidates.set(identifier, candidate);
  candidates.set(identifier, selectGreaterHouseholdCandidate(current, candidate));
}

function selectGreaterHouseholdCandidate(
  current: VerificationCandidate,
  candidate: VerificationCandidate,
) {
  const currentCount = parseHouseholdCount(current.householdCount);
  const candidateCount = parseHouseholdCount(candidate.householdCount);
  if (candidateCount === null) return current;
  if (currentCount === null) return candidate;
  if (candidateCount <= currentCount) return current;
  return candidate;
}

function reviewLhCsvSource(
  locations: ReadonlyArray<PublicRentalLocation>,
  candidates: ReadonlyArray<LhApartmentVerificationCandidate>,
) {
  return reviewLhSource(locations, candidates.map(toLhCsvCandidate), "lh-national-apartment-csv");
}

function reviewLhSource(
  locations: ReadonlyArray<PublicRentalLocation>,
  candidates: ReadonlyArray<VerificationCandidate>,
  source: PublicRentalReviewSource,
): SourceReview {
  const matches = candidates.map((candidate) => matchLhCandidate(locations, candidate));
  const issues = matches.flatMap(reviewLhMatch);
  return createSourceReview(source, candidates.length, matches, issues);
}

function matchLhCandidate(
  locations: ReadonlyArray<PublicRentalLocation>,
  candidate: VerificationCandidate,
): CandidateMatch {
  const lhLocations = locations.filter(isLhLocation);
  const identifierMatches = findIdentifierMatches(lhLocations, candidate.identifier);
  if (identifierMatches.length > 0)
    return createCandidateMatch(candidate, identifierMatches, "identifier");
  return createCandidateMatch(candidate, findNameMatches(lhLocations, candidate), "name");
}

function createCandidateMatch(
  candidate: VerificationCandidate,
  locations: ReadonlyArray<PublicRentalLocation>,
  method: "identifier" | "name",
): CandidateMatch {
  const location = readUniqueLocation(locations);
  if (!location) return { candidate, matched: false };
  return { candidate, location, matched: true, method };
}

function findNameMatches(
  locations: ReadonlyArray<PublicRentalLocation>,
  candidate: VerificationCandidate,
) {
  const normalizedName = normalizeName(candidate.name);
  return locations.filter(matchesNormalizedName(normalizedName));
}

function findIdentifierMatches(
  locations: ReadonlyArray<PublicRentalLocation>,
  identifier: string | null,
) {
  if (!identifier) return [];
  return locations.filter((location) => hasSourceIdentifier(location, identifier));
}

function hasSourceIdentifier(location: PublicRentalLocation, identifier: string) {
  if (location.id === identifier) return true;
  return location.sourceRecords.some((record) => record.sourceId === identifier);
}

function matchesNormalizedName(normalizedName: string) {
  return (location: PublicRentalLocation) => normalizeName(location.name) === normalizedName;
}

function readUniqueLocation(locations: ReadonlyArray<PublicRentalLocation>) {
  if (locations.length !== 1) return null;
  return locations[0] ?? null;
}

function reviewLhMatch(match: CandidateMatch) {
  if (!match.matched) return [createUnmatchedIssue(match.candidate)];
  const issues = [readNameIssue(match), readHouseholdIssue(match), readAddressIssue(match)];
  return issues.filter(isReviewIssue);
}

function readNameIssue(match: MatchedCandidate): PublicRentalReviewIssue | null {
  if (match.method !== "identifier") return null;
  if (normalizeName(match.candidate.name) === normalizeName(match.location.name)) return null;
  return createConflictIssue(
    match,
    "NAME_CONFLICT",
    match.location.name,
    match.candidate.name,
    "동일 ID의 공개 단지명과 검수 원천 단지명이 다릅니다.",
  );
}

function readHouseholdIssue(match: MatchedCandidate): PublicRentalReviewIssue | null {
  const candidateCount = parseHouseholdCount(match.candidate.householdCount);
  if (candidateCount === null || match.location.householdCount === null) return null;
  if (candidateCount === match.location.householdCount) return null;
  return createConflictIssue(
    match,
    "HOUSEHOLD_COUNT_CONFLICT",
    String(match.location.householdCount),
    String(candidateCount),
    "공개 세대수와 검수 원천의 세대수가 다릅니다.",
  );
}

function readAddressIssue(match: MatchedCandidate): PublicRentalReviewIssue | null {
  if (match.candidate.address === null) return null;
  if (match.candidate.address.trim().length === 0) return createMissingAddressIssue(match);
  if (addressesMatch(match.location.roadAddress, match.candidate.address)) return null;
  return createConflictIssue(
    match,
    "ADDRESS_CONFLICT",
    match.location.roadAddress,
    match.candidate.address,
    "공개 주소와 검수 원천의 주소가 다릅니다.",
  );
}

function createMissingAddressIssue(match: MatchedCandidate) {
  return createConflictIssue(
    match,
    "ADDRESS_REFERENCE_MISSING",
    match.location.roadAddress,
    null,
    "검수 원천에 주소가 없습니다.",
  );
}

function createConflictIssue(
  match: MatchedCandidate,
  code: PublicRentalReviewIssueCode,
  publishedValue: string | null,
  verificationValue: string | null,
  message: string,
): PublicRentalReviewIssue {
  return {
    ...createMatchIssueBase(match, message),
    code,
    publishedValue,
    verificationValue,
  };
}

function createMatchIssueBase(match: MatchedCandidate, message: string) {
  return {
    candidateIdentifier: match.candidate.identifier,
    candidateName: match.candidate.name,
    locationId: match.location.id,
    message,
    source: match.candidate.source,
  };
}

function createUnmatchedIssue(candidate: VerificationCandidate): PublicRentalReviewIssue {
  return {
    candidateIdentifier: candidate.identifier,
    candidateName: candidate.name,
    code: "UNMATCHED_CANDIDATE",
    locationId: null,
    message: "검수 후보와 연결할 공개 LH 위치를 찾지 못했습니다.",
    publishedValue: null,
    source: candidate.source,
    verificationValue: candidate.name,
  };
}

function createSourceReview(
  source: PublicRentalReviewSource,
  candidateCount: number,
  matches: ReadonlyArray<CandidateMatch>,
  issues: ReadonlyArray<PublicRentalReviewIssue>,
): SourceReview {
  const matchedCount = matches.filter(isMatchedCandidate).length;
  const conflictCount = issues.filter(isConflictIssue).length;
  const unmatchedCount = candidateCount - matchedCount;
  return {
    issues,
    summary: { candidateCount, conflictCount, matchedCount, source, unmatchedCount },
  };
}

function reviewCitySource(
  locations: ReadonlyArray<PublicRentalLocation>,
  candidates: ReadonlyArray<SeongnamApartmentVerificationCandidate>,
): SourceReview {
  const matchingCandidates = candidates.filter(matchesDandaeName);
  const location = locations.find((candidate) => candidate.id === DANDAE_LOCATION_ID);
  if (!location) return reviewMissingCityLocation(candidates.length, matchingCandidates.length);
  if (matchingCandidates.length === 0)
    return createMissingCityAddressReview(candidates.length, location);
  const issues = matchingCandidates.flatMap((candidate) => reviewCityAddress(location, candidate));
  return createCityReview(candidates.length, matchingCandidates.length, issues);
}

function matchesDandaeName(candidate: SeongnamApartmentVerificationCandidate) {
  return normalizeName(candidate.complexName) === normalizeName(DANDAE_LOCATION_NAME);
}

function reviewCityAddress(
  location: PublicRentalLocation,
  candidate: SeongnamApartmentVerificationCandidate,
) {
  if (candidate.roadAddress.trim().length === 0)
    return [createCityAddressIssue(location, candidate, "ADDRESS_REFERENCE_MISSING")];
  if (addressesMatch(location.roadAddress, candidate.roadAddress)) return [];
  return [createCityAddressIssue(location, candidate, "ADDRESS_CONFLICT")];
}

function createCityAddressIssue(
  location: PublicRentalLocation,
  candidate: SeongnamApartmentVerificationCandidate,
  code: "ADDRESS_CONFLICT" | "ADDRESS_REFERENCE_MISSING",
): PublicRentalReviewIssue {
  return {
    ...createCityIssueBase(location, candidate),
    code,
    message: readCityAddressMessage(code),
    publishedValue: location.roadAddress,
    verificationValue: readVerificationAddress(candidate.roadAddress),
  };
}

function createCityIssueBase(
  location: PublicRentalLocation,
  candidate: SeongnamApartmentVerificationCandidate,
) {
  return {
    candidateIdentifier: null,
    candidateName: candidate.complexName,
    locationId: location.id,
    source: "seongnam-apartment-csv" as const,
  };
}

function createMissingCityAddressReview(
  candidateCount: number,
  location: PublicRentalLocation,
): SourceReview {
  const issue = createMissingCityReferenceIssue(location);
  return createCityReview(candidateCount, 0, [issue]);
}

function createMissingCityReferenceIssue(location: PublicRentalLocation): PublicRentalReviewIssue {
  return {
    candidateIdentifier: null,
    candidateName: location.name,
    code: "ADDRESS_REFERENCE_MISSING",
    locationId: location.id,
    message: "성남시 공동주택 CSV에서 단대동 행복주택 주소를 찾지 못했습니다.",
    publishedValue: location.roadAddress,
    source: "seongnam-apartment-csv",
    verificationValue: null,
  };
}

function reviewMissingCityLocation(candidateCount: number, dandaeCandidateCount: number) {
  if (dandaeCandidateCount === 0) return createCityReview(candidateCount, 0, []);
  return createMissingCityLocationReview(candidateCount);
}

function createMissingCityLocationReview(candidateCount: number): SourceReview {
  const issue = createMissingPublishedLocationIssue();
  return createCityReview(candidateCount, 0, [issue]);
}

function createMissingPublishedLocationIssue(): PublicRentalReviewIssue {
  return {
    candidateIdentifier: null,
    candidateName: "단대동 행복주택",
    code: "PUBLISHED_LOCATION_MISSING",
    locationId: null,
    message: "공개 위치 목록에 단대동 행복주택이 없습니다.",
    publishedValue: null,
    source: "seongnam-apartment-csv",
    verificationValue: null,
  };
}

function createCityReview(
  candidateCount: number,
  matchedCount: number,
  issues: ReadonlyArray<PublicRentalReviewIssue>,
): SourceReview {
  const summary = createCitySummary(candidateCount, matchedCount, issues.length);
  return { issues, summary };
}

function createCitySummary(
  candidateCount: number,
  matchedCount: number,
  conflictCount: number,
): PublicRentalReviewSummary {
  return {
    candidateCount,
    conflictCount,
    matchedCount,
    source: "seongnam-apartment-csv",
    unmatchedCount: candidateCount - matchedCount,
  };
}

function toLeaseCandidate(record: LhLeaseVerificationRecord): VerificationCandidate {
  return {
    address: null,
    householdCount: record.SUM_HSH_CNT ?? null,
    identifier: null,
    name: record.SBD_LGO_NM ?? "",
    source: "lh-lease-api",
  };
}

function toLhCsvCandidate(candidate: LhApartmentVerificationCandidate): VerificationCandidate {
  return {
    address: candidate.address,
    householdCount: candidate.householdCount,
    identifier: candidate.complexCode,
    name: candidate.complexName,
    source: "lh-national-apartment-csv",
  };
}

function parseHouseholdCount(value: string | null) {
  if (value === null) return null;
  const normalizedValue = value.replaceAll(",", "").trim();
  if (normalizedValue.length === 0) return null;
  const count = Number(normalizedValue);
  if (!Number.isSafeInteger(count) || count < 0) return null;
  return count;
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s()[\]{}（）·._-]/gu, "");
}

function addressesMatch(publishedAddress: string, verificationAddress: string) {
  return normalizeAddress(publishedAddress) === normalizeAddress(verificationAddress);
}

function normalizeAddress(value: string) {
  const provinceNormalized = value
    .normalize("NFKC")
    .trim()
    .replace(/^경기(?=\s)/u, "경기도");
  return provinceNormalized.toLocaleLowerCase("ko-KR").replace(/[\s,.]/gu, "");
}

function readCityAddressMessage(code: PublicRentalReviewIssueCode) {
  if (code === "ADDRESS_REFERENCE_MISSING") return "성남시 검수 행에 주소가 없습니다.";
  return "단대동 행복주택의 공개 주소와 성남시 검수 주소가 다릅니다.";
}

function readVerificationAddress(address: string) {
  if (address.trim().length === 0) return null;
  return address;
}

function isLhLocation(location: PublicRentalLocation) {
  return location.provider === "LH";
}

function isMatchedCandidate(match: CandidateMatch) {
  return match.matched;
}

function isConflictIssue(issue: PublicRentalReviewIssue) {
  return issue.code !== "UNMATCHED_CANDIDATE";
}

function isReviewIssue(issue: PublicRentalReviewIssue | null): issue is PublicRentalReviewIssue {
  return issue !== null;
}
