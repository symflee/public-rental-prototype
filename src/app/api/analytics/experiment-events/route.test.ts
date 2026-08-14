import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  isExperimentAnalyticsEnabled: vi.fn(() => true),
  recordAnalyticsSafely: vi.fn(async (record: () => Promise<void>) => {
    await record();
    return true;
  }),
  recordExperimentEvent: vi.fn(async () => undefined),
  resolveExperimentVisitorIdentity: vi.fn<() => { setCookieHeader?: string; visitorHash: string }>(
    () => ({ visitorHash: "hashed-visitor" }),
  ),
}));
const snapshotState = vi.hoisted(() => ({ generatedAt: new Date().toISOString() }));

vi.mock("@/infrastructure/analytics", () => ({
  isExperimentAnalyticsEnabled: mocks.isExperimentAnalyticsEnabled,
  recordAnalyticsSafely: mocks.recordAnalyticsSafely,
  recordExperimentEvent: mocks.recordExperimentEvent,
  resolveExperimentVisitorIdentity: mocks.resolveExperimentVisitorIdentity,
}));

vi.mock("@/infrastructure/public-data/public-rental-snapshot", () => ({
  publicRentalSnapshot: {
    get generatedAt() {
      return snapshotState.generatedAt;
    },
    locations: [
      { id: "without-notice", recruitmentNotices: [] },
      { id: "with-notice", recruitmentNotices: [{ id: "notice-1" }] },
    ],
  },
}));

beforeEach(() => {
  mocks.isExperimentAnalyticsEnabled.mockReturnValue(true);
  mocks.recordAnalyticsSafely.mockImplementation(async (record: () => Promise<void>) => {
    await record();
    return true;
  });
  mocks.resolveExperimentVisitorIdentity.mockReturnValue({ visitorHash: "hashed-visitor" });
  snapshotState.generatedAt = new Date().toISOString();
});
afterEach(() => vi.clearAllMocks());

test("새 방문자는 쿠키만 발급하고 같은 이벤트의 재시도를 요청한다", async () => {
  mocks.resolveExperimentVisitorIdentity.mockReturnValueOnce({
    setCookieHeader:
      "public_rental_experiment_visitor=visitor; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
    visitorHash: "hashed-visitor",
  });
  const response = await POST(createRequest(createEligibleBody()));

  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  await expect(response.json()).resolves.toEqual({ recorded: false });
  expect(mocks.recordExperimentEvent).not.toHaveBeenCalled();
});

test("공고 없는 위치의 조회와 북마크 이벤트만 기록한다", async () => {
  const body = createLocationBody("BOOKMARK_ADDED", "without-notice");
  const response = await POST(createRequest(body));

  expect(response.status).toBe(200);
  expect(mocks.recordExperimentEvent).toHaveBeenCalledWith(body, "hashed-visitor");
});

test("공고 열람 이벤트는 현재 모집공고가 연결된 위치만 기록한다", async () => {
  const body = createLocationBody("OPEN_ANNOUNCEMENT_VIEWED", "with-notice");
  const response = await POST(createRequest(body));

  expect(response.status).toBe(200);
  expect(mocks.recordExperimentEvent).toHaveBeenCalledWith(body, "hashed-visitor");
});

test("저장 뒤 모집 상태가 바뀐 위치도 북마크 해제를 기록한다", async () => {
  const body = createLocationBody("BOOKMARK_REMOVED", "with-notice");
  const response = await POST(createRequest(body));

  expect(response.status).toBe(200);
  expect(mocks.recordExperimentEvent).toHaveBeenCalledWith(body, "hashed-visitor");
});

test("위치의 모집 상태와 맞지 않는 이벤트를 거절한다", async () => {
  const bookmark = await POST(createRequest(createLocationBody("BOOKMARK_ADDED", "with-notice")));
  const announcement = await POST(
    createRequest(createLocationBody("OPEN_ANNOUNCEMENT_VIEWED", "without-notice")),
  );

  expect(bookmark.status).toBe(404);
  expect(announcement.status).toBe(404);
  expect(mocks.recordExperimentEvent).not.toHaveBeenCalled();
});

test("이벤트 ID와 실험 계약이 잘못되면 기록하지 않는다", async () => {
  const response = await POST(createRequest({ ...createEligibleBody(), eventId: "invalid" }));

  expect(response.status).toBe(400);
  expect(mocks.recordExperimentEvent).not.toHaveBeenCalled();
});

test("설정이 없으면 쿠키 없이 성공 응답하고 계측만 생략한다", async () => {
  mocks.isExperimentAnalyticsEnabled.mockReturnValue(false);
  const response = await POST(createRequest(createEligibleBody()));

  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(mocks.resolveExperimentVisitorIdentity).not.toHaveBeenCalled();
});

test("주택 스냅샷이 오래되면 실험 이벤트를 기록하지 않는다", async () => {
  snapshotState.generatedAt = "2020-01-01T00:00:00.000Z";
  const response = await POST(createRequest(createEligibleBody()));

  expect(response.status).toBe(200);
  expect(mocks.resolveExperimentVisitorIdentity).not.toHaveBeenCalled();
  expect(mocks.recordExperimentEvent).not.toHaveBeenCalled();
});

test("저장소 기록 실패는 재시도 가능한 오류로 응답한다", async () => {
  mocks.recordAnalyticsSafely.mockResolvedValueOnce(false);
  const response = await POST(createRequest(createEligibleBody()));

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({ recorded: false });
});

function createEligibleBody() {
  return {
    eventId: "36b8f84d-df4e-4d49-b662-bcde71a8764f",
    eventKind: "EXPERIMENT_ELIGIBLE",
    experimentKey: "whole-housing-bookmark-v1",
    variant: "ALL_HOMES",
  } as const;
}

function createLocationBody(eventKind: string, locationId: string) {
  return { ...createEligibleBody(), eventKind, locationId };
}

function createRequest(body: object) {
  return new Request("http://localhost/api/analytics/experiment-events", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
