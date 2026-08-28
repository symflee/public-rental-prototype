import { expect, test } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import { mergeManualRecruitmentNotices } from "./manual-recruitment-overlay";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

test("수기 공고를 연결된 주택에만 합성한다", () => {
  const locations = [createLocation("location-a"), createLocation("location-b")];
  const result = mergeManualRecruitmentNotices(locations, [createNotice()]);

  expect(result[0]?.recruitmentNotices).toEqual([
    expect.objectContaining({ id: "20853", sourceKind: "MANUAL_REVIEW" }),
  ]);
  expect(result[1]?.recruitmentNotices).toEqual([]);
});

test("같은 공고 식별자의 스냅샷 공고를 수기 기간 정보로 교체한다", () => {
  const location = createLocation("location-a", [
    {
      announcedAt: "2026-07-20",
      id: "20853",
      title: "기간 없는 공고",
      url: "https://apply.lh.or.kr/old",
    },
  ]);
  const result = mergeManualRecruitmentNotices([location], [createNotice()]);

  expect(result[0]?.recruitmentNotices).toHaveLength(1);
  expect(result[0]?.recruitmentNotices?.[0]?.applicationEndsAt).toBe("2026-08-14");
});

function createLocation(
  id: string,
  recruitmentNotices: PublicRentalLocation["recruitmentNotices"] = [],
): PublicRentalLocation {
  return {
    addressAliases: [],
    completionDate: null,
    coordinate: null,
    district: "하남시",
    householdCount: null,
    id,
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories: [],
    municipality: "HANAM",
    name: id,
    offerings: [],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    recruitmentNotices,
    roadAddress: "경기도 하남시",
    sourceRecords: [],
  };
}

function createNotice(): ManualRecruitmentNoticeInput {
  return {
    announcedAt: "2026-07-20",
    applicationEndsAt: "2026-08-14",
    applicationStartsAt: "2026-07-27",
    evidenceUrl: "https://apply.lh.or.kr/notice/20853",
    id: "20853",
    locationIds: ["location-a"],
    sourceKind: "MANUAL_REVIEW",
    title: "하남 공고",
    url: "https://apply.lh.or.kr/notice/20853",
  };
}
