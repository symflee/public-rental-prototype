import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  generatedAt: new Date().toISOString(),
  isAnalyticsStorageEnabled: vi.fn(() => true),
  recordAnalyticsSafely: vi.fn(),
  recordLocationDetailView: vi.fn(async () => undefined),
}));

vi.mock("@/infrastructure/analytics", () => ({
  isAnalyticsStorageEnabled: mocks.isAnalyticsStorageEnabled,
  recordAnalyticsSafely: mocks.recordAnalyticsSafely,
  recordLocationDetailView: mocks.recordLocationDetailView,
}));

vi.mock("@/infrastructure/public-data/public-rental-snapshot", () => ({
  publicRentalSnapshot: {
    get generatedAt() {
      return mocks.generatedAt;
    },
    locations: [
      { id: "without-notice", recruitmentNotices: [] },
      { id: "with-notice", recruitmentNotices: [{ id: "notice-one" }] },
    ],
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generatedAt = new Date().toISOString();
  mocks.isAnalyticsStorageEnabled.mockReturnValue(true);
  mocks.recordAnalyticsSafely.mockImplementation(runRecordSuccessfully);
});

test("최신 스냅샷의 상세 조회와 모집공고 상태를 기록한다", async () => {
  const withoutNotice = await POST(createRequest("without-notice"));
  const withNotice = await POST(createRequest("with-notice"));

  expect(await withoutNotice.json()).toEqual({ recorded: true });
  expect(await withNotice.json()).toEqual({ recorded: true });
  expect(mocks.recordLocationDetailView).toHaveBeenNthCalledWith(1, "without-notice", false);
  expect(mocks.recordLocationDetailView).toHaveBeenNthCalledWith(2, "with-notice", true);
});

test("잘못되거나 존재하지 않는 단지 식별자를 거절한다", async () => {
  const invalid = await POST(createBodyRequest({ locationId: " " }));
  const unknown = await POST(createRequest("unknown"));

  expect(invalid.status).toBe(400);
  expect(unknown.status).toBe(404);
  expect(mocks.recordLocationDetailView).not.toHaveBeenCalled();
});

test("오래된 스냅샷은 성공 응답하되 상세 조회를 기록하지 않는다", async () => {
  mocks.generatedAt = "2026-01-01T00:00:00.000Z";
  const response = await POST(createRequest("without-notice"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ recorded: false });
  expect(mocks.recordAnalyticsSafely).not.toHaveBeenCalled();
});

test("DB 기록 실패는 재시도 가능한 응답으로 알린다", async () => {
  mocks.recordAnalyticsSafely.mockImplementation(runRecordUnsuccessfully);
  const response = await POST(createRequest("without-notice"));

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ recorded: false });
  expect(mocks.recordLocationDetailView).toHaveBeenCalledWith("without-notice", false);
});

test("DB가 설정되지 않아도 기록 성공으로 응답하지 않는다", async () => {
  mocks.isAnalyticsStorageEnabled.mockReturnValue(false);
  const response = await POST(createRequest("without-notice"));

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ recorded: false });
  expect(mocks.recordAnalyticsSafely).not.toHaveBeenCalled();
});

async function runRecordSuccessfully(record: () => Promise<void>) {
  await record();
  return true;
}

async function runRecordUnsuccessfully(record: () => Promise<void>) {
  await record();
  return false;
}

function createRequest(locationId: string) {
  return createBodyRequest({ locationId });
}

function createBodyRequest(body: object) {
  return new Request("http://localhost/api/analytics/location-detail-view", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
