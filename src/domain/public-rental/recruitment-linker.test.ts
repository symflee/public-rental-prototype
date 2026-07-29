import { describe, expect, test } from "vitest";

import { createDandaeHappyHousingLocation } from "./seongnam-city-seed";
import {
  attachRecruitmentNotices,
  type PublicRentalRecruitmentCandidate,
} from "./recruitment-linker";

describe("모집공고와 단지 연결", () => {
  test("단지 식별자로 모집공고를 연결한다", testIdentifierMatch);
  test("식별자가 없을 때 단지명 하나와만 일치하면 연결한다", testUniqueNameMatch);
  test("검토 완료한 단지명 열 건은 명시적 위치 ID에만 연결한다", testReviewedNameMatches);
  test("검토 근거가 없는 단지명은 자동 연결하지 않는다", testUnreviewedNameRemainsUnmatched);
  test("같은 단지명이 여러 곳이면 연결하지 않고 검수 대상으로 남긴다", testAmbiguousName);
});

function testIdentifierMatch() {
  const location = createDandaeHappyHousingLocation();
  const result = attachRecruitmentNotices(
    [location],
    [createCandidate({ complexId: location.id })],
  );

  expect(result.locations[0]?.recruitmentNotices).toEqual([createNotice()]);
  expect(result.unmatchedCandidates).toEqual([]);
}

function testUniqueNameMatch() {
  const location = createDandaeHappyHousingLocation();
  const candidate = createCandidate({ complexId: null, complexName: location.name });
  const result = attachRecruitmentNotices([location], [candidate]);

  expect(result.locations[0]?.recruitmentNotices).toEqual([createNotice()]);
  expect(result.ambiguousCandidates).toEqual([]);
}

function testReviewedNameMatches() {
  const candidates = REVIEWED_MATCHES.map(createReviewedCandidate);
  const locations = REVIEWED_MATCHES.map(createReviewedLocation);
  const result = attachRecruitmentNotices(locations, candidates);

  expect(result.unmatchedCandidates).toEqual([]);
  expect(result.locations.every((location) => location.recruitmentNotices?.length === 1)).toBe(
    true,
  );
}

function testUnreviewedNameRemainsUnmatched() {
  const location = { ...createDandaeHappyHousingLocation(), id: "unrelated-location" };
  const candidate = createCandidate({ complexId: "unknown", complexName: "의정부고산 S-1BL" });
  const result = attachRecruitmentNotices([location], [candidate]);

  expect(result.unmatchedCandidates).toEqual([candidate]);
  expect(result.locations[0]?.recruitmentNotices).toBeUndefined();
}

function testAmbiguousName() {
  const location = createDandaeHappyHousingLocation();
  const duplicate = { ...location, id: "duplicate-location" };
  const candidate = createCandidate({ complexId: null, complexName: location.name });
  const result = attachRecruitmentNotices([location, duplicate], [candidate]);

  expect(result.locations.every((value) => !value.recruitmentNotices)).toBe(true);
  expect(result.ambiguousCandidates).toEqual([candidate]);
}

function createCandidate(
  overrides: Partial<PublicRentalRecruitmentCandidate> = {},
): PublicRentalRecruitmentCandidate {
  return {
    complexId: "seongnam:dandae-happy-housing",
    complexName: null,
    notice: createNotice(),
    ...overrides,
  };
}

const REVIEWED_MATCHES = [
  ["의정부민락2 B-3BL", "31191377"],
  ["의정부고산 S-4BL", "31274353"],
  ["의정부고산 S-5BL", "31276982"],
  ["오산청학 H-1블록", "31206494"],
  ["오산세교 주상1블록", "31110418"],
  ["오산청호 2블록", "31191160"],
  ["오산세교2 A-6블럭", "31467977"],
  ["오산세교2 A-7블록", "31205874"],
  ["하남감일 8단지", "31297390"],
  ["하남미사 13단지", "30855346"],
] as const;

function createReviewedCandidate([complexName]: (typeof REVIEWED_MATCHES)[number]) {
  return createCandidate({ complexId: "not-in-snapshot", complexName });
}

function createReviewedLocation([, id]: (typeof REVIEWED_MATCHES)[number]) {
  return { ...createDandaeHappyHousingLocation(), id };
}

function createNotice() {
  return {
    announcedAt: "2026-07-29",
    id: "notice-1",
    title: "단대동 행복주택 모집공고",
    url: "https://example.com/notices/1",
  };
}
