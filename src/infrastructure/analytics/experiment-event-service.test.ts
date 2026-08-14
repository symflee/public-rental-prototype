import { beforeEach, expect, test, vi } from "vitest";

const repository = vi.hoisted(() => ({
  countAllHomesBookmarkAddedEvents: vi.fn(async () => 7),
  initialize: vi.fn(async () => undefined),
  isEnabled: vi.fn(() => true),
  purgeBefore: vi.fn(async () => undefined),
  readFacts: vi.fn(async () => []),
  record: vi.fn(async () => undefined),
}));

vi.mock("./experiment-event-repository", () => ({
  createExperimentEventRepository: () => repository,
}));

import { readAllHomesBookmarkAddedEventCount } from "./experiment-event-service";

beforeEach(() => {
  vi.clearAllMocks();
});

test("선택 기간과 실험 키의 전체 주택 북마크 추가 횟수를 읽는다", async () => {
  const range = { from: "2026-08-01", to: "2026-08-14" };

  const total = await readAllHomesBookmarkAddedEventCount(range, "whole-housing-bookmark-v1");

  expect(total).toBe(7);
  expect(repository.countAllHomesBookmarkAddedEvents).toHaveBeenCalledWith(
    range,
    "whole-housing-bookmark-v1",
  );
});
