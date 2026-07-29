import { describe, expect, test } from "vitest";

import { createDandaeHappyHousingLocation } from "./seongnam-city-seed";
import {
  attachRecruitmentNotices,
  type PublicRentalRecruitmentCandidate,
} from "./recruitment-linker";

describe("모집공고와 단지 연결", () => {
  test("단지 식별자로 모집공고를 연결한다", testIdentifierMatch);
  test("식별자가 없을 때 단지명 하나와만 일치하면 연결한다", testUniqueNameMatch);
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

function createNotice() {
  return {
    announcedAt: "2026-07-29",
    id: "notice-1",
    title: "단대동 행복주택 모집공고",
    url: "https://example.com/notices/1",
  };
}
