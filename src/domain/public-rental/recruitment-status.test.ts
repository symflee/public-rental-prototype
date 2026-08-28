import { describe, expect, test } from "vitest";

import type { PublicRentalRecruitmentNotice } from "./public-rental-location";
import {
  hasManualRecruitmentStatusEvidenceAt,
  readRecruitmentNoticePeriodStateAt,
  readRecruitmentStateAt,
} from "./recruitment-status";

describe("모집 상태 판정", () => {
  test("연결된 공고가 없으면 공고 중이 아님으로 판정한다", testNoNotice);
  test("날짜 모집 기간은 한국 날짜의 시작과 끝을 포함한다", testInclusiveKoreaDates);
  test("시간대가 없는 모집 시각은 한국 시간으로 해석한다", testKoreaLocalTimes);
  test("기간이 없는 기존 공고는 알 수 없음으로 판정한다", testUnknownLegacyNotice);
  test("잘못된 모집 기간은 알 수 없음으로 판정한다", testUnknownInvalidPeriod);
  test("공고 하나가 열려 있으면 다른 불완전한 공고가 있어도 공고 중이다", testOpenWins);
  test("잘못된 기준 시각은 알 수 없음으로 판정한다", testUnknownReferenceTime);
  test("개별 공고는 모집 예정과 종료를 구분한다", testNoticePeriodStates);
  test("기간을 검토한 수기 공고는 종료 뒤에도 상태 판정 근거로 남는다", testManualEvidence);
});

function testManualEvidence() {
  const referenceTime = "2026-08-28T12:00+09:00";
  const manualLocation = createLocation(createNotice());
  const automaticLocation = createLocation(createNotice({ sourceKind: "AUTOMATED_IMPORT" }));

  expect(hasManualRecruitmentStatusEvidenceAt(manualLocation, referenceTime)).toBe(true);
  expect(hasManualRecruitmentStatusEvidenceAt(automaticLocation, referenceTime)).toBe(false);
}

function testNoNotice() {
  const state = readRecruitmentStateAt({}, "2026-08-12T12:00:00+09:00");

  expect(state).toEqual({ openNotices: [], status: "NO_OPEN" });
}

function testNoticePeriodStates() {
  const notice = createNotice();

  expect(readRecruitmentNoticePeriodStateAt(notice, "2026-08-10T12:00+09:00")).toBe("UPCOMING");
  expect(readRecruitmentNoticePeriodStateAt(notice, "2026-08-15T12:00+09:00")).toBe("CLOSED");
}

function testInclusiveKoreaDates() {
  const location = createLocation(createNotice());

  expect(readStatus(location, "2026-08-10T15:00:00.000Z")).toBe("OPEN");
  expect(readStatus(location, "2026-08-14T14:59:59.999Z")).toBe("OPEN");
  expect(readStatus(location, "2026-08-10T14:59:59.999Z")).toBe("NO_OPEN");
  expect(readStatus(location, "2026-08-14T15:00:00.000Z")).toBe("NO_OPEN");
}

function testKoreaLocalTimes() {
  const notice = createNotice({
    applicationStartsAt: "2026-08-11T10:00",
    applicationEndsAt: "2026-08-12T16:00",
  });
  const location = createLocation(notice);

  expect(readStatus(location, "2026-08-11T01:00:00.000Z")).toBe("OPEN");
  expect(readStatus(location, "2026-08-12T07:00:00.000Z")).toBe("OPEN");
  expect(readStatus(location, "2026-08-12T07:00:00.001Z")).toBe("NO_OPEN");
}

function testUnknownLegacyNotice() {
  const notice = createNotice({ applicationStartsAt: undefined, applicationEndsAt: undefined });
  const state = readRecruitmentStateAt(createLocation(notice), new Date("2026-08-12T03:00Z"));

  expect(state).toEqual({ openNotices: [], status: "UNKNOWN" });
}

function testUnknownInvalidPeriod() {
  const notice = createNotice({
    applicationStartsAt: "2026-02-30T10:00:00+09:00",
    applicationEndsAt: "2026-08-11T10:00:00+09:00",
  });

  expect(readStatus(createLocation(notice), "2026-08-12T12:00+09:00")).toBe("UNKNOWN");
}

function testOpenWins() {
  const legacyNotice = createNotice({ id: "legacy", applicationStartsAt: undefined });
  const location = { recruitmentNotices: [legacyNotice, createNotice()] };
  const state = readRecruitmentStateAt(location, "2026-08-12T12:00+09:00");

  expect(state.status).toBe("OPEN");
  expect(state.openNotices).toEqual([createNotice()]);
}

function testUnknownReferenceTime() {
  const state = readRecruitmentStateAt(createLocation(createNotice()), "not-a-date");

  expect(state).toEqual({ openNotices: [], status: "UNKNOWN" });
}

function readStatus(
  location: Readonly<{ recruitmentNotices: readonly PublicRentalRecruitmentNotice[] }>,
  referenceTime: string,
) {
  return readRecruitmentStateAt(location, referenceTime).status;
}

function createLocation(notice: PublicRentalRecruitmentNotice) {
  return { recruitmentNotices: [notice] };
}

function createNotice(
  overrides: Partial<PublicRentalRecruitmentNotice> = {},
): PublicRentalRecruitmentNotice {
  return {
    announcedAt: "2026-07-27",
    applicationEndsAt: "2026-08-14",
    applicationStartsAt: "2026-08-11",
    evidenceUrl: "https://apply.lh.or.kr/notices/1",
    id: "notice-1",
    sourceKind: "MANUAL_REVIEW",
    title: "공공임대주택 모집공고",
    url: "https://apply.lh.or.kr/notices/1",
    ...overrides,
  };
}
