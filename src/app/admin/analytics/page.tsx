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

type AnalyticsPageProperties = Readonly<{
  searchParams: Promise<Readonly<{ from?: string; period?: string; to?: string }>>;
}>;

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProperties) {
  if (!isAnalyticsStorageEnabled()) return <AnalyticsUnavailable />;
  const parameters = await searchParams;
  const range = readDashboardDateRange(parameters);
  const dashboard = await readAnalyticsDashboard(range);
  return <AnalyticsDashboardPage dashboard={dashboard} range={range} />;
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

function AnalyticsDashboardPage({
  dashboard,
  range,
}: Readonly<{ dashboard: AnalyticsDashboard; range: Readonly<{ from: string; to: string }> }>) {
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <AnalyticsHeading range={range} />
      <AnalyticsSummary dashboard={dashboard} />
      <AnalyticsRankings dashboard={dashboard} />
      <AnalyticsCaveat />
    </main>
  );
}

function AnalyticsHeading({ range }: Readonly<{ range: Readonly<{ from: string; to: string }> }>) {
  return (
    <header>
      <h1 className="text-2xl font-bold text-slate-950">공고 확인 행동 분석</h1>
      <p className="mt-2 text-sm text-slate-600">개인 식별 없이 집계한 조회·클릭 횟수입니다.</p>
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
        name={name}
        type="date"
        value={value}
      />
    </label>
  );
}

function AnalyticsSummary({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  const values = createSummaryValues(dashboard);
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{values.map(SummaryValue)}</dl>;
}

function createSummaryValues(
  dashboard: AnalyticsDashboard,
): readonly (readonly [string, string])[] {
  return [
    ["지도 조회수", dashboard.pageViewCount.toLocaleString("ko-KR")],
    ["실제 공고 열람 클릭 수", dashboard.announcementOpenCount.toLocaleString("ko-KR")],
    ["미연결 확인 의향 클릭 수", dashboard.announcementInterestCount.toLocaleString("ko-KR")],
    ["총 공고 확인 행동 수", dashboard.announcementActionCount.toLocaleString("ko-KR")],
    ["조회수 대비 공고 확인 행동률", `${dashboard.announcementActionRate.toFixed(1)}%`],
  ];
}

function SummaryValue([label, value]: readonly [string, string]) {
  return (
    <div className="rounded-xl bg-slate-100 p-4" key={label}>
      <dt className="text-xs font-semibold text-slate-600">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}

function AnalyticsRankings({ dashboard }: Readonly<{ dashboard: AnalyticsDashboard }>) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AnalyticsRanking
        heading="공고별 열람 클릭 수"
        ranks={dashboard.announcementRanks}
        readLabel={readAnnouncementLabel}
      />
      <AnalyticsRanking
        heading="단지별 확인 의향 클릭 수"
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
      <h2 className="font-bold text-slate-950">{heading}</h2>
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

function readAnnouncementLabel(announcementId: string) {
  const notice = publicRentalSnapshot.locations
    .flatMap(readRecruitmentNotices)
    .find((value) => value.id === announcementId);
  if (!notice) return announcementId;
  return notice.title;
}

function readRecruitmentNotices(location: (typeof publicRentalSnapshot.locations)[number]) {
  return location.recruitmentNotices ?? [];
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
