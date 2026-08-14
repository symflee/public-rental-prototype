import {
  createAnalyticsDashboard,
  createAnnouncementInterestCounter,
  createAnnouncementOpenCounter,
  createNoOpenNoticeLocationDetailViewCounter,
  createOpenNoticeLocationDetailViewCounter,
  createPageViewCounter,
  readKoreanDate,
  subtractDays,
  type AnalyticsDateRange,
} from "@/domain/announcement-analytics";

import { createAnalyticsCounterRepository } from "./analytics-counter-repository";
import { initializeExperimentAnalyticsStorage } from "./experiment-event-service";

const repository = createAnalyticsCounterRepository();

export function recordPageView() {
  return repository.increment(createPageViewCounter(readKoreanDate()));
}

export function recordAnnouncementOpen(announcementId: string) {
  return repository.increment(createAnnouncementOpenCounter(readKoreanDate(), announcementId));
}

export function recordAnnouncementInterest(locationId: string) {
  return repository.increment(createAnnouncementInterestCounter(readKoreanDate(), locationId));
}

export async function recordLocationDetailView(locationId: string, hasOpenNotice: boolean) {
  assertLocationIdentifier(locationId);
  await repository.increment(createLocationDetailViewCounter(hasOpenNotice));
}

export async function readAnalyticsDashboard(range: AnalyticsDateRange) {
  const counters = await repository.read(range);
  return createAnalyticsDashboard(counters);
}

export function purgeExpiredAnalyticsCounters() {
  return repository.purgeBefore(subtractDays(readKoreanDate(), 365));
}

export function initializeAnalyticsStorage() {
  return Promise.all([repository.initialize(), initializeExperimentAnalyticsStorage()]);
}

export function isAnalyticsStorageEnabled() {
  return repository.isEnabled();
}

function createLocationDetailViewCounter(hasOpenNotice: boolean) {
  const metricDate = readKoreanDate();
  if (hasOpenNotice) return createOpenNoticeLocationDetailViewCounter(metricDate);
  return createNoOpenNoticeLocationDetailViewCounter(metricDate);
}

function assertLocationIdentifier(locationId: string) {
  if (locationId.trim().length > 0) return;
  throw new Error("단지 식별자가 필요합니다.");
}
