import { afterEach, expect, test, vi } from "vitest";

import { recordLocationDetailView } from "./location-detail-view-client";

afterEach(() => vi.unstubAllGlobals());

test("단지 상세 조회를 한 번 전송한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ recorded: true }));
  vi.stubGlobal("fetch", fetchMock);

  await recordLocationDetailView("location-one");

  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/analytics/location-detail-view",
    expect.objectContaining({ keepalive: true, method: "POST" }),
  );
  expect(readRequestBody(fetchMock)).toEqual({ locationId: "location-one" });
});

test("전송 실패는 사용자 흐름으로 전파하지 않는다", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
  vi.stubGlobal("fetch", fetchMock);

  await expect(recordLocationDetailView("location-one")).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledOnce();
});

function readRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  if (typeof request?.body !== "string") throw new Error("상세 조회 요청이 없습니다.");
  return JSON.parse(request.body) as unknown;
}
