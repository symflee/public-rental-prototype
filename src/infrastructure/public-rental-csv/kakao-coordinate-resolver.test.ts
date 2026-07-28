import { expect, test, vi } from "vitest";

import {
  createEmptyCoordinateCache,
  findUncachedCoordinateRequests,
  mergeLegacySnapshotCoordinates,
  parseRentalCoordinateCache,
  resolveKakaoCoordinates,
  type CoordinateResolutionRequest,
  type KakaoGeocodingHttpResponse,
  type RentalCoordinateCache,
} from "./kakao-coordinate-resolver";

const REQUEST: CoordinateResolutionRequest = {
  district: "수정구",
  locationId: "lh:seongnam:test",
  municipality: "성남시",
  roadAddress: "경기도 성남시 수정구 고등로 57",
};

test("검증된 좌표 캐시는 Kakao를 호출하지 않고 재사용한다", async () => {
  const cache = createCache(REQUEST);
  const fetchFunction = vi.fn();

  const result = await resolveKakaoCoordinates([REQUEST], cache, {
    fetchFunction,
    restApiKey: "server-key",
  });

  expect(fetchFunction).not.toHaveBeenCalled();
  expect(result.coordinates[REQUEST.locationId]).toEqual({
    latitude: 37.431,
    longitude: 127.102,
  });
  expect(findUncachedCoordinateRequests([REQUEST], cache)).toEqual([]);
});

test("기존 앱 스냅샷의 같은 주소 좌표를 새 캐시로 이관한다", () => {
  const snapshot = {
    locations: [
      {
        coordinate: { latitude: 37.431, longitude: 127.102 },
        roadAddress: "경기도 성남시 수정구 고등로 57 ",
      },
    ],
  };

  const cache = mergeLegacySnapshotCoordinates([REQUEST], createEmptyCoordinateCache(), snapshot);

  expect(cache.entries[REQUEST.roadAddress]?.coordinate).toEqual({
    latitude: 37.431,
    longitude: 127.102,
  });
});

test("좌표 캐시 JSON의 필수 필드를 검증한다", () => {
  expect(() =>
    parseRentalCoordinateCache({
      entries: { address: { coordinate: { latitude: "잘못된 값" } } },
      schemaVersion: 1,
    }),
  ).toThrow("좌표 캐시 형식");
});

test("저장된 latitude와 longitude 좌표 캐시를 다시 읽는다", () => {
  const cache = createCache(REQUEST);

  expect(parseRentalCoordinateCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache);
});

test("429와 5xx는 각각 최대 세 번까지 재시도한다", async () => {
  const fetchFunction = vi
    .fn()
    .mockResolvedValueOnce(createResponse(429, {}))
    .mockResolvedValueOnce(createResponse(503, {}))
    .mockResolvedValueOnce(createResponse(502, {}))
    .mockResolvedValueOnce(createKakaoResponse(REQUEST));

  const result = await resolveKakaoCoordinates([REQUEST], createEmptyCoordinateCache(), {
    fetchFunction,
    restApiKey: "server-key",
    wait: async () => undefined,
  });

  expect(fetchFunction).toHaveBeenCalledTimes(4);
  expect(result.failures).toEqual([]);
});

test("응답 주소의 시·구가 다르면 좌표를 게시하지 않는다", async () => {
  const mismatchedRequest = { ...REQUEST, district: "분당구" };
  const fetchFunction = vi.fn().mockResolvedValue(createKakaoResponse(REQUEST));

  const result = await resolveKakaoCoordinates([mismatchedRequest], createEmptyCoordinateCache(), {
    fetchFunction,
    restApiKey: "server-key",
  });

  expect(result.coordinates).toEqual({});
  expect(result.failures[0]?.kind).toBe("address-mismatch");
  expect(result.cache.entries).toEqual({});
});

test("일부 검색이 실패해도 성공한 좌표와 실패 내역을 함께 반환한다", async () => {
  const secondRequest = createSecondRequest();
  const fetchFunction = vi
    .fn()
    .mockResolvedValueOnce(createKakaoResponse(REQUEST))
    .mockResolvedValueOnce(createResponse(200, { documents: [] }));

  const result = await resolveKakaoCoordinates(
    [REQUEST, secondRequest],
    createEmptyCoordinateCache(),
    { fetchFunction, restApiKey: "server-key" },
  );

  expect(Object.keys(result.coordinates)).toEqual([REQUEST.locationId]);
  expect(result.failures).toEqual([
    expect.objectContaining({ kind: "not-found", locationId: secondRequest.locationId }),
  ]);
});

test("Kakao 요청 동시 실행 수를 다섯 개로 제한한다", async () => {
  const requests = Array.from({ length: 11 }, createConcurrentRequest);
  const tracker = { active: 0, maximum: 0 };
  const fetchFunction = createTrackedFetch(tracker);

  const result = await resolveKakaoCoordinates(requests, createEmptyCoordinateCache(), {
    fetchFunction,
    restApiKey: "server-key",
  });

  expect(tracker.maximum).toBe(5);
  expect(result.failures).toEqual([]);
});

function createCache(request: CoordinateResolutionRequest): RentalCoordinateCache {
  return {
    entries: {
      [request.roadAddress]: {
        coordinate: { latitude: 37.431, longitude: 127.102 },
        district: request.district,
        municipality: request.municipality,
        resolvedAddress: request.roadAddress,
      },
    },
    schemaVersion: 1,
  };
}

function createKakaoResponse(request: CoordinateResolutionRequest) {
  return createResponse(200, {
    documents: [
      {
        road_address: { address_name: request.roadAddress },
        x: "127.102",
        y: "37.431",
      },
    ],
  });
}

function createResponse(status: number, payload: unknown): KakaoGeocodingHttpResponse {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
  };
}

function createSecondRequest(): CoordinateResolutionRequest {
  return {
    district: "수지구",
    locationId: "lh:yongin:test",
    municipality: "용인시",
    roadAddress: "경기도 용인시 수지구 풍덕천로 1",
  };
}

function createConcurrentRequest(index: number): CoordinateResolutionRequest {
  return {
    ...REQUEST,
    locationId: `${REQUEST.locationId}-${index}`,
    roadAddress: `${REQUEST.roadAddress}-${index}`,
  };
}

function createTrackedFetch(tracker: { active: number; maximum: number }) {
  return vi.fn(async (input: string | URL) => {
    tracker.active += 1;
    tracker.maximum = Math.max(tracker.maximum, tracker.active);
    await Promise.resolve();
    tracker.active -= 1;
    return createDynamicResponse(input);
  });
}

function createDynamicResponse(input: string | URL) {
  const address = new URL(String(input)).searchParams.get("query") ?? "";
  return createKakaoResponse({ ...REQUEST, roadAddress: address });
}
