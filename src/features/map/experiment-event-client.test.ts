import { afterEach, expect, test, vi } from "vitest";

import {
  recordBookmarkChange,
  recordExperimentEligible,
  recordNoOpenNoticeLocationViewed,
} from "./experiment-event-client";

afterEach(() => vi.unstubAllGlobals());

test("실험 자격과 비모집 주택 상세 조회 이벤트를 공통 API로 보낸다", async () => {
  const fetchMock = createFetchMock();

  await recordExperimentEligible();
  await recordNoOpenNoticeLocationViewed("location-one");

  expect(readEvent(fetchMock, 0)).toMatchObject({ eventKind: "EXPERIMENT_ELIGIBLE" });
  expect(readEvent(fetchMock, 1)).toMatchObject({
    eventKind: "NO_OPEN_NOTICE_LOCATION_VIEWED",
    locationId: "location-one",
  });
});

test("북마크 상태에 맞는 추가와 해제 이벤트를 보낸다", async () => {
  const fetchMock = createFetchMock();

  await recordBookmarkChange("location-one", true);
  await recordBookmarkChange("location-one", false);

  expect(readEvent(fetchMock, 0)).toMatchObject({ eventKind: "BOOKMARK_ADDED" });
  expect(readEvent(fetchMock, 1)).toMatchObject({ eventKind: "BOOKMARK_REMOVED" });
});

test("자격 쿠키 응답 뒤에 후속 행동 이벤트를 보낸다", async () => {
  const firstResponse = Promise.withResolvers<Response>();
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(firstResponse.promise)
    .mockResolvedValue(Response.json({ recorded: true }));
  vi.stubGlobal("fetch", fetchMock);

  const eligibleRequest = recordExperimentEligible();
  const detailRequest = recordNoOpenNoticeLocationViewed("location-one");
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  firstResponse.resolve(Response.json({ recorded: true }));
  await Promise.all([eligibleRequest, detailRequest]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("서버가 쿠키 발급이나 일시 실패를 알리면 이벤트를 한 번 재시도한다", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ recorded: false }))
    .mockResolvedValueOnce(Response.json({ recorded: true }));
  vi.stubGlobal("fetch", fetchMock);

  await recordExperimentEligible();

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(readEvent(fetchMock, 0)).toEqual(readEvent(fetchMock, 1));
});

function createFetchMock() {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ recorded: true }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function readEvent(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const request = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  if (typeof request?.body !== "string") throw new Error("실험 이벤트 요청이 없습니다.");
  return JSON.parse(request.body) as unknown;
}
