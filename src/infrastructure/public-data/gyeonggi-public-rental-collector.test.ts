import { expect, test } from "vitest";

import { createGyeonggiPublicRentalCollection } from "./gyeonggi-public-rental-collector";
import { createRecruitmentReviewFailures } from "./recruitment-review";

test("경기도 LH 단지에 모집 중 공고를 안전하게 결합한다", () => {
  const result = createGyeonggiPublicRentalCollection(
    [createComplexRecord()],
    [createNoticeRecord()],
    "2026-07-29",
  );

  expect(result.locations).toHaveLength(1);
  expect(result.locations[0]?.recruitmentNotices).toMatchObject([
    { id: "19001", title: "판교 국민임대 입주자 모집공고" },
  ]);
  expect(result.locations[0]?.sourceRecords[0]?.referenceDate).toBe("2026-07-29");
  expect(createRecruitmentReviewFailures(result)).toEqual([]);
});

test("연결할 수 없는 공고는 검수 목록에 남기고 정상 단지는 반영한다", () => {
  const result = createGyeonggiPublicRentalCollection(
    [createComplexRecord()],
    [createNoticeRecord({ hsmpSn: "unknown-complex" })],
  );

  expect(result.locations).toHaveLength(1);
  expect(createRecruitmentReviewFailures(result)).toMatchObject([
    {
      announcedAt: "2026-07-29",
      complexId: "unknown-complex",
      noticeId: "19001",
      reason: "UNMATCHED_COMPLEX",
      stage: "ATTACHMENT",
    },
  ]);
});

test("정규화하지 못한 공고는 검수 목록에 남기고 정상 단지는 반영한다", () => {
  const result = createGyeonggiPublicRentalCollection(
    [createComplexRecord()],
    [createNoticeRecord({ pblancId: "", rcritPblancSn: "notice-without-link" })],
  );

  expect(result.locations).toHaveLength(1);
  expect(createRecruitmentReviewFailures(result)).toMatchObject([
    {
      announcedAt: "2026-07-29",
      complexId: "complex-1",
      noticeId: "notice-without-link",
      reason: "MISSING_NOTICE_URL",
      stage: "NORMALIZATION",
    },
  ]);
});

test("LH가 아니거나 종료된 공고는 검수 목록에 남기지 않는다", () => {
  const result = createGyeonggiPublicRentalCollection(
    [createComplexRecord()],
    [
      createNoticeRecord({ insttNm: "경기주택도시공사" }),
      createNoticeRecord({ pblancId: "closed-notice", rcritSttusNm: "접수마감" }),
    ],
  );

  expect(createRecruitmentReviewFailures(result)).toEqual([]);
});

function createComplexRecord() {
  return {
    bassMtRntchrg: "180000",
    bassRentGtn: "12000000",
    competDe: "20200131",
    hsmpNm: "판교 국민임대",
    hsmpSn: "complex-1",
    hshldCo: "500",
    insttNm: "한국토지주택공사",
    rnAdres: "경기도 성남시 분당구 판교로 123",
    suplyTyNm: "국민임대",
  };
}

function createNoticeRecord(overrides: Record<string, string> = {}) {
  return {
    hsmpNm: "판교 국민임대",
    hsmpSn: "complex-1",
    insttNm: "한국토지주택공사",
    pblancDe: "20260729",
    pblancId: "19001",
    pblancNm: "판교 국민임대 입주자 모집공고",
    rcritSttusNm: "접수중",
    ...overrides,
  };
}
