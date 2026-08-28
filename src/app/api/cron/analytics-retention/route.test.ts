import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const { purgeExpiredAnalyticsCounters, purgeExpiredExperimentEvents } = vi.hoisted(() => ({
  purgeExpiredAnalyticsCounters: vi.fn(async () => undefined),
  purgeExpiredExperimentEvents: vi.fn(async () => undefined),
}));

const { purgeRecruitmentAlertSubscriptions } = vi.hoisted(() => ({
  purgeRecruitmentAlertSubscriptions: vi.fn(async () => undefined),
}));

vi.mock("@/infrastructure/analytics", () => ({
  purgeExpiredAnalyticsCounters,
  purgeExpiredExperimentEvents,
}));

vi.mock("@/infrastructure/recruitment-alert", () => ({
  purgeRecruitmentAlertSubscriptions,
}));

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

test("보관 정리 Cron은 비밀 헤더가 있을 때만 실행한다", async () => {
  process.env.CRON_SECRET = "cron-secret";
  const response = await GET(
    new Request("http://localhost/api/cron/analytics-retention", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );

  expect(response.status).toBe(200);
  expect(purgeExpiredAnalyticsCounters).toHaveBeenCalledOnce();
  expect(purgeExpiredExperimentEvents).toHaveBeenCalledOnce();
  expect(purgeRecruitmentAlertSubscriptions).toHaveBeenCalledOnce();
});

test("보관 정리 Cron은 올바르지 않은 요청을 거절한다", async () => {
  process.env.CRON_SECRET = "cron-secret";
  const response = await GET(new Request("http://localhost/api/cron/analytics-retention"));

  expect(response.status).toBe(401);
  expect(purgeExpiredAnalyticsCounters).not.toHaveBeenCalled();
  expect(purgeExpiredExperimentEvents).not.toHaveBeenCalled();
  expect(purgeRecruitmentAlertSubscriptions).not.toHaveBeenCalled();
});
