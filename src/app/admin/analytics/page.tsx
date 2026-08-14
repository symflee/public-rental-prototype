import {
  createCurrentMonthDateRange,
  createExperimentDashboard,
  createRecentDateRange,
  PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
  PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT,
  readAnalyticsDateRange,
  readKoreanDate,
  type AnalyticsDashboard,
  type AnalyticsRank,
  type ExperimentDashboard,
} from "@/domain/announcement-analytics";
import { isPublicRentalSnapshotFresh } from "@/domain/public-rental";
import {
  isAnalyticsStorageEnabled,
  isExperimentAnalyticsEnabled,
  readAllHomesBookmarkAddedEventCount,
  readAnalyticsDashboard,
  readExperimentFacts,
} from "@/infrastructure/analytics";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

import { ExperimentDashboardSection } from "./experiment-dashboard-section";

export const dynamic = "force-dynamic";

type AnalyticsPageProperties = Readonly<{
  searchParams: Promise<Readonly<{ from?: string; period?: string; to?: string }>>;
}>;

type DashboardMetric = Readonly<{
  description: string;
  label: string;
  value: string;
}>;

type AnalyticsDashboardPageProperties = Readonly<{
  dashboard: AnalyticsDashboard;
  experimentDashboard: ExperimentDashboard;
  experimentTrackingEnabled: boolean;
  range: Readonly<{ from: string; to: string }>;
}>;

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProperties) {
  if (!isAnalyticsStorageEnabled()) return <AnalyticsUnavailable />;
  const parameters = await searchParams;
  const range = readDashboardDateRange(parameters);
  const dashboard = await readDashboard(range);
  return <AnalyticsDashboardPage {...dashboard} range={range} />;
}

async function readDashboard(range: Readonly<{ from: string; to: string }>) {
  const experimentKey = PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY;
  const experimentTrackingEnabled = readExperimentTrackingEnabled();
  const [dashboard, facts, bookmarkAddCount] = await Promise.all([
    readAnalyticsDashboard(range),
    readExperimentFacts(range, experimentKey),
    readAllHomesBookmarkAddedEventCount(range, experimentKey),
  ]);
  const variant = PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT;
  const experimentDashboard = createExperimentDashboard(facts, variant, bookmarkAddCount);
  return { dashboard, experimentDashboard, experimentTrackingEnabled };
}

function readExperimentTrackingEnabled() {
  if (!isExperimentAnalyticsEnabled()) return false;
  return isPublicRentalSnapshotFresh(publicRentalSnapshot.generatedAt);
}

function readDashboardDateRange(
  parameters: Readonly<{ from?: string; period?: string; to?: string }>,
) {
  const today = readKoreanDate();
  if (parameters.period === "7d") return createRecentDateRange(today, 7);
  if (parameters.period === "30d") return createRecentDateRange(today, 30);
  if (parameters.period === "month") return createCurrentMonthDateRange(today);
  return readAnalyticsDateRange(parameters.from, parameters.to, today);
}

function AnalyticsUnavailable() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-bold text-slate-950">분석 저장소를 연결해 주세요</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        DATABASE_URL 또는 POSTGRES_URL 환경 변수가 필요합니다.
      </p>
    </main>
  );
}

function AnalyticsDashboardPage(properties: AnalyticsDashboardPageProperties) {
  return (
    <main className="h-dvh overflow-y-auto bg-slate-50 py-8">
      <AnalyticsDashboardContent {...properties} />
    </main>
  );
}

function AnalyticsDashboardContent(properties: AnalyticsDashboardPageProperties) {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 pb-20 md:px-10">
      <AnalyticsDashboardSections {...properties} />
    </div>
  );
}

function AnalyticsDashboardSections(properties: AnalyticsDashboardPageProperties) {
  const { dashboard, experimentDashboard, experimentTrackingEnabled, range } = properties;
  return (
    <>
      <AnalyticsHeading range={range} />
      <ExperimentAnalytics dashboard={experimentDashboard} enabled={experimentTrackingEnabled} />
      <AnalyticsPrimaryMetrics dashboard={dashboard} />
      <AnalyticsDetails dashboard={dashboard} />
      <AnalyticsCaveat />
    </>
  );
}

function ExperimentAnalytics({
  dashboard,
  enabled,
}: Readonly<{ dashboard: ExperimentDashboard; enabled: boolean }>) {
  return (
    <ExperimentDashboardSection
      dashboard={dashboard}
      readLocationLabel={readLocationLabel}
      trackingEnabled={enabled}
    />
  );
}

function AnalyticsHeading({ range }: Readonly<{ range: Readonly<{ from: string; to: string }> }>) {
  return (
    <header>
      <p className="text-sm font-semibold text-emerald-700">기획 검토용 지표</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">공고 확인 행동 분석</h1>
      <p className="mt-2 text-sm text-slate-600">
        일별 행동 횟수와 익명화한 고유 방문자 실험 지표입니다.
      </p>
      <AnalyticsRangePresets />
      <AnalyticsRangeForm range={range} />
    </header>
  );
}

function AnalyticsRangePresets() {
  return (
    <nav aria-label="분석 기간" className="mt-4 flex flex-wrap gap-2 text-sm">
      <AnalyticsRangePreset href="/admin/analytics?period=7d" label="최근 7일" />
      <AnalyticsRangePreset href="/admin/analytics?period=30d" label="최근 30일" />
      <AnalyticsRangePreset href="/admin/analytics?period=month" label="이번 달" />
    </nav>
  );
}

