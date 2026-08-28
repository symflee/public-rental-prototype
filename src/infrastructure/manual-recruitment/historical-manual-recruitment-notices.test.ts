import { expect, test } from "vitest";

import { readRecruitmentStateAt } from "@/domain/public-rental";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

import { HISTORICAL_MANUAL_RECRUITMENT_NOTICES } from "./historical-manual-recruitment-notices";

test("공식 과거 공고 세 건을 현재 스냅샷의 단지 열 곳에 연결한다", () => {
  const snapshotIds = new Set(publicRentalSnapshot.locations.map((location) => location.id));
  const locationIds = HISTORICAL_MANUAL_RECRUITMENT_NOTICES.flatMap((notice) => notice.locationIds);

  expect(HISTORICAL_MANUAL_RECRUITMENT_NOTICES.map((notice) => notice.id)).toEqual([
    "20853",
    "20894",
    "20917",
  ]);
  expect(locationIds).toHaveLength(12);
  expect(locationIds.every((locationId) => snapshotIds.has(locationId))).toBe(true);
});

test("공식 근거 URL과 8월 11일부터 14일까지의 모집 기간을 보존한다", () => {
  for (const notice of HISTORICAL_MANUAL_RECRUITMENT_NOTICES) {
    expect(new URL(notice.evidenceUrl).hostname).toBe("apply.lh.or.kr");
    expect(
      readRecruitmentStateAt({ recruitmentNotices: [notice] }, notice.applicationStartsAt).status,
    ).toBe("OPEN");
  }
});
