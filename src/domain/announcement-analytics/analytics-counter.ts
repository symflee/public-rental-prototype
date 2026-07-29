export const ANALYTICS_EVENT_KINDS = [
  "PAGE_VIEW",
  "ANNOUNCEMENT_OPEN",
  "ANNOUNCEMENT_INTEREST",
] as const;

export type AnalyticsEventKind = (typeof ANALYTICS_EVENT_KINDS)[number];

export const ANALYTICS_SUBJECT_KINDS = ["SITE", "ANNOUNCEMENT", "LOCATION"] as const;

export type AnalyticsSubjectKind = (typeof ANALYTICS_SUBJECT_KINDS)[number];

export type AnalyticsCounterKey = Readonly<{
  eventKind: AnalyticsEventKind;
  metricDate: string;
  subjectId: string;
  subjectKind: AnalyticsSubjectKind;
}>;

export type AnalyticsCounter = AnalyticsCounterKey &
  Readonly<{
    total: number;
  }>;

export type AnalyticsDateRange = Readonly<{
  from: string;
  to: string;
}>;

export function createPageViewCounter(metricDate: string): AnalyticsCounterKey {
  return createCounterKey(metricDate, "PAGE_VIEW", "SITE", "all");
}

export function createAnnouncementOpenCounter(
  metricDate: string,
  announcementId: string,
): AnalyticsCounterKey {
  return createCounterKey(metricDate, "ANNOUNCEMENT_OPEN", "ANNOUNCEMENT", announcementId);
}

export function createAnnouncementInterestCounter(
  metricDate: string,
  locationId: string,
): AnalyticsCounterKey {
  return createCounterKey(metricDate, "ANNOUNCEMENT_INTEREST", "LOCATION", locationId);
}

function createCounterKey(
  metricDate: string,
  eventKind: AnalyticsEventKind,
  subjectKind: AnalyticsSubjectKind,
  subjectId: string,
): AnalyticsCounterKey {
  return { eventKind, metricDate, subjectId, subjectKind };
}
