import { expect, test, vi } from "vitest";

import { POST } from "./route";

vi.mock("@/infrastructure/analytics", () => ({
  recordAnalyticsQuietly: vi.fn(async (record: () => Promise<void>) => record()),
  recordPageView: vi.fn(async () => undefined),
}));

test("지도 조회 카운터 응답은 쿠키를 발급하지 않는다", async () => {
  const response = await POST();

  expect(response.status).toBe(204);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
});
