import {
  createCurrentMonthDateRange,
  createRecentDateRange,
  readAnalyticsDateRange,
  readKoreanDate,
  type AnalyticsDashboard,
  type AnalyticsRank,
} from "@/domain/announcement-analytics";
import { isAnalyticsStorageEnabled, readAnalyticsDashboard } from "@/infrastructure/analytics";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

type DateRange = Readonly<{ from: string; to: string }>;
type SearchParameters = Readonly<{
  dataset?: string;
  from?: string;
  period?: string;
  to?: string;
}>;
type AnalyticsPageProperties = Readonly<{ searchParams: Promise<SearchParameters> }>;
type AnalyticsDashboardPageProperties = Readonly<{
  dashboard: AnalyticsDashboard;
  range: DateRange;
}>;
type DashboardMetric = Readonly<{ label: string; value: string }>;
type DateInputProperties = Readonly<{ label: string; name: string; value: string }>;
type RangePresetProperties = Readonly<{ href: string; label: string }>;
type MetricGridProperties = Readonly<{
  className: string;
  metrics: readonly DashboardMetric[];
}>;

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProperties) {
  if (!isAnalyticsStorageEnabled()) return <AnalyticsUnavailable />;
  const parameters = await searchParams;
  const range = readDashboardDateRange(parameters);
  const dashboard = await readDashboardSafely(range);
  if (!dashboard) return <AnalyticsLoadFailed />;
  return <AnalyticsDashboardPage dashboard={dashboard} range={range} />;
}

async function readDashboardSafely(range: DateRange) {
  try {
    return await readAnalyticsDashboard(range);
  } catch {
    return undefined;
  }
}

function readDashboardDateRange(parameters: SearchParameters) {
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

function AnalyticsLoadFailed() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-bold text-slate-950">분석 데이터를 불러오지 못했습니다</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        잠시 뒤 다시 시도하거나 Neon 스키마와 연결 상태를 확인해 주세요.
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
      <DashboardHeader range={properties.range} />
      <HousingInformationSection dashboard={properties.dashboard} />
      <ServiceUsageSection dashboard={properties.dashboard} />
    </div>
  );
}

function DashboardHeader({ range }: Readonly<{ range: DateRange }>) {
  return (
    <header>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">서비스 이용 지표</h1>
      <DashboardLinks />
      <AnalyticsRangeFilters range={range} />
    </header>
  );
}

function DashboardLinks() {
  return (
    <nav aria-label="관리 도구" className="mt-4 flex flex-wrap items-center gap-4 text-sm">
      <a
        className="font-semibold text-slate-700 underline"
        href="/admin/analytics/runs/2026-08-11-14"
      >
        주택별 조회 내역
      </a>
      <a className="font-semibold text-slate-700 underline" href="/admin/recruitment-notices">
        수기 공고 관리
      </a>
    </nav>
  );
}

function AnalyticsRangeFilters({ range }: Readonly<{ range: DateRange }>) {
  return (
    <>
      <AnalyticsRangePresets />
      <AnalyticsRangeForm range={range} />
    </>
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

function AnalyticsRangePreset(properties: RangePresetProperties) {
  return (
    <a
      className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
      href={properties.href}
    >
      {properties.label}
    </a>
  );
}

function AnalyticsRangeForm({ range }: Readonly<{ range: DateRange }>) {
  return (
    <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
      <DateInput label="시작일" name="from" value={range.from} />
      <DateInput label="종료일" name="to" value={range.to} />
      <RangeSubmitButton />
    </form>
  );
}

function RangeSubmitButton() {
  return (
    <button
      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
      type="submit"
    >
      기간 적용
    </button>
  );
}

function DateInput(properties: DateInputProperties) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {properties.label}
      <input
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        defaultValue={properties.value}
        name={properties.name}
        type="date"
      />
    </label>
  );
}

function HousingInformationSection({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <section aria-labelledby="housing-information-heading">
      <SectionHeading id="housing-information-heading" title="주택 정보 조회" />
      <MetricGrid
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        metrics={createHousingInformationMetrics(dashboard)}
      />
    </section>
  );
}

function createHousingInformationMetrics(dashboard: AnalyticsDashboard) {
  return [
    createCountMetricWithUnit("전체 주택 정보 조회", dashboard.locationDetailViewCount),
    createCountMetricWithUnit(
      "공고 중이 아닌 주택 조회",
      dashboard.noOpenNoticeLocationDetailViewCount,
    ),
    createRateMetric("공고 중이 아닌 주택 조회 비율", dashboard.noOpenNoticeLocationDetailViewRate),
  ];
}

function ServiceUsageSection({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <section aria-labelledby="service-usage-heading" className="border-t border-slate-200 pt-8">
      <SectionHeading id="service-usage-heading" title="서비스 이용 현황" />
      <MetricGrid
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        metrics={createServiceUsageMetrics(dashboard)}
      />
      <AnalyticsRankings dashboard={dashboard} />
    </section>
  );
}

function createServiceUsageMetrics(dashboard: AnalyticsDashboard) {
  return [
    createCountMetric("지도 조회수", dashboard.pageViewCount),
    createCountMetric("공식 공고 열람", dashboard.announcementOpenCount),
    createCountMetric("공고 확인해보기", dashboard.announcementInterestCount),
    createRateMetric("조회수 대비 공고 확인 행동률", dashboard.announcementActionRate),
  ];
}

function SectionHeading({ id, title }: Readonly<{ id: string; title: string }>) {
  return (
    <h2 className="text-xl font-bold text-slate-950" id={id}>
      {title}
    </h2>
  );
}

function MetricGrid(properties: MetricGridProperties) {
  return <dl className={properties.className}>{properties.metrics.map(MetricCard)}</dl>;
}

function MetricCard(metric: DashboardMetric) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={metric.label}>
      <dt className="text-sm font-semibold text-slate-600">{metric.label}</dt>
      <dd className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{metric.value}</dd>
    </div>
  );
}

function createCountMetric(label: string, count: number): DashboardMetric {
  return { label, value: count.toLocaleString("ko-KR") };
}

function createCountMetricWithUnit(label: string, count: number): DashboardMetric {
  return { label, value: `${count.toLocaleString("ko-KR")}건` };
}

function createRateMetric(label: string, rate: number): DashboardMetric {
  return { label, value: `${rate.toFixed(1)}%` };
}

function AnalyticsRankings({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <div className="mt-6 max-w-2xl">
      <AnalyticsRanking ranks={dashboard.locationRanks} />
    </div>
  );
}

function AnalyticsRanking({ ranks }: Readonly<{ ranks: readonly AnalyticsRank[] }>) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-950">단지별 공고 확인해보기 클릭 수</h3>
      <ol className="mt-3 space-y-2">{ranks.map(AnalyticsRankItem)}</ol>
      <EmptyRanking ranks={ranks} />
    </section>
  );
}

function AnalyticsRankItem(rank: AnalyticsRank) {
  return (
    <li className="flex justify-between gap-4 text-sm" key={rank.subjectId}>
      <span className="text-slate-700">{readLocationLabel(rank.subjectId)}</span>
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
