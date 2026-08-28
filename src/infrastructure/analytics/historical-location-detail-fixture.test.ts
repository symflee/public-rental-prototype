import { describe, expect, test } from "vitest";

import { readRecruitmentStateAt } from "@/domain/public-rental";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

import {
  createHistoricalLocationDetailEvents,
  HISTORICAL_RECRUITMENT_NOTICE_FIXTURES,
} from "./historical-location-detail-fixture";

describe("historical location detail fixture", () => {
  test("8월 11일부터 14일까지 132건을 모집 80건과 비모집 52건으로 구성한다", () => {
    const events = createHistoricalLocationDetailEvents();

    expect(events).toHaveLength(132);
    expect(events.filter((event) => event.noticeState === "OPEN")).toHaveLength(80);
    expect(events.filter((event) => event.noticeState === "NO_OPEN")).toHaveLength(52);
    expect(new Set(events.map((event) => event.metricDate))).toEqual(
      new Set(["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"]),
    );
  });

  test("모집 중 조회는 해당 공식 공고 기간 안에 있다", () => {
    const openEvents = createHistoricalLocationDetailEvents().filter(isOpenEvent);

    openEvents.forEach(assertOpenEventMatchesPeriod);
  });

  test("모든 이벤트는 실제 스냅샷 주택을 참조하고 식별자와 시각이 고정된다", () => {
    const first = createHistoricalLocationDetailEvents();
    const second = createHistoricalLocationDetailEvents();
    const locationIds = new Set(publicRentalSnapshot.locations.map((location) => location.id));

    expect(second).toEqual(first);
    expect(new Set(first.map((event) => event.eventId)).size).toBe(132);
    expect(new Set(first.map((event) => event.viewedAt)).size).toBe(132);
    expect(first.every((event) => locationIds.has(event.locationId))).toBe(true);
  });

  test("공고 연결 12곳과 비모집 비교군 15곳이 조회 분포에 모두 포함된다", () => {
    const events = createHistoricalLocationDetailEvents();
    const openLocationIds = readLocationIds(events, "OPEN");
    const noOpenLocationIds = readLocationIds(events, "NO_OPEN");

    expect(openLocationIds).toHaveLength(12);
    expect(noOpenLocationIds).toHaveLength(15);
  });

  test("조회 시각은 심야를 피하고 날짜별로 다른 분 단위에 분산된다", () => {
    const events = createHistoricalLocationDetailEvents();
    const hours = events.map((event) => Number(event.viewedAt.slice(11, 13)));
    const minuteOffsetsByDate = readMinuteOffsetsByDate(events);

    expect(Math.min(...hours)).toBeGreaterThanOrEqual(6);
    expect(new Set(minuteOffsetsByDate).size).toBe(4);
  });
});

function readMinuteOffsetsByDate(events: ReturnType<typeof createHistoricalLocationDetailEvents>) {
  const firstByDate = new Map<string, string>();
  events.forEach((event) => addFirstMinuteOffset(firstByDate, event));
  return [...firstByDate.values()];
}

function addFirstMinuteOffset(
  firstByDate: Map<string, string>,
  event: ReturnType<typeof createHistoricalLocationDetailEvents>[number],
) {
  if (firstByDate.has(event.metricDate)) return;
  firstByDate.set(event.metricDate, event.viewedAt.slice(14, 16));
}

function readLocationIds(
  events: ReturnType<typeof createHistoricalLocationDetailEvents>,
  noticeState: "NO_OPEN" | "OPEN",
) {
  const locationIds = events
    .filter((event) => event.noticeState === noticeState)
    .map((event) => event.locationId);
  return [...new Set(locationIds)];
}

function isOpenEvent(event: ReturnType<typeof createHistoricalLocationDetailEvents>[number]) {
  return event.noticeState === "OPEN";
}

function assertOpenEventMatchesPeriod(
  event: ReturnType<typeof createHistoricalLocationDetailEvents>[number],
) {
  const fixture = HISTORICAL_RECRUITMENT_NOTICE_FIXTURES.find(
    (value) => value.notice.id === event.matchedNoticeId,
  );
  if (!fixture) throw new Error(`공고 ${event.matchedNoticeId ?? "없음"}을 찾을 수 없습니다.`);
  expect(fixture.locationIds).toContain(event.locationId);
  const state = readRecruitmentStateAt({ recruitmentNotices: [fixture.notice] }, event.viewedAt);
  expect(state.status).toBe("OPEN");
}
