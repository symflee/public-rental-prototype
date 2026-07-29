import { afterEach, expect, test, vi } from "vitest";

import { createPublicRentalMapRequestUrl, fetchPublicRentalMap } from "./public-rental-map-client";

afterEach(() => vi.unstubAllGlobals());

test("지도 요청을 범위와 필터가 포함된 작은 API 요청으로 만든다", () => {
  const source = createPublicRentalMapRequestUrl({
    filter: { categories: ["HAPPY_HOUSING"], municipality: "YONGIN", query: "동백 행복" },
    viewport: {
      east: 127.3,
      height: 800,
      level: 6,
      north: 37.7,
      south: 37.1,
      west: 126.9,
      width: 1200,
    },
  });
  const url = new URL(source, "https://example.test");

  expect(url.pathname).toBe("/api/public-rentals");
  expect(url.searchParams.get("categories")).toBe("HAPPY_HOUSING");
  expect(url.searchParams.get("municipality")).toBe("YONGIN");
  expect(url.searchParams.get("query")).toBe("동백 행복");
});

test("지도 API 오류는 호출자에게 실패로 전달한다", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

  await expect(fetchPublicRentalMap(createRequest())).rejects.toThrow(
    "지도 데이터를 불러오지 못했습니다.",
  );
});

function createRequest() {
  return {
    filter: { categories: [], municipality: "ALL" as const, query: "" },
    viewport: {
      east: 127.3,
      height: 800,
      level: 6,
      north: 37.7,
      south: 37.1,
      west: 126.9,
      width: 1200,
    },
  };
}
