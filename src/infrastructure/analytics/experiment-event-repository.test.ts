import { expect, test } from "vitest";

import type { ExperimentEvent } from "@/domain/announcement-analytics";

import {
  createExperimentEventRepository,
  createExperimentEventRepositoryWithExecutor,
  type ExperimentSqlExecutor,
} from "./experiment-event-repository";

type RecordedCall = [string, readonly (number | string)[]];

test("원문 방문자 ID 없이 이벤트와 고유 fact를 한 문장에서 기록한다", async () => {
  const calls: RecordedCall[] = [];
  const repository = createExperimentEventRepositoryWithExecutor(createExecutor(calls));

  await repository.record(createEvent());

  expect(calls).toHaveLength(1);
  expect(calls[0]?.[0]).toContain("WITH inserted_event AS");
  expect(calls[0]?.[0]).toContain("ON CONFLICT DO NOTHING");
  expect(calls[0]?.[1]).toEqual([
    "36b8f84d-df4e-4d49-b662-bcde71a8764f",
    "2026-08-14",
    "whole-housing-bookmark-v1",
    "ALL_HOMES",
    "hashed-visitor",
    "BOOKMARK_ADDED",
    "LOCATION",
    "location-1",
  ]);
  expect(JSON.stringify(calls)).not.toContain("raw-visitor");
});

test("실험 fact를 기간과 실험 키로 읽는다", async () => {
  const repository = createExperimentEventRepositoryWithExecutor(createFactExecutor());

  const facts = await repository.readFacts(
    { from: "2026-08-01", to: "2026-08-14" },
    "whole-housing-bookmark-v1",
  );

  expect(facts).toEqual([
    {
      eventKind: "BOOKMARK_ADDED",
      experimentKey: "whole-housing-bookmark-v1",
      metricDate: "2026-08-14",
      subjectId: "location-1",
      subjectKind: "LOCATION",
      variant: "ALL_HOMES",
      visitorHash: "hashed-visitor",
    },
  ]);
});

test("전체 주택 실험군의 북마크 추가 원시 이벤트를 반복 포함해 센다", async () => {
  const calls: RecordedCall[] = [];
  const repository = createExperimentEventRepositoryWithExecutor(
    createBookmarkCountExecutor(calls),
  );

  const total = await repository.countAllHomesBookmarkAddedEvents(
    { from: "2026-08-01", to: "2026-08-14" },
    "whole-housing-bookmark-v1",
  );

  expect(total).toBe(3);
  expectBookmarkCountQuery(calls);
});

test("실험 이벤트와 fact를 90일 보관 경계 이전에서 함께 정리한다", async () => {
  const calls: RecordedCall[] = [];
  const repository = createExperimentEventRepositoryWithExecutor(createExecutor(calls));

  await repository.purgeBefore("2026-05-16");

  expect(calls).toHaveLength(2);
  expect(calls.every((call) => call[1]?.[0] === "2026-05-16")).toBe(true);
});

test("DB가 없으면 실험 계측만 비활성화한다", async () => {
  const repository = createExperimentEventRepository("");

  await expect(repository.record(createEvent())).resolves.toBeUndefined();
  await expect(
    repository.countAllHomesBookmarkAddedEvents(
      { from: "2026-08-01", to: "2026-08-14" },
      "whole-housing-bookmark-v1",
    ),
  ).resolves.toBe(0);
  expect(repository.isEnabled()).toBe(false);
});

function createEvent(): ExperimentEvent {
  return {
    eventId: "36b8f84d-df4e-4d49-b662-bcde71a8764f",
    eventKind: "BOOKMARK_ADDED",
    experimentKey: "whole-housing-bookmark-v1",
    metricDate: "2026-08-14",
    subjectId: "location-1",
    subjectKind: "LOCATION",
    variant: "ALL_HOMES",
    visitorHash: "hashed-visitor",
  };
}

function createExecutor(calls: RecordedCall[]): ExperimentSqlExecutor {
  return {
    execute: async (statement, parameters) => {
      calls.push([statement, parameters]);
      return [];
    },
  };
}

function createFactExecutor(): ExperimentSqlExecutor {
  return {
    execute: async () => [
      {
        event_kind: "BOOKMARK_ADDED",
        experiment_key: "whole-housing-bookmark-v1",
        metric_date: new Date(2026, 7, 14),
        subject_id: "location-1",
        subject_kind: "LOCATION",
        variant: "ALL_HOMES",
        visitor_hash: "hashed-visitor",
      },
    ],
  };
}

function createBookmarkCountExecutor(calls: RecordedCall[]): ExperimentSqlExecutor {
  return {
    execute: async (statement, parameters) => {
      calls.push([statement, parameters]);
      return [{ total: "3" }];
    },
  };
}

function expectBookmarkCountQuery(calls: RecordedCall[]) {
  const call = calls[0];
  expect(call?.[0]).toContain("COUNT(*)");
  expect(call?.[0]).toContain("FROM analytics_experiment_events");
  expect(call?.[0]).not.toContain("DISTINCT");
  expect(call?.[1]).toEqual([
    "2026-08-01",
    "2026-08-14",
    "whole-housing-bookmark-v1",
    "ALL_HOMES",
    "BOOKMARK_ADDED",
  ]);
}
