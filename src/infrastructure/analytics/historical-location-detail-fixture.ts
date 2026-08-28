import {
  HISTORICAL_LOCATION_DETAIL_DATASET_ID,
  type LocationDetailNoticeState,
  type LocationDetailViewEvent,
} from "@/domain/announcement-analytics";
import { readRecruitmentStateAt, type PublicRentalRecruitmentNotice } from "@/domain/public-rental";
import { HISTORICAL_MANUAL_RECRUITMENT_NOTICES } from "@/infrastructure/manual-recruitment";

import type { HistoricalAnalyticsRun } from "./location-detail-view-repository";

type HistoricalNoticeFixture = Readonly<{
  locationIds: readonly string[];
  notice: PublicRentalRecruitmentNotice;
}>;

type HistoricalDay = Readonly<{
  date: string;
  noOpenCount: number;
  openCount: number;
}>;

type HistoricalOpenLocation = Readonly<{
  locationId: string;
  noticeId: string;
}>;

type HistoricalStateOrdinals = {
  noOpen: number;
  open: number;
};

const HISTORICAL_DAYS: readonly HistoricalDay[] = [
  { date: "2026-08-11", noOpenCount: 10, openCount: 22 },
  { date: "2026-08-12", noOpenCount: 12, openCount: 24 },
  { date: "2026-08-13", noOpenCount: 14, openCount: 21 },
  { date: "2026-08-14", noOpenCount: 16, openCount: 13 },
];

const TIME_SLOTS = [
  "06:48",
  "07:19",
  "07:56",
  "08:21",
  "08:49",
  "09:07",
  "09:36",
  "10:04",
  "10:37",
  "11:08",
  "11:44",
  "12:03",
  "12:12",
  "12:24",
  "12:34",
  "12:45",
  "12:56",
  "13:07",
  "13:19",
  "13:33",
  "13:48",
  "14:11",
  "14:39",
  "15:06",
  "15:43",
  "16:17",
  "16:52",
  "17:24",
  "17:56",
  "18:14",
  "18:27",
  "18:41",
  "18:58",
  "19:08",
  "19:22",
  "19:37",
  "19:53",
  "20:06",
  "20:19",
  "20:31",
  "20:44",
  "20:57",
  "21:13",
  "21:31",
  "21:52",
  "22:11",
  "22:31",
  "23:02",
  "23:17",
] as const;

const DAY_MINUTE_OFFSETS = [0, 4, 9, 13] as const;

const NO_OPEN_LOCATION_IDS = [
  "30699503",
  "30699506",
  "30699590",
  "30699591",
  "30699884",
  "30699886",
  "30699888",
  "30699891",
  "30699892",
  "30699893",
  "30700006",
  "30700007",
  "30700008",
  "30700009",
  "30700299",
] as const;

export const HISTORICAL_RECRUITMENT_NOTICE_FIXTURES = HISTORICAL_MANUAL_RECRUITMENT_NOTICES.map(
  createHistoricalNoticeFixture,
);

function createHistoricalNoticeFixture(
  value: (typeof HISTORICAL_MANUAL_RECRUITMENT_NOTICES)[number],
): HistoricalNoticeFixture {
  const { locationIds, ...notice } = value;
  return { locationIds, notice };
}

export const HISTORICAL_ANALYTICS_RUN: HistoricalAnalyticsRun = {
  datasetId: HISTORICAL_LOCATION_DETAIL_DATASET_ID,
  label: "2026.08.11~08.14 재구성 데이터",
  periodEndsOn: "2026-08-14",
  periodStartsOn: "2026-08-11",
  referenceTime: "2026-08-14T23:59:59+09:00",
};

export function createHistoricalLocationDetailEvents(): readonly LocationDetailViewEvent[] {
  return HISTORICAL_DAYS.flatMap(createDayEvents);
}

function createDayEvents(day: HistoricalDay, dayIndex: number) {
  const total = day.openCount + day.noOpenCount;
  const viewedTimes = createViewedTimes(day.date, dayIndex, total);
  const states = createDayStates(day.openCount, total);
  const ordinals = createStateOrdinals(dayIndex);
  return states.map((state, index) =>
    createHistoricalEvent(
      dayIndex,
      index,
      state,
      takeStateOrdinal(ordinals, state),
      readArrayValue(viewedTimes, index),
    ),
  );
}

function createStateOrdinals(dayIndex: number): HistoricalStateOrdinals {
  return {
    noOpen: readPreviousNoOpenCount(dayIndex),
    open: readPreviousOpenCount(dayIndex),
  };
}

function readPreviousOpenCount(dayIndex: number) {
  return HISTORICAL_DAYS.slice(0, dayIndex).reduce((sum, day) => sum + day.openCount, 0);
}

function readPreviousNoOpenCount(dayIndex: number) {
  return HISTORICAL_DAYS.slice(0, dayIndex).reduce((sum, day) => sum + day.noOpenCount, 0);
}

function takeStateOrdinal(ordinals: HistoricalStateOrdinals, state: LocationDetailNoticeState) {
  if (state === "OPEN") return takeOpenOrdinal(ordinals);
  return takeNoOpenOrdinal(ordinals);
}

