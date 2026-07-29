import { describe, expect, test } from "vitest";

import { normalizeMyHomeRecruitmentRecords } from "./my-home-recruitment-normalizer";

describe("마이홈 모집공고 정규화", () => {
  test("LH의 진행 중 공고를 단지 연결 정보와 상세 링크로 만든다", testLhRecruitment);
  test("API가 제공한 상세 링크를 우선 사용한다", testSuppliedLink);
  test("LH가 아니거나 종료된 공고는 연결 후보에서 제외한다", testExclusions);
});

function testLhRecruitment() {
  const result = normalizeMyHomeRecruitmentRecords([createRecord()]);

  expect(result.candidates).toEqual([
    {
      complexId: "complex-1",
      complexName: "판교 국민임대",
      notice: {
        announcedAt: "2026-07-29",
        id: "19001",
        title: "판교 국민임대 입주자 모집공고",
        url: "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId=19001",
      },
    },
  ]);
  expect(result.exclusions).toEqual([]);
}

function testSuppliedLink() {
  const result = normalizeMyHomeRecruitmentRecords([
    createRecord({ detailUrl: "https://apply.lh.or.kr/notices/19001" }),
  ]);

  expect(result.candidates[0]?.notice.url).toBe("https://apply.lh.or.kr/notices/19001");
}

function testExclusions() {
  const records = [
    createRecord({ pblancId: "gh-1", insttNm: "경기주택도시공사" }),
    createRecord({ pblancId: "closed-1", rcritSttusNm: "접수마감" }),
  ];
  const result = normalizeMyHomeRecruitmentRecords(records, "2026-07-29");

  expect(result.candidates).toEqual([]);
  expect(result.exclusions.map((exclusion) => exclusion.reason)).toEqual([
    "NON_LH_PROVIDER",
    "NOT_OPEN",
  ]);
}

function createRecord(overrides: Record<string, string> = {}) {
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
