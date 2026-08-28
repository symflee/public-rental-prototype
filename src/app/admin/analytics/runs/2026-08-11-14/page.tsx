import {
  HISTORICAL_LOCATION_DETAIL_DATASET_ID,
  type LocationDetailViewSummary,
} from "@/domain/announcement-analytics";
import {
  HISTORICAL_RECRUITMENT_NOTICE_FIXTURES,
  isHistoricalLocationDetailRunReady,
  readLocationDetailViewBreakdown,
  readLocationDetailViewSummary,
  type LocationDetailBreakdown,
} from "@/infrastructure/analytics";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

const RANGE = { from: "2026-08-11", to: "2026-08-14" };

export const dynamic = "force-dynamic";

export default async function HistoricalAnalyticsRunPage() {
  const [breakdown, ready, summary] = await Promise.all([
    readLocationDetailViewBreakdown(HISTORICAL_LOCATION_DETAIL_DATASET_ID, RANGE),
    isHistoricalLocationDetailRunReady(),
    readLocationDetailViewSummary(HISTORICAL_LOCATION_DETAIL_DATASET_ID, RANGE),
  ]);
  if (!ready) return <HistoricalRunUnavailable />;
  return (
    <main className="min-h-dvh bg-slate-50 py-8">
      <div className="mx-auto max-w-6xl space-y-8 px-6 pb-20 md:px-10">
        <RunHeader />
        <RunMetrics summary={summary} />
        <NoticeFixtures />
        <LocationBreakdown breakdown={breakdown} />
      </div>
    </main>
  );
}

function RunHeader() {
  return (
    <header className="space-y-3">
      <a
        className="text-sm font-semibold text-slate-700 underline"
        href="/admin/analytics?from=2026-08-11&to=2026-08-14"
      >
        서비스 이용 지표로 돌아가기
      </a>
      <h1 className="text-3xl font-bold text-slate-950">2026.08.11~08.14 주택 조회 기록</h1>
      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
        재구성 데이터
      </span>
      <div className="max-w-3xl text-sm leading-6 text-slate-600" role="note">
        확인된 원자료는 전체 132건과 비모집 52건의 합계입니다. 주택별 횟수와 조회 시각은 공식
        모집기간과 당시 수기 연결 대상을 기준으로 재구성했습니다.
      </div>
    </header>
  );
}

function RunMetrics({ summary }: Readonly<{ summary: LocationDetailViewSummary }>) {
  const total =
    summary.openNoticeLocationDetailViewCount + summary.noOpenNoticeLocationDetailViewCount;
  const metrics = [
    { label: "전체 주택 정보 조회", value: `${total.toLocaleString("ko-KR")}건` },
    {
      label: "공고 중이 아닌 주택 조회",
      value: `${summary.noOpenNoticeLocationDetailViewCount.toLocaleString("ko-KR")}건`,
    },
    { label: "공고 중이 아닌 주택 조회 비율", value: createRate(summary, total) },
  ];
  return <dl className="grid gap-4 sm:grid-cols-3">{metrics.map(RunMetric)}</dl>;
}

function createRate(summary: LocationDetailViewSummary, total: number) {
  if (total === 0) return "0.0%";
  return `${((summary.noOpenNoticeLocationDetailViewCount / total) * 100).toFixed(1)}%`;
}

function RunMetric(metric: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5" key={metric.label}>
      <dt className="text-sm font-semibold text-slate-600">{metric.label}</dt>
      <dd className="mt-2 text-3xl font-bold text-slate-950">{metric.value}</dd>
    </div>
  );
}

function NoticeFixtures() {
  return (
    <section aria-labelledby="manual-notices-heading">
      <h2 className="text-xl font-bold text-slate-950" id="manual-notices-heading">
        재구성에 사용한 모집공고
      </h2>
      <ul className="mt-4 grid gap-4 lg:grid-cols-3">
        {HISTORICAL_RECRUITMENT_NOTICE_FIXTURES.map(NoticeFixture)}
      </ul>
    </section>
  );
}

function HistoricalRunUnavailable() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-bold text-slate-950">재구성 실행을 확인할 수 없습니다</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        분석 스키마와 8월 11~14일 데이터 시드를 확인해 주세요.
      </p>
    </main>
  );
}

function NoticeFixture(fixture: (typeof HISTORICAL_RECRUITMENT_NOTICE_FIXTURES)[number]) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5" key={fixture.notice.id}>
      <span className="text-xs font-bold text-amber-800">공식 LH 공고 · 수기 연결</span>
      <h3 className="mt-2 font-bold text-slate-950">{fixture.notice.title}</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <NoticeFact label="모집 기간" value={createNoticePeriod(fixture.notice)} />
        <NoticeFact label="연결 주택" value={`${fixture.locationIds.length}곳`} />
      </dl>
      <a
        className="mt-4 inline-block text-sm font-semibold text-blue-700 underline"
        href={fixture.notice.url}
        rel="noreferrer"
        target="_blank"
      >
        공식 공고 보기
      </a>
    </li>
  );
}

function NoticeFact(properties: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-slate-500">{properties.label}</dt>
      <dd className="text-slate-800">{properties.value}</dd>
    </div>
  );
}

function createNoticePeriod(
  notice: (typeof HISTORICAL_RECRUITMENT_NOTICE_FIXTURES)[number]["notice"],
) {
  return `${notice.applicationStartsAt ?? "-"} ~ ${notice.applicationEndsAt ?? "-"}`;
}

function LocationBreakdown({
  breakdown,
}: Readonly<{ breakdown: readonly LocationDetailBreakdown[] }>) {
  return (
    <section aria-labelledby="location-breakdown-heading">
      <h2 className="text-xl font-bold text-slate-950" id="location-breakdown-heading">
        주택별 조회 내역
      </h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-3">주택</th>
              <th className="px-4 py-3">모집 중</th>
              <th className="px-4 py-3">비모집</th>
              <th className="px-4 py-3">전체</th>
            </tr>
          </thead>
          <tbody>{breakdown.map(LocationBreakdownRow)}</tbody>
        </table>
      </div>
    </section>
  );
}

function LocationBreakdownRow(row: LocationDetailBreakdown) {
  return (
    <tr className="border-t border-slate-200" key={row.locationId}>
      <th className="px-4 py-3 font-semibold text-slate-900">{readLocationName(row.locationId)}</th>
      <td className="px-4 py-3">{row.openCount}</td>
      <td className="px-4 py-3">{row.noOpenCount}</td>
      <td className="px-4 py-3 font-bold">{row.total}</td>
    </tr>
  );
}

function readLocationName(locationId: string) {
  const location = publicRentalSnapshot.locations.find((value) => value.id === locationId);
  if (!location) return locationId;
  return location.name;
}
