import { afterEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const { recordAnnouncementInterest } = vi.hoisted(() => ({
  recordAnnouncementInterest: vi.fn(async () => undefined),
}));

vi.mock("@/infrastructure/analytics", () => ({
  recordAnalyticsQuietly: vi.fn(async (record: () => Promise<void>) => record()),
  recordAnnouncementInterest,
}));

vi.mock("@/infrastructure/public-data/public-rental-snapshot", () => ({
  publicRentalSnapshot: {
    locations: [
      { id: "unlinked", recruitmentNotices: [] },
      { id: "linked", recruitmentNotices: [{ id: "20913" }] },
    ],
  },
}));

test("미연결 단지의 공고 확인 의향만 기록한다", async () => {
  const response = await POST(createRequest({ locationId: "unlinked" }));

  expect(response.status).toBe(200);
  expect(recordAnnouncementInterest).toHaveBeenCalledWith("unlinked");
  expect(response.headers.get("set-cookie")).toBeNull();
});

afterEach(() => vi.clearAllMocks());

test("공고가 있거나 식별자가 잘못된 단지는 기록하지 않는다", async () => {
  const linked = await POST(createRequest({ locationId: "linked" }));
  const invalid = await POST(createRequest({}));

  expect(linked.status).toBe(404);
  expect(invalid.status).toBe(400);
  expect(recordAnnouncementInterest).not.toHaveBeenCalled();
});

function createRequest(body: object) {
  return new Request("http://localhost/api/analytics/announcement-interest", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
