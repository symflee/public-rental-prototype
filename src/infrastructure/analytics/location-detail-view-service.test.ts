import { beforeEach, expect, test, vi } from "vitest";

const repository = vi.hoisted(() => ({
  clearHistoricalRun: vi.fn(async () => undefined),
  initialize: vi.fn(async () => undefined),
  isEnabled: vi.fn(() => true),
  isFrozenRun: vi.fn(async () => true),
  readBreakdown: vi.fn(async () => []),
  readSummary: vi.fn(async () => ({
    noOpenNoticeLocationDetailViewCount: 0,
    openNoticeLocationDetailViewCount: 0,
  })),
  record: vi.fn(async () => undefined),
  replaceHistoricalRun: vi.fn(async () => undefined),
}));

vi.mock("./location-detail-view-repository", () => ({
  createLocationDetailViewRepository: () => repository,
}));

import {
  recordLocationDetailView,
  seedHistoricalLocationDetailViews,
} from "./location-detail-view-service";

beforeEach(() => vi.clearAllMocks());

test("실시간 상세 조회에 위치·시각·표시된 모집 상태를 저장한다", async () => {
  const now = new Date("2026-08-28T03:10:00.000Z");

  await recordLocationDetailView("30855346", { openNotices: [], status: "NO_OPEN" }, now);

  expect(repository.record).toHaveBeenCalledWith(
    expect.objectContaining({
      datasetId: "live",
      locationId: "30855346",
      metricDate: "2026-08-28",
      noticeState: "NO_OPEN",
      statusSource: "SNAPSHOT_ABSENCE",
      viewedAt: now.toISOString(),
    }),
  );
});

test("수기 연결 모집공고 식별자와 출처를 조회 시점에 고정한다", async () => {
  const notice = {
    announcedAt: "2026-07-20",
    applicationEndsAt: "2026-08-14",
    applicationStartsAt: "2026-07-27",
    id: "20853",
    sourceKind: "MANUAL_REVIEW" as const,
    title: "하남 모집공고",
    url: "https://apply.lh.or.kr/notice",
  };

  await recordLocationDetailView(
    "30855346",
    { openNotices: [notice], status: "OPEN" },
    new Date("2026-08-11T03:00:00.000Z"),
  );

  expect(repository.record).toHaveBeenCalledWith(
    expect.objectContaining({
      matchedNoticeId: "20853",
      noticeState: "OPEN",
      statusSource: "MANUAL_REVIEW",
    }),
  );
});

test("재구성 시드 후 DB 합계 80건과 52건을 다시 확인한다", async () => {
  repository.readSummary.mockResolvedValueOnce({
    noOpenNoticeLocationDetailViewCount: 52,
    openNoticeLocationDetailViewCount: 80,
  });

  await seedHistoricalLocationDetailViews();

  expect(repository.replaceHistoricalRun).toHaveBeenCalledOnce();
  expect(repository.readSummary).toHaveBeenCalledWith("historical-2026-08-11-14-v1", {
    from: "2026-08-11",
    to: "2026-08-14",
  });
});
