import {
  createAnalyticsDashboard,
  createAnnouncementInterestCounter,
  createAnnouncementOpenCounter,
  createPageViewCounter,
  readKoreanDate,
  subtractDays,
  type AnalyticsDateRange,
} from "@/domain/announcement-analytics";
import { initializeManualRecruitmentStorage } from "@/infrastructure/manual-recruitment";

import { createAnalyticsCounterRepository } from "./analytics-counter-repository";
import { initializeExperimentAnalyticsStorage } from "./experiment-event-service";
import {
  initializeLocationDetailViewStorage,
  readOperationalLocationDetailViewSummary,
} from "./location-detail-view-service";

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

export async function readAnalyticsDashboard(range: AnalyticsDateRange) {
  const counters = await repository.read(range);
  const summary = await readOperationalLocationDetailViewSummary(range);
  return createAnalyticsDashboard(counters, summary);
}

export function purgeExpiredAnalyticsCounters() {
  return repository.purgeBefore(subtractDays(readKoreanDate(), 365));
}

export function initializeAnalyticsStorage() {
  return Promise.all([
    repository.initialize(),
    initializeExperimentAnalyticsStorage(),
    initializeLocationDetailViewStorage(),
    initializeManualRecruitmentStorage(),
  ]);
}

export function isAnalyticsStorageEnabled() {
  return repository.isEnabled();
}