function takeOpenOrdinal(ordinals: HistoricalStateOrdinals) {
  const value = ordinals.open;
  ordinals.open += 1;
  return value;
}

function takeNoOpenOrdinal(ordinals: HistoricalStateOrdinals) {
  const value = ordinals.noOpen;
  ordinals.noOpen += 1;
  return value;
}

function createViewedTimes(date: string, dayIndex: number, count: number) {
  return TIME_SLOTS.map((time, index) => ({ score: createSlotScore(index, dayIndex), time }))
    .sort(compareSlotScores)
    .slice(0, count)
    .map((value) => `${date}T${shiftTime(value.time, dayIndex)}:00+09:00`)
    .sort();
}

function shiftTime(value: string, dayIndex: number) {
  const [hourText, minuteText] = value.split(":");
  const offset = readArrayValue(DAY_MINUTE_OFFSETS, dayIndex);
  const minutes = Number(hourText) * 60 + Number(minuteText) + offset;
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function createSlotScore(index: number, dayIndex: number) {
  return (index * 17 + dayIndex * 11) % 53;
}

function compareSlotScores(
  first: Readonly<{ score: number }>,
  second: Readonly<{ score: number }>,
) {
  return first.score - second.score;
}

function createDayStates(openCount: number, total: number) {
  return Array.from({ length: total }, (_, index) => readSlotState(index, openCount, total));
}

function readSlotState(index: number, openCount: number, total: number): LocationDetailNoticeState {
  const currentOpenCount = Math.floor(((index + 1) * openCount) / total);
  const previousOpenCount = Math.floor((index * openCount) / total);
  if (currentOpenCount > previousOpenCount) return "OPEN";
  return "NO_OPEN";
}

function createHistoricalEvent(
  dayIndex: number,
  index: number,
  noticeState: LocationDetailNoticeState,
  stateOrdinal: number,
  viewedAt: string,
): LocationDetailViewEvent {
  if (noticeState === "OPEN") return createOpenEvent(dayIndex, index, stateOrdinal, viewedAt);
  return createNoOpenEvent(dayIndex, index, stateOrdinal, viewedAt);
}

function createOpenEvent(
  dayIndex: number,
  index: number,
  stateOrdinal: number,
  viewedAt: string,
): LocationDetailViewEvent {
  const match = readOpenLocation(viewedAt, stateOrdinal);
  return createEvent(dayIndex, index, viewedAt, match.locationId, "OPEN", match.noticeId);
}

function readOpenLocation(viewedAt: string, stateOrdinal: number) {
  const matches = HISTORICAL_RECRUITMENT_NOTICE_FIXTURES.filter((fixture) =>
    isFixtureOpenAt(fixture, viewedAt),
  ).flatMap(createOpenLocations);
  const match = matches[stateOrdinal % matches.length];
  if (match) return match;
  throw new Error(`모집 중 공고가 없는 시각입니다: ${viewedAt}`);
}

function createOpenLocations(fixture: HistoricalNoticeFixture): readonly HistoricalOpenLocation[] {
  return fixture.locationIds.map((locationId) => ({ locationId, noticeId: fixture.notice.id }));
}

function isFixtureOpenAt(fixture: HistoricalNoticeFixture, viewedAt: string) {
  return (
    readRecruitmentStateAt({ recruitmentNotices: [fixture.notice] }, viewedAt).status === "OPEN"
  );
}

function createNoOpenEvent(
  dayIndex: number,
  index: number,
  stateOrdinal: number,
  viewedAt: string,
) {
  const locationIndex = stateOrdinal % NO_OPEN_LOCATION_IDS.length;
  const locationId = readArrayValue(NO_OPEN_LOCATION_IDS, locationIndex);
  return createEvent(dayIndex, index, viewedAt, locationId, "NO_OPEN", null);
}

function readArrayValue<Value>(values: readonly Value[], index: number): Value {
  const value = values[index];
  if (value !== undefined) return value;
  throw new Error(`재구성 데이터 배열의 ${index}번째 값을 찾을 수 없습니다.`);
}

function createEvent(
  dayIndex: number,
  index: number,
  viewedAt: string,
  locationId: string,
  noticeState: "NO_OPEN" | "OPEN",
  matchedNoticeId: string | null,
): LocationDetailViewEvent {
  return {
    datasetId: HISTORICAL_LOCATION_DETAIL_DATASET_ID,
    eventId: createEventId(dayIndex, index),
    locationId,
    matchedNoticeId,
    metricDate: viewedAt.slice(0, 10),
    noticeState,
    origin: "RETROSPECTIVE_RECONSTRUCTION",
    statusSource: readStatusSource(noticeState),
    viewedAt,
  };
}

function readStatusSource(noticeState: "NO_OPEN" | "OPEN") {
  if (noticeState === "OPEN") return "MANUAL_REVIEW" as const;
  return "SNAPSHOT_ABSENCE" as const;
}

function createEventId(dayIndex: number, index: number) {
  const sequence = String(dayIndex * 100 + index + 1).padStart(12, "0");
  return `20260811-${String(dayIndex + 1).padStart(4, "0")}-4000-8000-${sequence}`;
}
