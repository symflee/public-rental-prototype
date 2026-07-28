import { expect, test } from "vitest";

import {
  parseLhApartmentVerificationCandidates,
  parseSeongnamApartmentVerificationCandidates,
} from "./verification-csv-parsers";

test("성남시 관련 행만 자동 병합 불가 검수 후보로 반환한다", () => {
  const text = [
    "지역본부,단지코드,단지명,세대수,동수,임대유형,주택유형,주소,준공일,입주지정시작일,입주지정종료일",
    '경기남부,1001,"성남, 테스트단지",100,2,국민임대,아파트,경기도 성남시 분당구 테스트로 1,2020,2020-01-01,2020-01-31',
    "경기남부,1002,수원 테스트단지,200,3,국민임대,아파트,경기도 수원시 테스트로 1,2021,,",
    "경기남부,1003,성남시(전세임대),0,0,전세임대,기타,,,,",
  ].join("\n");

  const result = parseLhApartmentVerificationCandidates(text);

  expect(result.candidates).toHaveLength(2);
  expect(result.candidates[0]?.complexName).toBe("성남, 테스트단지");
  expect(result.candidates.every((candidate) => candidate.reviewOnly)).toBe(true);
});

test("헤더 이름으로 성남시 공동주택 검수 후보를 만든다", () => {
  const text = [
    "구,동,단지명,지번주소,도로명주소,지상층(고),동수,세대수,관리사무소,데이터기준일자",
    "수정구,단대동,단대동 행복주택,단대동 62-11,경기도 성남시 수정구 단대로23번길 36,6,1,60,031-000-0000,2026-07-01",
  ].join("\n");

  const result = parseSeongnamApartmentVerificationCandidates(text);

  expect(result.collectionIssues).toEqual([]);
  expect(result.candidates[0]).toMatchObject({
    complexName: "단대동 행복주택",
    householdCount: "60",
    reviewOnly: true,
    source: "seongnam-apartment-csv",
  });
});

test("필수 헤더가 없으면 후보를 만들지 않고 문제를 반환한다", () => {
  const result = parseSeongnamApartmentVerificationCandidates("단지명\n테스트");

  expect(result.candidates).toEqual([]);
  expect(result.collectionIssues).toHaveLength(1);
});
