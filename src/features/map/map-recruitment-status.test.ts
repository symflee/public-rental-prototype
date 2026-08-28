import { expect, test } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import {
  isRecruitmentAbsenceReliable,
  readManualRecruitmentTiming,
  readMapRecruitmentState,
} from "./map-recruitment-status";

const NOW = new Date("2026-08-28T03:00:00.000Z");

test("오래된 스냅샷의 공고 부재는 모집 상태 확인 필요로 바꾼다", () => {
  const state = readMapRecruitmentState(createLocation([]), false, NOW);

  expect(state.status).toBe("UNKNOWN");
});

test("수기 공고는 모집 예정과 지난 공고를 구분한다", () => {
  const upcoming = createLocation([createNotice("2026-09-01", "2026-09-03")]);
  const closed = createLocation([createNotice("2026-08-11", "2026-08-14")]);

  expect(readManualRecruitmentTiming(upcoming, NOW)).toBe("UPCOMING");
  expect(readManualRecruitmentTiming(closed, NOW)).toBe("CLOSED");
});

test("검증 상태와 72시간 이내 생성 시각이 모두 있어야 공고 부재를 신뢰한다", () => {
  expect(isRecruitmentAbsenceReliable("2026-08-27T03:00:00.000Z", "verified", NOW)).toBe(true);
  expect(isRecruitmentAbsenceReliable("2026-08-20T03:00:00.000Z", "verified", NOW)).toBe(false);
  expect(isRecruitmentAbsenceReliable("2026-08-27T03:00:00.000Z", "partial", NOW)).toBe(false);
});

function createLocation(
  recruitmentNotices: PublicRentalLocation["recruitmentNotices"],
): PublicRentalLocation {
  return {
    addressAliases: [],
    completionDate: null,
    coordinate: null,
    district: "하남시",
    householdCount: null,
    id: "location-a",
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories: [],
    municipality: "HANAM",
    name: "테스트 주택",
    offerings: [],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    recruitmentNotices,
    roadAddress: "경기도 하남시",
    sourceRecords: [],
  };
}

function createNotice(applicationStartsAt: string, applicationEndsAt: string) {
  return {
    announcedAt: "2026-07-20",
    applicationEndsAt,
    applicationStartsAt,
    id: `notice-${applicationStartsAt}`,
    sourceKind: "MANUAL_REVIEW" as const,
    title: "수기 공고",
    url: "https://apply.lh.or.kr/notice",
  };
}
