import type { AnalyticsRank } from "./analytics-dashboard";
import type { ExperimentEventKind, ExperimentFact, ExperimentVariant } from "./experiment-event";

export type ExperimentDecisionStatus = "BELOW_TARGET" | "INSUFFICIENT_SAMPLE" | "SUCCESS";

export type ExperimentDashboardFact = Pick<
  ExperimentFact,
  "eventKind" | "subjectId" | "visitorHash"
> &
  Partial<Pick<ExperimentFact, "variant">>;

export type ExperimentDecision = Readonly<{
  confidenceLowerBound: number;
  minimumSampleSize: number;
  observedRate: number;
  sampleSize: number;
  status: ExperimentDecisionStatus;
  targetRate: number;
}>;

export type ExperimentDashboard = Readonly<{
  bookmarkAddCount: number;
  bookmarkRanks: readonly AnalyticsRank[];
  bookmarkRate: number;
  bookmarkVisitorCount: number;
  decision: ExperimentDecision;
  detailToBookmarkRate: number;
  eligibleVisitorCount: number;
  noOpenDetailRate: number;
  noOpenDetailVisitorCount: number;
}>;

type ExperimentVisitors = Readonly<{
  bookmark: ReadonlySet<string>;
  detail: ReadonlySet<string>;
  eligible: ReadonlySet<string>;
}>;

const BOOKMARK_EVENT = "BOOKMARK_ADDED";
const DETAIL_EVENT = "NO_OPEN_NOTICE_LOCATION_VIEWED";
const ELIGIBLE_EVENT = "EXPERIMENT_ELIGIBLE";
const MINIMUM_SAMPLE_SIZE = 253;
const TARGET_RATE = 10;
const WILSON_Z_SCORE = 1.6448536269514722;

export function createExperimentDashboard(
  facts: readonly ExperimentDashboardFact[],
  variant?: ExperimentVariant,
  bookmarkAddCount = 0,
): ExperimentDashboard {
  const scopedFacts = readVariantFacts(facts, variant);
  const visitors = createVisitors(scopedFacts);
  return createDashboard(scopedFacts, visitors, bookmarkAddCount);
}

function createVisitors(facts: readonly ExperimentDashboardFact[]): ExperimentVisitors {
  const eligible = readVisitors(facts, ELIGIBLE_EVENT);
  return {
    bookmark: readEligibleVisitors(facts, BOOKMARK_EVENT, eligible),
    detail: readEligibleVisitors(facts, DETAIL_EVENT, eligible),
    eligible,
  };
}

function readVariantFacts(facts: readonly ExperimentDashboardFact[], variant?: ExperimentVariant) {
  if (!variant) return facts;
  return facts.filter((fact) => fact.variant === variant);
}

function readVisitors(facts: readonly ExperimentDashboardFact[], eventKind: ExperimentEventKind) {
  const visitorHashes = facts.filter((fact) => fact.eventKind === eventKind).map(readVisitorHash);
  return new Set(visitorHashes);
}

function readEligibleVisitors(
  facts: readonly ExperimentDashboardFact[],
  eventKind: ExperimentEventKind,
  eligibleVisitors: ReadonlySet<string>,
) {
  const visitors = readVisitors(facts, eventKind);
  return new Set([...visitors].filter((visitor) => eligibleVisitors.has(visitor)));
}

function readVisitorHash(fact: ExperimentDashboardFact) {
  return fact.visitorHash;
}

function createDashboard(
  facts: readonly ExperimentDashboardFact[],
  visitors: ExperimentVisitors,
  bookmarkAddCount: number,
): ExperimentDashboard {
  return {
    ...createVisitorCounts(visitors.eligible, visitors.detail, visitors.bookmark),
    ...createVisitorRates(visitors.eligible, visitors.detail, visitors.bookmark),
    bookmarkAddCount,
    bookmarkRanks: createBookmarkRanks(facts, visitors.eligible),
    decision: createDecision(visitors.bookmark.size, visitors.eligible.size),
  };
}

