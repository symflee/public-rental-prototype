import type { PublicRentalLocation, PublicRentalRecruitmentNotice } from "./public-rental-location";

const REVIEWED_COMPLEX_LOCATION_IDS = new Map([
  ["의정부민락2b3bl", "31191377"],
  ["의정부고산s4bl", "31274353"],
  ["의정부고산s5bl", "31276982"],
  ["오산청학h1블록", "31206494"],
  ["오산세교주상1블록", "31110418"],
  ["오산청호2블록", "31191160"],
  ["오산세교2a6블럭", "31467977"],
  ["오산세교2a7블록", "31205874"],
  ["하남감일8단지", "31297390"],
  ["하남미사13단지", "30855346"],
]);

export type PublicRentalRecruitmentCandidate = Readonly<{
  complexId: string | null;
  complexName: string | null;
  notice: PublicRentalRecruitmentNotice;
}>;

export type RecruitmentAttachmentResult = Readonly<{
  ambiguousCandidates: readonly PublicRentalRecruitmentCandidate[];
  locations: readonly PublicRentalLocation[];
  unmatchedCandidates: readonly PublicRentalRecruitmentCandidate[];
}>;

export function attachRecruitmentNotices(
  locations: readonly PublicRentalLocation[],
  candidates: readonly PublicRentalRecruitmentCandidate[],
): RecruitmentAttachmentResult {
  const state = createAttachmentState();
  candidates.forEach((candidate) => collectCandidate(candidate, locations, state));
  return createAttachmentResult(locations, state);
}

type AttachmentState = {
  ambiguousCandidates: PublicRentalRecruitmentCandidate[];
  attachments: Map<string, PublicRentalRecruitmentNotice[]>;
  unmatchedCandidates: PublicRentalRecruitmentCandidate[];
};

function createAttachmentState(): AttachmentState {
  return { ambiguousCandidates: [], attachments: new Map(), unmatchedCandidates: [] };
}

function collectCandidate(
  candidate: PublicRentalRecruitmentCandidate,
  locations: readonly PublicRentalLocation[],
  state: AttachmentState,
) {
  const matches = findCandidateMatches(candidate, locations);
  if (matches.length === 0) return state.unmatchedCandidates.push(candidate);
  if (matches.length > 1) return state.ambiguousCandidates.push(candidate);
  addAttachment(matches[0], candidate.notice, state.attachments);
}

function findCandidateMatches(
  candidate: PublicRentalRecruitmentCandidate,
  locations: readonly PublicRentalLocation[],
) {
  const reviewedLocationId = readReviewedLocationId(candidate.complexName);
  if (reviewedLocationId) return locations.filter(matchesLocationIdentifier(reviewedLocationId));
  const complexId = candidate.complexId;
  if (hasText(complexId)) return locations.filter(matchesComplexIdentifier(complexId));
  return locations.filter(matchesComplexName(candidate));
}

function readReviewedLocationId(complexName: string | null) {
  if (!hasText(complexName)) return undefined;
  return REVIEWED_COMPLEX_LOCATION_IDS.get(normalizeName(complexName));
}

function matchesComplexIdentifier(complexId: string) {
  return (location: PublicRentalLocation) => readLocationIdentifiers(location).includes(complexId);
}

function matchesLocationIdentifier(locationId: string) {
  return (location: PublicRentalLocation) => location.id === locationId;
}

function readLocationIdentifiers(location: PublicRentalLocation) {
  return [
    location.id,
    ...location.sourceRecords.map(readSourceIdentifier),
    ...location.properties.map(readPropertyIdentifier),
  ];
}

function readSourceIdentifier(source: PublicRentalLocation["sourceRecords"][number]) {
  return source.sourceId;
}

function readPropertyIdentifier(property: PublicRentalLocation["properties"][number]) {
  return property.sourceId;
}

function matchesComplexName(candidate: PublicRentalRecruitmentCandidate) {
  return (location: PublicRentalLocation) =>
    isSameComplexName(location.name, candidate.complexName);
}

function isSameComplexName(locationName: string, candidateName: string | null) {
  if (!hasText(candidateName)) return false;
  return normalizeName(locationName) === normalizeName(candidateName);
}

function normalizeName(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s·ㆍ\-–—()[\]{}]/gu, "");
}

function hasText(value: string | null): value is string {
  if (!value) return false;
  return value.trim().length > 0;
}

function addAttachment(
  location: PublicRentalLocation | undefined,
  notice: PublicRentalRecruitmentNotice,
  attachments: Map<string, PublicRentalRecruitmentNotice[]>,
) {
  if (!location) return;
  const existing = attachments.get(location.id) ?? [];
  attachments.set(location.id, appendNotice(existing, notice));
}

function appendNotice(
  notices: readonly PublicRentalRecruitmentNotice[],
  notice: PublicRentalRecruitmentNotice,
) {
  if (notices.some((candidate) => candidate.id === notice.id)) return [...notices];
  return [...notices, notice];
}

function createAttachmentResult(
  locations: readonly PublicRentalLocation[],
  state: AttachmentState,
): RecruitmentAttachmentResult {
  return {
    ambiguousCandidates: Object.freeze(state.ambiguousCandidates),
    locations: Object.freeze(
      locations.map((location) => attachLocationNotices(location, state.attachments)),
    ),
    unmatchedCandidates: Object.freeze(state.unmatchedCandidates),
  };
}

function attachLocationNotices(
  location: PublicRentalLocation,
  attachments: Map<string, PublicRentalRecruitmentNotice[]>,
) {
  const notices = attachments.get(location.id);
  if (!notices || notices.length === 0) return location;
  return {
    ...location,
    recruitmentNotices: Object.freeze(appendExistingNotices(location, notices)),
  };
}

function appendExistingNotices(
  location: PublicRentalLocation,
  notices: readonly PublicRentalRecruitmentNotice[],
) {
  return notices.reduce(appendNotice, location.recruitmentNotices ?? []);
}
