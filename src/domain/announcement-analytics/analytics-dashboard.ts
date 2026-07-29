import type { AnalyticsCounter, AnalyticsEventKind } from "./analytics-counter";

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
  locationRanks: readonly AnalyticsRank[];
  pageViewCount: number;
}>;

export function createAnalyticsDashboard(
  counters: readonly AnalyticsCounter[],
): AnalyticsDashboard {
  const pageViewCount = sumEventCounters(counters, "PAGE_VIEW");
  const announcementOpenCount = sumEventCounters(counters, "ANNOUNCEMENT_OPEN");
  const announcementInterestCount = sumEventCounters(counters, "ANNOUNCEMENT_INTEREST");
  return createDashboard(pageViewCount, announcementOpenCount, announcementInterestCount, counters);
}

function createDashboard(
  pageViewCount: number,
  announcementOpenCount: number,
  announcementInterestCount: number,
  counters: readonly AnalyticsCounter[],
): AnalyticsDashboard {
  const announcementActionCount = announcementOpenCount + announcementInterestCount;
  return {
    announcementActionCount,
    announcementActionRate: createActionRate(announcementActionCount, pageViewCount),
    announcementInterestCount,
    announcementOpenCount,
    announcementRanks: createRanks(counters, "ANNOUNCEMENT_OPEN"),
    locationRanks: createRanks(counters, "ANNOUNCEMENT_INTEREST"),
    pageViewCount,
  };
}

function sumEventCounters(counters: readonly AnalyticsCounter[], eventKind: AnalyticsEventKind) {
  return counters.filter((counter) => counter.eventKind === eventKind).reduce(sumCounterTotals, 0);
}

function sumCounterTotals(total: number, counter: AnalyticsCounter) {
  return total + counter.total;
}

function createActionRate(actionCount: number, pageViewCount: number) {
  if (pageViewCount === 0) return 0;
  return (actionCount / pageViewCount) * 100;
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
