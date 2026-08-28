import { randomUUID } from "node:crypto";

import {
  HISTORICAL_LOCATION_DETAIL_DATASET_ID,
  LIVE_LOCATION_DETAIL_DATASET_ID,
  readKoreanDate,
  type AnalyticsDateRange,
  type LocationDetailStatusSource,
} from "@/domain/announcement-analytics";
import type { PublicRentalRecruitmentState } from "@/domain/public-rental";

import {
  createHistoricalLocationDetailEvents,
  HISTORICAL_ANALYTICS_RUN,
} from "./historical-location-detail-fixture";
import { createLocationDetailViewRepository } from "./location-detail-view-repository";

const repository = createLocationDetailViewRepository();

export function recordLocationDetailView(
  locationId: string,
  recruitmentState: PublicRentalRecruitmentState,
  now = new Date(),
  statusSource = readStatusSource(recruitmentState),
) {
  const notice = recruitmentState.openNotices.at(0);
  return repository.record({
    datasetId: LIVE_LOCATION_DETAIL_DATASET_ID,
    eventId: randomUUID(),
    locationId,
    matchedNoticeId: notice?.id ?? null,
    metricDate: readKoreanDate(now),
    noticeState: recruitmentState.status,
    origin: "LIVE",
    statusSource,
    viewedAt: now.toISOString(),
  });
}

export function readLocationDetailViewSummary(datasetId: string, range: AnalyticsDateRange) {
  return repository.readSummary(datasetId, range);
}

export function readLocationDetailViewBreakdown(datasetId: string, range: AnalyticsDateRange) {
  return repository.readBreakdown(datasetId, range);
}

export function initializeLocationDetailViewStorage() {
  return repository.initialize();
}

export async function seedHistoricalLocationDetailViews() {
  const events = createHistoricalLocationDetailEvents();
  await repository.replaceHistoricalRun(HISTORICAL_ANALYTICS_RUN, events);
  const summary = await repository.readSummary(HISTORICAL_LOCATION_DETAIL_DATASET_ID, {
    from: HISTORICAL_ANALYTICS_RUN.periodStartsOn,
    to: HISTORICAL_ANALYTICS_RUN.periodEndsOn,
  });
  assertHistoricalSummary(summary);
}

export function clearHistoricalLocationDetailViews() {
  return repository.clearHistoricalRun(HISTORICAL_LOCATION_DETAIL_DATASET_ID);
}

export function isLocationDetailViewStorageEnabled() {
  return repository.isEnabled();
}

export function isHistoricalLocationDetailRunReady() {
  return repository.isFrozenRun(HISTORICAL_LOCATION_DETAIL_DATASET_ID);
}

function readStatusSource(state: PublicRentalRecruitmentState): LocationDetailStatusSource {
  const notice = state.openNotices.at(0);
  if (notice?.sourceKind) return notice.sourceKind;
  if (state.status === "NO_OPEN") return "SNAPSHOT_ABSENCE";
  return "UNKNOWN";
}

function assertHistoricalSummary(summary: {
  noOpenNoticeLocationDetailViewCount: number;
  openNoticeLocationDetailViewCount: number;
}) {
  if (summary.openNoticeLocationDetailViewCount !== 80)
    throw new Error("모집 중 조회 수가 다릅니다.");
  if (summary.noOpenNoticeLocationDetailViewCount === 52) return;
  throw new Error("비모집 조회 수가 다릅니다.");
}
