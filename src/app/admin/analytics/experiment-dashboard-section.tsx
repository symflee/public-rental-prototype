import type {
  AnalyticsRank,
  ExperimentDashboard,
  ExperimentDecision,
} from "@/domain/announcement-analytics";

type ExperimentMetric = Readonly<{
  description: string;
  label: string;
  value: string;
}>;

type ExperimentDashboardSectionProperties = Readonly<{
  dashboard: ExperimentDashboard;
  readLocationLabel: (locationId: string) => string;
  trackingEnabled: boolean;
}>;

export function ExperimentDashboardSection({
  dashboard,
  readLocationLabel,
  trackingEnabled,
}: ExperimentDashboardSectionProperties) {
  return (
    <section aria-labelledby="experiment-heading">
      <ExperimentHeading />
      <ExperimentTrackingWarning enabled={trackingEnabled} />
      <ExperimentDecisionSummary decision={dashboard.decision} />
      <ExperimentMetrics dashboard={dashboard} />
      <BookmarkRanking ranks={dashboard.bookmarkRanks} readLocationLabel={readLocationLabel} />
    </section>
  );
}

function ExperimentTrackingWarning({ enabled }: Readonly<{ enabled: boolean }>) {
  if (enabled) return null;
  return (
    <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm" role="alert">
      신규 실험 계측이 중지되었습니다. 방문자 해시 비밀값과 72시간 이내 주택 스냅샷을 확인해 주세요.
    </p>
  );
}

function ExperimentHeading() {
  return (
    <header>
      <p className="text-sm font-semibold text-emerald-700">신규 가설 검증</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-950" id="experiment-heading">
        비모집 임대주택 탐색과 북마크
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        지도가 정상 준비된 고유 방문자의 비모집 주택 탐색·저장 행동입니다.
      </p>
    </header>
  );
}

function ExperimentDecisionSummary({ decision }: Readonly<{ decision: ExperimentDecision }>) {
  return (
    <div className={readDecisionStyle(decision)} role="status">
      <strong className="block text-base">{readDecisionTitle(decision)}</strong>
      <span className="mt-1 block text-sm">{readDecisionDescription(decision)}</span>
    </div>
  );
}

function readDecisionStyle(decision: ExperimentDecision) {
  const base = "mt-5 rounded-xl border p-4";
  if (decision.status === "SUCCESS") return `${base} border-emerald-200 bg-emerald-50`;
  if (decision.status === "BELOW_TARGET") return `${base} border-rose-200 bg-rose-50`;
  return `${base} border-amber-200 bg-amber-50`;
}

function readDecisionTitle(decision: ExperimentDecision) {
  if (decision.status === "SUCCESS") return "성공 · 관측 북마크율이 목표 이상입니다.";
  if (decision.status === "BELOW_TARGET") return "목표 미달 · 관측 북마크율이 10% 미만입니다.";
  return "판정 보류 · 최소 표본이 더 필요합니다.";
}

function readDecisionDescription(decision: ExperimentDecision) {
  const sample = formatCount(decision.sampleSize);
  const minimum = formatCount(decision.minimumSampleSize);
  if (decision.status === "INSUFFICIENT_SAMPLE") return `최소 ${minimum}명 중 ${sample}명 확보`;
  return `유효 표본 ${sample}명 · 판정 기준 ${formatRate(decision.targetRate)}`;
}

function ExperimentMetrics({ dashboard }: Readonly<{ dashboard: ExperimentDashboard }>) {
  return (
    <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {createExperimentMetrics(dashboard).map(ExperimentMetricCard)}
    </dl>
  );
}

function createExperimentMetrics(dashboard: ExperimentDashboard) {
  return [
    createEligibleMetric(dashboard),
    createDetailMetric(dashboard),
    createBookmarkMetric(dashboard),
    createBookmarkAddCountMetric(dashboard),
    createDetailConversionMetric(dashboard),
    createObservedRateMetric(dashboard.decision),
    createConfidenceMetric(dashboard.decision),
  ];
}

function createEligibleMetric(dashboard: ExperimentDashboard): ExperimentMetric {
  return createMetric(
    "자격 방문자",
    formatCount(dashboard.eligibleVisitorCount),
    "지도가 정상 준비된 전환율 분모입니다.",
  );
}

function createDetailMetric(dashboard: ExperimentDashboard): ExperimentMetric {
  const description = `${formatCount(dashboard.noOpenDetailVisitorCount)}명`;
  return createMetric("비모집 주택 상세 조회", formatRate(dashboard.noOpenDetailRate), description);
}

function createBookmarkMetric(dashboard: ExperimentDashboard): ExperimentMetric {
  const description = `${formatCount(dashboard.bookmarkVisitorCount)}명 · 방문자당 1회 집계`;
  return createMetric("북마크 고유 사용자율", formatRate(dashboard.bookmarkRate), description);
}

function createBookmarkAddCountMetric(dashboard: ExperimentDashboard): ExperimentMetric {
  const description = "같은 방문자의 반복 추가를 포함한 원시 이벤트 수입니다.";
  return createMetric("북마크 등록 횟수", formatCount(dashboard.bookmarkAddCount), description);
}

function createDetailConversionMetric(dashboard: ExperimentDashboard): ExperimentMetric {
  return createMetric(
    "상세 조회 후 북마크",
    formatRate(dashboard.detailToBookmarkRate),
    "상세 조회자 기준",
  );
}

function createObservedRateMetric(decision: ExperimentDecision): ExperimentMetric {
  const description = `성공 기준 ${formatRate(decision.targetRate)}`;
  return createMetric("관측 북마크 전환율", formatRate(decision.observedRate), description);
}

function createConfidenceMetric(decision: ExperimentDecision): ExperimentMetric {
  const description = "불확실성을 반영한 보조 지표입니다.";
  return createMetric("단측 95% 신뢰 하한", formatRate(decision.confidenceLowerBound), description);
}

function createMetric(label: string, value: string, description: string): ExperimentMetric {
  return { description, label, value };
}

function ExperimentMetricCard(metric: ExperimentMetric) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" key={metric.label}>
      <dt className="text-xs font-semibold text-slate-600">{metric.label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</dd>
      <p className="mt-2 text-xs leading-5 text-slate-600">{metric.description}</p>
    </div>
  );
}

function BookmarkRanking({
  ranks,
  readLocationLabel,
}: Readonly<{ ranks: readonly AnalyticsRank[]; readLocationLabel: (id: string) => string }>) {
  return (
    <section className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-950">위치별 북마크 방문자 순위</h3>
      <ol className="mt-3 space-y-2">
        {ranks.map((rank) => BookmarkRankItem(rank, readLocationLabel))}
      </ol>
      <EmptyBookmarkRanking ranks={ranks} />
    </section>
  );
}

function BookmarkRankItem(rank: AnalyticsRank, readLocationLabel: (id: string) => string) {
  return (
    <li className="flex justify-between gap-4 text-sm" key={rank.subjectId}>
      <span className="text-slate-700">{readLocationLabel(rank.subjectId)}</span>
      <strong className="text-slate-950">{formatCount(rank.total)}</strong>
    </li>
  );
}

function EmptyBookmarkRanking({ ranks }: Readonly<{ ranks: readonly AnalyticsRank[] }>) {
  if (ranks.length > 0) return null;
  return <p className="mt-3 text-sm text-slate-500">해당 기간의 북마크가 없습니다.</p>;
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}
