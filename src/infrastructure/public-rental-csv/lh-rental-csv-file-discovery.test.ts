import { expect, test } from "vitest";

import { chooseLhRentalCsvFileNames } from "./lh-rental-csv-file-discovery";

test("NFC 건설 파일과 NFD 매입 파일을 찾는다", () => {
  const construction = "한국토지주택공사_임대주택단지정보_건설_20250918.csv";
  const purchase = "한국토지주택공사_임대주택단지정보_매입_20220127.csv".normalize("NFD");

  expect(chooseLhRentalCsvFileNames([purchase, construction])).toEqual({
    constructionFileName: construction,
    purchaseFileName: purchase,
  });
});

test("같은 종류의 파일이 둘이면 수집을 중단한다", () => {
  const fileNames = [
    "한국토지주택공사_임대주택단지정보_건설_20250918.csv",
    "백업_건설_20250918.csv",
    "한국토지주택공사_임대주택단지정보_매입_20220127.csv",
  ];

  expect(() => chooseLhRentalCsvFileNames(fileNames)).toThrow("건설 CSV 파일이 2개");
});

test("필요한 파일이 없으면 수집을 중단한다", () => {
  const fileNames = ["한국토지주택공사_임대주택단지정보_건설_20250918.csv"];

  expect(() => chooseLhRentalCsvFileNames(fileNames)).toThrow("매입 CSV 파일이 0개");
});
