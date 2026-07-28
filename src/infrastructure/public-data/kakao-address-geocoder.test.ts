import { expect, test, vi } from "vitest";

import { geocodeKakaoAddress, type PublicDataHttpResponse } from "./kakao-address-geocoder";

const REST_API_KEY = "server-only-key";

test("도로명주소를 WGS84 좌표로 변환한다", async () => {
  const fetchFunction = createGeocodingFetch({
    documents: [{ x: "127.161748", y: "37.449531" }],
  });

  const result = await geocodeKakaoAddress("경기도 성남시 수정구 단대로23번길 36", {
    fetchFunction,
    restApiKey: REST_API_KEY,
  });

  expect(result).toEqual({
    coordinate: { latitude: 37.449531, longitude: 127.161748 },
    success: true,
  });
  expectGeocodingRequest(fetchFunction);
});

test("검색 결과가 없으면 구분 가능한 실패를 반환한다", async () => {
  const fetchFunction = createGeocodingFetch({ documents: [] });

  const result = await geocodeKakaoAddress("존재하지 않는 주소", {
    fetchFunction,
    restApiKey: REST_API_KEY,
  });

  expect(result).toEqual({
    failure: { kind: "not-found", message: "주소 검색 결과가 없습니다." },
    success: false,
  });
});

test("잘못된 응답에 인증키를 포함하지 않는다", async () => {
  const fetchFunction = createGeocodingFetch({ documents: [{ x: "invalid", y: "37" }] });

  const result = await geocodeKakaoAddress("경기도 성남시", {
    fetchFunction,
    restApiKey: REST_API_KEY,
  });

  expect(result.success).toBe(false);
  expect(JSON.stringify(result)).not.toContain(REST_API_KEY);
});

function createGeocodingFetch(payload: unknown) {
  return vi.fn(async (input: string | URL, request?: RequestInit) => {
    void input;
    void request;
    return createResponse(payload);
  });
}

function createResponse(payload: unknown): PublicDataHttpResponse {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  };
}

function expectGeocodingRequest(fetchFunction: ReturnType<typeof createGeocodingFetch>) {
  const [input, request] = fetchFunction.mock.calls[0] ?? [];
  const url = new URL(String(input));
  expect(url.pathname).toBe("/v2/local/search/address.json");
  expect(url.searchParams.get("query")).toBe("경기도 성남시 수정구 단대로23번길 36");
  expect(request?.headers).toEqual({ Authorization: `KakaoAK ${REST_API_KEY}` });
}