function AnalyticsRangePreset({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <a
      className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
      href={href}
    >
      {label}
    </a>
  );
}

function AnalyticsRangeForm({
  range,
}: Readonly<{ range: Readonly<{ from: string; to: string }> }>) {
  return (
    <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
      <DateInput label="시작일" name="from" value={range.from} />
      <DateInput label="종료일" name="to" value={range.to} />
      <button
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        type="submit"
      >
        기간 적용
      </button>
    </form>
  );
}

function DateInput({
  label,
  name,
  value,
}: Readonly<{ label: string; name: string; value: string }>) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        defaultValue={value}
        name={name}
        type="date"
      />
    </label>
  );
}

function AnalyticsPrimaryMetrics({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <section aria-labelledby="primary-metrics-heading">
      <SectionHeading
        description="검토자가 먼저 확인할 사용 관심과 수요 신호입니다."
        id="primary-metrics-heading"
        title="핵심 검증 지표"
      />
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {createPrimaryMetrics(dashboard).map(PrimaryMetric)}
      </dl>
    </section>
  );
}

function createPrimaryMetrics(dashboard: AnalyticsDashboard): readonly DashboardMetric[] {
  return [
    createCountMetric("지도 조회수", dashboard.pageViewCount, "지도를 열어 본 횟수입니다."),
    createCountMetric(
      "페이크 도어 테스트",
      dashboard.announcementInterestCount,
      "공고 확인해보기를 누른 횟수입니다.",
    ),
  ];
}

function createCountMetric(label: string, count: number, description: string): DashboardMetric {
  return { description, label, value: count.toLocaleString("ko-KR") };
}

function PrimaryMetric(metric: DashboardMetric) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" key={metric.label}>
      <dt className="text-sm font-semibold text-slate-700">{metric.label}</dt>
      <dd className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{metric.value}</dd>
      <p className="mt-4 text-sm leading-6 text-slate-600">{metric.description}</p>
    </div>
  );
}

function AnalyticsDetails({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <section aria-labelledby="analytics-details-heading" className="border-t border-slate-200 pt-8">
      <SectionHeading
        description="실제 공고 열람과 전환율, 단지별 클릭 순위를 확인할 수 있습니다."
        id="analytics-details-heading"
        title="상세 통계"
      />
      <AnalyticsDetailMetrics dashboard={dashboard} />
      <AnalyticsRankings dashboard={dashboard} />
    </section>
  );
}

function SectionHeading({
  description,
  id,
  title,
}: Readonly<{ description: string; id: string; title: string }>) {
  return (
    <header>
      <h2 className="text-xl font-bold text-slate-950" id={id}>
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </header>
  );
}

function AnalyticsDetailMetrics({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {createDetailMetrics(dashboard).map(DetailMetric)}
    </dl>
  );
}

function createDetailMetrics(dashboard: AnalyticsDashboard): readonly DashboardMetric[] {
  return [
    createCountMetric(
      "실제 공고 열람 클릭 수",
      dashboard.announcementOpenCount,
      "모집 중 공고의 공식 상세 페이지로 이동한 횟수입니다.",
    ),
    {
      description: "지도 조회수 대비 공고 확인 행동의 비율입니다.",
      label: "조회수 대비 공고 확인 행동률",
      value: `${dashboard.announcementActionRate.toFixed(1)}%`,
    },
  ];
}

function DetailMetric(metric: DashboardMetric) {
  return (
    <div className="rounded-xl bg-slate-100 p-4" key={metric.label}>
      <dt className="text-xs font-semibold text-slate-600">{metric.label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</dd>
      <p className="mt-2 text-xs leading-5 text-slate-600">{metric.description}</p>
    </div>
  );
}

function AnalyticsRankings({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <div className="mt-6 max-w-2xl">
      <AnalyticsRanking
        heading="단지별 공고 확인해보기 클릭 수"
        ranks={dashboard.locationRanks}
        readLabel={readLocationLabel}
      />
    </div>
  );
}

function AnalyticsRanking({
  heading,
  ranks,
  readLabel,
}: Readonly<{
  heading: string;
  ranks: readonly AnalyticsRank[];
  readLabel: (id: string) => string;
}>) {
  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-950">{heading}</h3>
      <ol className="mt-3 space-y-2">
        {ranks.map((rank) => (
          <AnalyticsRankItem key={rank.subjectId} rank={rank} readLabel={readLabel} />
        ))}
      </ol>
      <EmptyRanking ranks={ranks} />
    </section>
  );
}

function AnalyticsRankItem({
  rank,
  readLabel,
}: Readonly<{ rank: AnalyticsRank; readLabel: (id: string) => string }>) {
  return (
    <li className="flex justify-between gap-4 text-sm">
      <span className="text-slate-700">{readLabel(rank.subjectId)}</span>
      <strong className="text-slate-950">{rank.total.toLocaleString("ko-KR")}</strong>
    </li>
  );
}

function EmptyRanking({ ranks }: Readonly<{ ranks: readonly AnalyticsRank[] }>) {
  if (ranks.length > 0) return null;
  return <p className="mt-3 text-sm text-slate-500">해당 기간의 행동 기록이 없습니다.</p>;
}

function readLocationLabel(locationId: string) {
  const location = publicRentalSnapshot.locations.find((value) => value.id === locationId);
  if (!location) return locationId;
  return location.name;
}

function AnalyticsCaveat() {
  return (
    <p className="text-xs leading-5 text-slate-500">
      새로고침·반복 클릭·자동화 요청도 횟수에 포함될 수 있습니다.
    </p>
  );
}