function createVisitorCounts(
  eligibleVisitors: ReadonlySet<string>,
  detailVisitors: ReadonlySet<string>,
  bookmarkVisitors: ReadonlySet<string>,
) {
  return {
    bookmarkVisitorCount: bookmarkVisitors.size,
    eligibleVisitorCount: eligibleVisitors.size,
    noOpenDetailVisitorCount: detailVisitors.size,
  };
}

function createVisitorRates(
  eligibleVisitors: ReadonlySet<string>,
  detailVisitors: ReadonlySet<string>,
  bookmarkVisitors: ReadonlySet<string>,
) {
  return {
    bookmarkRate: createRate(bookmarkVisitors.size, eligibleVisitors.size),
    detailToBookmarkRate: createIntersectionRate(bookmarkVisitors, detailVisitors),
    noOpenDetailRate: createRate(detailVisitors.size, eligibleVisitors.size),
  };
}

function createIntersectionRate(
  visitors: ReadonlySet<string>,
  denominatorVisitors: ReadonlySet<string>,
) {
  const intersectionCount = [...visitors].filter((visitor) =>
    denominatorVisitors.has(visitor),
  ).length;
  return createRate(intersectionCount, denominatorVisitors.size);
}

function createRate(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function createDecision(successCount: number, sampleSize: number): ExperimentDecision {
  const observedRate = createRate(successCount, sampleSize);
  return {
    confidenceLowerBound: createWilsonLowerBound(successCount, sampleSize),
    minimumSampleSize: MINIMUM_SAMPLE_SIZE,
    observedRate,
    sampleSize,
    status: readDecisionStatus(observedRate, sampleSize),
    targetRate: TARGET_RATE,
  };
}

function readDecisionStatus(observedRate: number, sampleSize: number): ExperimentDecisionStatus {
  if (sampleSize < MINIMUM_SAMPLE_SIZE) return "INSUFFICIENT_SAMPLE";
  if (observedRate >= TARGET_RATE) return "SUCCESS";
  return "BELOW_TARGET";
}

function createWilsonLowerBound(successCount: number, sampleSize: number) {
  if (sampleSize === 0) return 0;
  const proportion = successCount / sampleSize;
  const squaredScore = WILSON_Z_SCORE * WILSON_Z_SCORE;
  const denominator = 1 + squaredScore / sampleSize;
  const center = proportion + squaredScore / (2 * sampleSize);
  const variance = createWilsonVariance(proportion, squaredScore, sampleSize);
  return ((center - WILSON_Z_SCORE * Math.sqrt(variance)) / denominator) * 100;
}

function createWilsonVariance(proportion: number, squaredScore: number, sampleSize: number) {
  const samplingVariance = (proportion * (1 - proportion)) / sampleSize;
  return samplingVariance + squaredScore / (4 * sampleSize * sampleSize);
}

function createBookmarkRanks(
  facts: readonly ExperimentDashboardFact[],
  eligibleVisitors: ReadonlySet<string>,
) {
  const visitorsBySubject = new Map<string, Set<string>>();
  facts
    .filter(isBookmarkFact)
    .filter((fact) => eligibleVisitors.has(fact.visitorHash))
    .forEach((fact) => addVisitor(visitorsBySubject, fact));
  return [...visitorsBySubject.entries()].map(createRank).sort(compareRanks);
}

function isBookmarkFact(fact: ExperimentDashboardFact) {
  return fact.eventKind === BOOKMARK_EVENT;
}

function addVisitor(visitorsBySubject: Map<string, Set<string>>, fact: ExperimentDashboardFact) {
  const visitors = visitorsBySubject.get(fact.subjectId);
  if (visitors) return void visitors.add(fact.visitorHash);
  visitorsBySubject.set(fact.subjectId, new Set([fact.visitorHash]));
}

function createRank([subjectId, visitors]: [string, Set<string>]): AnalyticsRank {
  return { subjectId, total: visitors.size };
}

function compareRanks(first: AnalyticsRank, second: AnalyticsRank) {
  if (first.total !== second.total) return second.total - first.total;
  return first.subjectId.localeCompare(second.subjectId, "ko-KR");
}
