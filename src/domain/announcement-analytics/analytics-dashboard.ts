import type { AnalyticsCounter, AnalyticsEventKind } from "./analytics-counter";
import type { LocationDetailViewSummary } from "./location-detail-view";

export type AnalyticsRank = Readonly<{
  subjectId: string;
  total: number;
}>;

export type AnalyticsDashboard = Readonly<{
  announcementInterestCount: number;
  announcementOpenCount: number;
  announcementRanks: readonly AnalyticsRank[];
  announcementActionCount: number;
  announcementActionRate: number;
  locationDetailViewCount: number;
  locationRanks: readonly AnalyticsRank[];
  noOpenNoticeLocationDetailViewCount: number;
  noOpenNoticeLocationDetailViewRate: number;
  pageViewCount: number;
}>;

type DashboardCounts = Readonly<{
  announcementInterestCount: number;
  announcementOpenCount: number;
  noOpenNoticeLocationDetailViewCount: number;
  openNoticeLocationDetailViewCount: number;
  pageViewCount: number;
}>;

export function createAnalyticsDashboard(
  counters: readonly AnalyticsCounter[],
  locationDetailSummary?: LocationDetailViewSummary,
): AnalyticsDashboard {
  return createDashboard(createDashboardCounts(counters, locationDetailSummary), counters);
}

function createDashboard(
  counts: DashboardCounts,
  counters: readonly AnalyticsCounter[],
): AnalyticsDashboard {
  return {
    ...createAnnouncementSummary(counts),
    ...createLocationDetailSummary(counts),
    announcementInterestCount: counts.announcementInterestCount,
    announcementOpenCount: counts.announcementOpenCount,
    announcementRanks: createRanks(counters, "ANNOUNCEMENT_OPEN"),
    locationRanks: createRanks(counters, "ANNOUNCEMENT_INTEREST"),
    pageViewCount: counts.pageViewCount,
  };
}

function createDashboardCounts(
  counters: readonly AnalyticsCounter[],
  locationDetailSummary: LocationDetailViewSummary | undefined,
): DashboardCounts {
  const detailCounts = readLocationDetailCounts(counters, locationDetailSummary);
  return {
    announcementInterestCount: sumEventCounters(counters, "ANNOUNCEMENT_INTEREST"),
    announcementOpenCount: sumEventCounters(counters, "ANNOUNCEMENT_OPEN"),
    ...detailCounts,
    pageViewCount: sumEventCounters(counters, "PAGE_VIEW"),
  };
}

function readLocationDetailCounts(
  counters: readonly AnalyticsCounter[],
  summary: LocationDetailViewSummary | undefined,
) {
  if (summary) return summary;
  return {
    noOpenNoticeLocationDetailViewCount: sumNoOpenDetailViews(counters),
    openNoticeLocationDetailViewCount: sumOpenDetailViews(counters),
  };
}

function createAnnouncementSummary(counts: DashboardCounts) {
  const count = counts.announcementOpenCount + counts.announcementInterestCount;
  return {
    announcementActionCount: count,
    announcementActionRate: createRate(count, counts.pageViewCount),
  };
}

function createLocationDetailSummary(counts: DashboardCounts) {
  const noOpenCount = counts.noOpenNoticeLocationDetailViewCount;
  const total = counts.openNoticeLocationDetailViewCount + noOpenCount;
  return {
    locationDetailViewCount: total,
    noOpenNoticeLocationDetailViewCount: noOpenCount,
    noOpenNoticeLocationDetailViewRate: createRate(noOpenCount, total),
  };
}

function sumOpenDetailViews(counters: readonly AnalyticsCounter[]) {
  return sumEventCounters(counters, "OPEN_NOTICE_LOCATION_DETAIL_VIEW");
}

function sumNoOpenDetailViews(counters: readonly AnalyticsCounter[]) {
  return sumEventCounters(counters, "NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW");
}

function sumEventCounters(counters: readonly AnalyticsCounter[], eventKind: AnalyticsEventKind) {
  return counters.filter((counter) => counter.eventKind === eventKind).reduce(sumCounterTotals, 0);
}

function sumCounterTotals(total: number, counter: AnalyticsCounter) {
  return total + counter.total;
}

function createRate(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function createRanks(counters: readonly AnalyticsCounter[], eventKind: AnalyticsEventKind) {
  const totals = new Map<string, number>();
  counters
    .filter((counter) => counter.eventKind === eventKind)
    .forEach((counter) => addCounter(totals, counter));
  return [...totals.entries()].map(createRank).sort(compareRanks);
}

function addCounter(totals: Map<string, number>, counter: AnalyticsCounter) {
  totals.set(counter.subjectId, (totals.get(counter.subjectId) ?? 0) + counter.total);
}

function createRank([subjectId, total]: [string, number]): AnalyticsRank {
  return { subjectId, total };
}

function compareRanks(first: AnalyticsRank, second: AnalyticsRank) {
  if (first.total !== second.total) return second.total - first.total;
  return first.subjectId.localeCompare(second.subjectId, "ko-KR");
}
