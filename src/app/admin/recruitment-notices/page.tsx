import {
  isManualRecruitmentStorageEnabled,
  readActiveManualRecruitmentNotices,
  type ManualRecruitmentNoticeInput,
} from "@/infrastructure/manual-recruitment";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

import { ManualRecruitmentForm } from "./manual-recruitment-form";
import { RevokeManualNoticeButton } from "./revoke-manual-notice-button";

export const dynamic = "force-dynamic";

export default async function ManualRecruitmentNoticesPage() {
  if (!isManualRecruitmentStorageEnabled()) return <StorageUnavailable />;
  const notices = await readNoticesSafely();
  if (!notices) return <StorageUnavailable />;
  return (
    <main className="min-h-dvh bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl space-y-8 px-6 pb-20 md:px-10">
        <PageHeader />
        <ManualRecruitmentForm />
        <ActiveNotices notices={notices} />
      </div>
    </main>
  );
}

async function readNoticesSafely() {
  try {
    return await readActiveManualRecruitmentNotices();
  } catch {
    return undefined;
  }
}

function PageHeader() {
  return (
    <header>
      <a className="text-sm font-semibold text-slate-700 underline" href="/admin/analytics">
        서비스 이용 지표로 돌아가기
      </a>
      <h1 className="mt-3 text-3xl font-bold text-slate-950">수기 모집공고 관리</h1>
    </header>
  );
}

function ActiveNotices({
  notices,
}: Readonly<{ notices: readonly ManualRecruitmentNoticeInput[] }>) {
  return (
    <section aria-labelledby="active-notices-heading">
      <h2 className="text-xl font-bold text-slate-950" id="active-notices-heading">
        미해제 수기 연결
      </h2>
      <ul className="mt-4 grid gap-4">{notices.map(ActiveNotice)}</ul>
      <EmptyNotices notices={notices} />
    </section>
  );
}

function ActiveNotice(notice: ManualRecruitmentNoticeInput) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5" key={notice.id}>
      <span className="text-xs font-bold text-amber-800">공식 LH 공고 · 수기 연결</span>
      <h3 className="mt-2 font-bold text-slate-950">{notice.title}</h3>
      <dl className="mt-3 grid gap-2 text-sm">
        <NoticeFact
          label="모집 기간"
          value={`${formatDateTime(notice.applicationStartsAt)} ~ ${formatDateTime(notice.applicationEndsAt)}`}
        />
        <NoticeFact label="연결 주택" value={notice.locationIds.map(readLocationName).join(", ")} />
      </dl>
      <a
        className="mt-4 inline-block text-sm font-semibold text-blue-700 underline"
        href={notice.url}
        rel="noreferrer"
        target="_blank"
      >
        공식 공고 보기
      </a>
      <RevokeManualNoticeButton noticeId={notice.id} />
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

function EmptyNotices({ notices }: Readonly<{ notices: readonly ManualRecruitmentNoticeInput[] }>) {
  if (notices.length > 0) return null;
  return <p className="mt-4 text-sm text-slate-500">활성 수기 공고가 없습니다.</p>;
}

function StorageUnavailable() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-bold">수기 공고 저장소를 연결해 주세요</h1>
      <p className="mt-3 text-sm text-slate-600">
        DATABASE_URL 또는 POSTGRES_URL 환경 변수가 필요합니다.
      </p>
    </main>
  );
}

function readLocationName(locationId: string) {
  const location = publicRentalSnapshot.locations.find((value) => value.id === locationId);
  if (!location) return locationId;
  return location.name;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
