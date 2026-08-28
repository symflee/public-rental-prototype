import { describe, expect, test, vi } from "vitest";

import {
  createLocationDetailViewRepositoryWithExecutor,
  type LocationDetailViewSqlExecutor,
} from "./location-detail-view-repository";

describe("location detail view repository", () => {
  test("개별 주택 조회의 위치와 시각을 저장한다", async () => {
    const executor = createExecutor([]);
    const repository = createLocationDetailViewRepositoryWithExecutor(executor);

    await repository.record(createEvent());

    expect(executor.execute).toHaveBeenCalledWith(
      expect.stringContaining("analytics_location_detail_views"),
      expect.arrayContaining(["30855346", "2026-08-11T12:10:00+09:00"]),
    );
  });

  test("데이터셋별 모집·비모집 조회 합계를 읽는다", async () => {
    const executor = createExecutor([{ no_open_total: "52", open_total: "80" }]);
    const repository = createLocationDetailViewRepositoryWithExecutor(executor);

    await expect(
      repository.readSummary("historical-2026-08-11-14-v1", {
        from: "2026-08-11",
        to: "2026-08-14",
      }),
    ).resolves.toEqual({
      noOpenNoticeLocationDetailViewCount: 52,
      openNoticeLocationDetailViewCount: 80,
    });
  });

  test("과거 실행 교체는 같은 이벤트를 갱신하고 남은 행만 원자적으로 지운다", async () => {
    const executor = createExecutor([]);
    const repository = createLocationDetailViewRepositoryWithExecutor(executor);

    await repository.replaceHistoricalRun(createRun(), [createEvent()]);

    const statement = vi.mocked(executor.execute).mock.calls[0]?.[0] ?? "";
    expect(statement).toContain("ON CONFLICT (event_id) DO UPDATE SET");
    expect(statement).toContain("event_id NOT IN (SELECT event_id FROM input_views)");
    expect(executor.execute).toHaveBeenCalledWith(
      statement,
      expect.arrayContaining(["historical-2026-08-11-14-v1"]),
    );
  });

  test("재구성 실행이 동결 완료됐는지 확인한다", async () => {
    const executor = createExecutor([{ frozen: true }]);
    const repository = createLocationDetailViewRepositoryWithExecutor(executor);

    await expect(repository.isFrozenRun("historical-2026-08-11-14-v1")).resolves.toBe(true);

    expect(executor.execute).toHaveBeenCalledWith(expect.stringContaining("status = 'FROZEN'"), [
      "historical-2026-08-11-14-v1",
    ]);
  });
});

function createExecutor(rows: readonly unknown[]): LocationDetailViewSqlExecutor {
  return { execute: vi.fn().mockResolvedValue(rows) };
}

function createRun() {
  return {
    datasetId: "historical-2026-08-11-14-v1",
    label: "2026.08.11~08.14 재구성 데이터",
    periodEndsOn: "2026-08-14",
    periodStartsOn: "2026-08-11",
    referenceTime: "2026-08-14T23:59:59+09:00",
  };
}

function createEvent() {
  return {
    datasetId: "historical-2026-08-11-14-v1",
    eventId: "20260811-0001-4000-8000-000000000001",
    locationId: "30855346",
    matchedNoticeId: "20853",
    metricDate: "2026-08-11",
    noticeState: "OPEN" as const,
    origin: "RETROSPECTIVE_RECONSTRUCTION" as const,
    statusSource: "MANUAL_REVIEW" as const,
    viewedAt: "2026-08-11T12:10:00+09:00",
  };
}
