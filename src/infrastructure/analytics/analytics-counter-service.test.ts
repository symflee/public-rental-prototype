import { beforeEach, expect, test, vi } from "vitest";

const repository = vi.hoisted(() => ({
  increment: vi.fn(async () => undefined),
  initialize: vi.fn(async () => undefined),
  isEnabled: vi.fn(() => true),
  purgeBefore: vi.fn(async () => undefined),
  read: vi.fn(async () => []),
}));

vi.mock("./analytics-counter-repository", () => ({
  createAnalyticsCounterRepository: () => repository,
}));
vi.mock("./experiment-event-service", () => ({
  initializeExperimentAnalyticsStorage: vi.fn(async () => undefined),
}));

import { recordLocationDetailView } from "./analytics-counter-service";

beforeEach(() => vi.clearAllMocks());

test("모집공고가 있는 단지 상세 조회를 사이트 전체 카운터로 기록한다", async () => {
  await recordLocationDetailView("location-one", true);

  expect(repository.increment).toHaveBeenCalledWith(
    expect.objectContaining({
      eventKind: "OPEN_NOTICE_LOCATION_DETAIL_VIEW",
      subjectId: "all",
      subjectKind: "SITE",
    }),
  );
});

test("모집공고가 없는 단지 상세 조회를 사이트 전체 카운터로 기록한다", async () => {
  await recordLocationDetailView("location-one", false);

  expect(repository.increment).toHaveBeenCalledWith(
    expect.objectContaining({
      eventKind: "NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW",
      subjectId: "all",
      subjectKind: "SITE",
    }),
  );
});

test("빈 단지 식별자는 상세 조회로 기록하지 않는다", async () => {
  await expect(recordLocationDetailView(" ", false)).rejects.toThrow("단지 식별자");
  expect(repository.increment).not.toHaveBeenCalled();
});
