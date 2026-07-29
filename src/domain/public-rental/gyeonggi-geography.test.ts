import { describe, expect, test } from "vitest";

import {
  GYEONGGI_COLLECTION_AREAS,
  findGyeonggiAddressArea,
  readGyeonggiMunicipalityAddressName,
  readGyeonggiMunicipalityLabel,
} from "./gyeonggi-geography";

describe("경기도 수집 지역", () => {
  test("31개 시군과 자치구를 포함한 42개 API 요청 대상을 제공한다", () => {
    const municipalities = new Set(GYEONGGI_COLLECTION_AREAS.map(readMunicipality));

    expect(GYEONGGI_COLLECTION_AREAS).toHaveLength(42);
    expect(municipalities.size).toBe(31);
  });

  test("주소에서 자치구와 시군 단위 수집 지역을 찾는다", () => {
    expect(findGyeonggiAddressArea("경기도 용인시 수지구 포은대로 467")).toMatchObject({
      code: "465",
      district: "수지구",
      municipality: "YONGIN",
    });
    expect(findGyeonggiAddressArea("경기도 양평군 양평읍 시민로 1")).toMatchObject({
      code: "830",
      district: "양평군",
      municipality: "YANGPYEONG",
    });
  });

  test("지도의 도시 선택에 쓸 한글 이름을 제공한다", () => {
    expect(readGyeonggiMunicipalityLabel("YONGIN")).toBe("용인");
    expect(readGyeonggiMunicipalityLabel("YANGPYEONG")).toBe("양평");
  });

  test("좌표 검색에 쓸 시군 이름을 제공한다", () => {
    expect(readGyeonggiMunicipalityAddressName("YONGIN")).toBe("용인시");
    expect(readGyeonggiMunicipalityAddressName("YANGPYEONG")).toBe("양평군");
  });
});

function readMunicipality(area: (typeof GYEONGGI_COLLECTION_AREAS)[number]) {
  return area.municipality;
}
