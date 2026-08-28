import {
  type PublicRentalRecruitmentState,
  PublicRentalLegalCategory,
  PublicRentalLocation,
  PublicRentalRecruitmentNotice,
  PublicRentalSourceRecord,
  RentalOffering,
} from "@/domain/public-rental";
import type { MapMarkerDetail } from "@/infrastructure/kakao/kakao-map-sdk";

import { createLegalCategoryText, readCategoryLabel, readProviderLabel } from "./map-labels";
import { readManualRecruitmentTiming, readMapRecruitmentState } from "./map-recruitment-status";
import { RecruitmentInterestButton } from "./recruitment-interest-button";

type CategorySummary = Readonly<{
  areaText: string;
  category: PublicRentalLegalCategory;
  householdText: string;
}>;

export function MapLocationDetail({
  bookmarked = false,
  location,
  onBookmarkToggle,
  bookmarkMessage,
  recruitmentAbsenceReliable = true,
}: Readonly<{
  bookmarked?: boolean;
  bookmarkMessage?: string;
  location: PublicRentalLocation | undefined;
  onBookmarkToggle?: (locationId: string) => void;
  recruitmentAbsenceReliable?: boolean;
}>) {
  if (!location) return <EmptyLocationDetail />;
  return (
    <LocationDetail
      bookmarked={bookmarked}
      bookmarkMessage={bookmarkMessage}
      location={location}
      onBookmarkToggle={onBookmarkToggle}
      recruitmentAbsenceReliable={recruitmentAbsenceReliable}
    />
  );
}

export function createMapMarkerDetail(location: PublicRentalLocation): MapMarkerDetail {
  return {
    address: location.roadAddress,
    rows: createCategorySummaries(location).map(createMarkerDetailRow),
  };
}

function EmptyLocationDetail() {
  return (
    <p className="border-t border-slate-200 p-4 text-sm text-slate-500">
      목록 또는 지도 핀에서 주택을 선택해 주세요.
    </p>
  );
}

type LocationDetailProperties = Readonly<{
  bookmarked: boolean;
  bookmarkMessage?: string;
  location: PublicRentalLocation;
  onBookmarkToggle?: (locationId: string) => void;
  recruitmentAbsenceReliable: boolean;
}>;

function LocationDetail(properties: LocationDetailProperties) {
  const recruitmentState = readMapRecruitmentState(
    properties.location,
    properties.recruitmentAbsenceReliable,
  );
  return (
    <section
      aria-label="선택한 임대주택 상세"
      className="border-t border-slate-200 p-4"
      role="region"
    >
      <LocationSummary {...properties} recruitmentState={recruitmentState} />
      <LocationInformation location={properties.location} recruitmentState={recruitmentState} />
    </section>
  );
}

function LocationSummary(
  properties: LocationDetailProperties &
    Readonly<{ recruitmentState: PublicRentalRecruitmentState }>,
) {
  return (
    <>
      <h2 className="text-base font-bold text-slate-950">{properties.location.name}</h2>
      <LocationBadges
        location={properties.location}
        recruitmentState={properties.recruitmentState}
      />
      <BookmarkControl {...properties} />
    </>
  );
}

function LocationInformation({
  location,
  recruitmentState,
}: Readonly<{
  location: PublicRentalLocation;
  recruitmentState: PublicRentalRecruitmentState;
}>) {
  return (
    <>
      <LocationFacts location={location} />
      <CategorySummaries location={location} />
      <PropertyNames location={location} />
      <RecruitmentNoticeLinks
        location={location}
        locationId={location.id}
        notices={location.recruitmentNotices ?? []}
        recruitmentState={recruitmentState}
      />
      <SourceLinks sources={location.sourceRecords} />
    </>
  );
}

function BookmarkControl(
  properties: LocationDetailProperties &
    Readonly<{ recruitmentState: PublicRentalRecruitmentState }>,
) {
  if (!properties.onBookmarkToggle) return null;
  if (properties.recruitmentState.status === "OPEN" && !properties.bookmarked) return null;
  return (
    <div className="mt-3">
      <button
        aria-pressed={properties.bookmarked}
        className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800"
        onClick={() => properties.onBookmarkToggle?.(properties.location.id)}
        type="button"
      >
        {readBookmarkButtonText(properties.bookmarked)}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        이 브라우저에만 저장되며 모집 알림은 아직 제공하지 않습니다.
      </p>
      <BookmarkMessage message={properties.bookmarkMessage} />
    </div>
  );
}

function BookmarkMessage({ message }: Readonly<{ message?: string }>) {
  if (!message) return null;
  return (
    <p className="mt-2 text-xs text-rose-700" role="alert">
      {message}
    </p>
  );
}

function readBookmarkButtonText(bookmarked: boolean) {
  if (bookmarked) return "저장 해제";
  return "이 주택 저장";
}

function LocationBadges({
  location,
  recruitmentState,
}: Readonly<{
  location: PublicRentalLocation;
  recruitmentState: PublicRentalRecruitmentState;
}>) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
      <Badge className="bg-slate-100 text-slate-700" text={readProviderLabel(location.provider)} />
      <Badge
        className="bg-emerald-50 text-emerald-700"
        text={createLegalCategoryText(location.legalCategories)}
      />
      <RecruitmentStatusBadge location={location} recruitmentState={recruitmentState} />
    </div>
  );
}

function RecruitmentStatusBadge({
  location,
  recruitmentState,
}: Readonly<{
  location: PublicRentalLocation;
  recruitmentState: PublicRentalRecruitmentState;
}>) {
  if (recruitmentState.status === "OPEN") return <OpenRecruitmentBadge state={recruitmentState} />;
  if (recruitmentState.status === "UNKNOWN") {
    return <Badge className="bg-slate-100 text-slate-600" text="모집 상태 확인 필요" />;
  }
  const manualTiming = readManualRecruitmentTiming(location);
  if (manualTiming === "UPCOMING")
    return <Badge className="bg-sky-50 text-sky-800" text="모집 예정 · 수기 연결" />;
  if (manualTiming === "CLOSED")
    return <Badge className="bg-slate-100 text-slate-700" text="지난 공고 · 수기 연결" />;
  return <Badge className="bg-slate-100 text-slate-600" text="현재 모집공고 없음" />;
}

function OpenRecruitmentBadge({ state }: Readonly<{ state: PublicRentalRecruitmentState }>) {
  const notice = state.openNotices.at(0);
  if (notice?.sourceKind === "MANUAL_REVIEW") {
    return <Badge className="bg-amber-50 text-amber-800" text="현재 모집 중 · 수기 연결" />;
  }
  return <Badge className="bg-amber-50 text-amber-800" text="현재 모집 중" />;
}

function Badge({ className, text }: Readonly<{ className: string; text: string }>) {
  return <span className={`rounded-full px-2.5 py-1 ${className}`}>{text}</span>;
}

function LocationFacts({ location }: Readonly<{ location: PublicRentalLocation }>) {
  return (
    <dl className="mt-4 space-y-2 text-sm">
      <LocationFact term="주소" value={location.roadAddress} />
      <LocationFact term="구" value={readDistrict(location)} />
      <LocationFact term="전체 세대" value={createHouseholdText(location.householdCount)} />
      <LocationFact term="준공일" value={readNullableText(location.completionDate)} />
    </dl>
  );
}

function LocationFact({ term, value }: Readonly<{ term: string; value: string }>) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-slate-500">{term}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function CategorySummaries({ location }: Readonly<{ location: PublicRentalLocation }>) {
  const summaries = createCategorySummaries(location);
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-500">공급유형별 정보</h3>
      <ul className="mt-2 space-y-2">{summaries.map(CategorySummaryItem)}</ul>
    </div>
  );
}

function CategorySummaryItem(summary: CategorySummary) {
  return (
    <li className="rounded-lg bg-slate-50 px-3 py-2 text-xs" key={summary.category}>
      <strong className="text-slate-800">{readCategoryLabel(summary.category)}</strong>
      <span className="mt-1 block text-slate-600">
        {summary.householdText} · {summary.areaText}
      </span>
    </li>
  );
}

function createMarkerDetailRow(summary: CategorySummary) {
  return {
    areaText: summary.areaText,
    categoryLabel: readCategoryLabel(summary.category),
    householdText: summary.householdText,
  };
}

function PropertyNames({ location }: Readonly<{ location: PublicRentalLocation }>) {
  const properties = readProperties(location);
  if (properties.length < 2) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-500">이 주소의 주택</h3>
      <p className="mt-1 text-xs leading-5 text-slate-700">{properties.map(readName).join(", ")}</p>
    </div>
  );
}

function RecruitmentNoticeLinks({
  location,
  locationId,
  notices,
  recruitmentState,
}: Readonly<{
  location: PublicRentalLocation;
  locationId: string;
  notices: readonly PublicRentalRecruitmentNotice[];
  recruitmentState: PublicRentalRecruitmentState;
}>) {
  if (notices.length === 0) return <RecruitmentInterestButton locationId={locationId} />;
  return (
    <>
      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-500">
          {readNoticeSectionTitle(location, recruitmentState)}
        </h3>
        <ul className="mt-2 space-y-2">
          {notices.map((notice) => (
            <RecruitmentNoticeLink key={notice.id} locationId={locationId} notice={notice} />
          ))}
        </ul>
      </div>
      <ClosedNoticeInterestButton locationId={locationId} state={recruitmentState} />
    </>
  );
}

function readNoticeSectionTitle(
  location: PublicRentalLocation,
  state: PublicRentalRecruitmentState,
) {
  if (state.status === "OPEN") return "현재 모집 중 공고";
  if (state.status === "UNKNOWN") return "연결된 모집공고";
  if (readManualRecruitmentTiming(location) === "UPCOMING") return "예정 모집공고";
  return "지난 모집공고";
}

function ClosedNoticeInterestButton({
  locationId,
  state,
}: Readonly<{ locationId: string; state: PublicRentalRecruitmentState }>) {
  if (state.status === "OPEN") return null;
  return <RecruitmentInterestButton locationId={locationId} />;
}

function RecruitmentNoticeLink({
  locationId,
  notice,
}: Readonly<{ locationId: string; notice: PublicRentalRecruitmentNotice }>) {
  return (
    <li key={notice.id}>
      <a
        aria-label={notice.title}
        className="block rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 underline underline-offset-2"
        href={createTrackedRecruitmentUrl(locationId, notice.id)}
        rel="noreferrer"
        target="_blank"
      >
        {notice.title}
        <RecruitmentNoticeDate announcedAt={notice.announcedAt} />
        <RecruitmentNoticePeriod notice={notice} />
        <RecruitmentNoticeSource notice={notice} />
      </a>
    </li>
  );
}

function createTrackedRecruitmentUrl(locationId: string, noticeId: string) {
  const parameters = new URLSearchParams({ locationId });
  return `/out/${encodeURIComponent(noticeId)}?${parameters.toString()}`;
}

function RecruitmentNoticeDate({ announcedAt }: Readonly<{ announcedAt: string | null }>) {
  if (!announcedAt) return null;
  return <span className="mt-1 block font-normal">공고일 {announcedAt}</span>;
}

function RecruitmentNoticePeriod({ notice }: Readonly<{ notice: PublicRentalRecruitmentNotice }>) {
  if (!notice.applicationStartsAt || !notice.applicationEndsAt) return null;
  return (
    <span className="mt-1 block font-normal">
      모집기간 {formatRecruitmentBoundary(notice.applicationStartsAt)} ~{" "}
      {formatRecruitmentBoundary(notice.applicationEndsAt)}
    </span>
  );
}

function formatRecruitmentBoundary(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function RecruitmentNoticeSource({ notice }: Readonly<{ notice: PublicRentalRecruitmentNotice }>) {
  if (notice.sourceKind !== "MANUAL_REVIEW") return null;
  return <span className="mt-1 block font-normal">공식 LH 공고 · 수기 연결</span>;
}

function SourceLinks({ sources }: Readonly<{ sources: readonly PublicRentalSourceRecord[] }>) {
  if (sources.length === 0) return <p className="mt-4 text-xs text-slate-500">출처 정보 없음</p>;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-500">출처</h3>
      <ul className="mt-1 flex flex-wrap gap-2">{sources.map(SourceLink)}</ul>
    </div>
  );
}

function SourceLink(source: PublicRentalSourceRecord, index: number) {
  return (
    <li key={createSourceKey(source)}>
      <a
        className="text-xs font-medium text-blue-700 underline underline-offset-2"
        href={source.sourceUrl}
        rel="noreferrer"
        target="_blank"
      >
        출처 {index + 1} 보기
      </a>
    </li>
  );
}

function createCategorySummaries(location: PublicRentalLocation) {
  return location.legalCategories.map((category) => createCategorySummary(location, category));
}

function createCategorySummary(
  location: PublicRentalLocation,
  category: PublicRentalLegalCategory,
) {
  const offerings = readCategoryOfferings(location.offerings, category);
  const householdText = createCategoryHouseholdText(location, offerings);
  return { areaText: createAreaText(offerings), category, householdText };
}

function readCategoryOfferings(
  offerings: readonly RentalOffering[],
  category: PublicRentalLegalCategory,
) {
  return offerings.filter((offering) => offering.legalCategory === category);
}

function createCategoryHouseholdText(
  location: PublicRentalLocation,
  offerings: readonly RentalOffering[],
) {
  const values = offerings.map(readOfferingHouseholds).filter(isNumber);
  if (values.length > 0) return createHouseholdText(values.reduce(sumNumbers, 0));
  if (location.legalCategories.length === 1) return createHouseholdText(location.householdCount);
  return "세대수 정보 없음";
}

function createAreaText(offerings: readonly RentalOffering[]) {
  const areas = offerings.map(readOfferingArea).filter(isNumber);
  if (areas.length === 0) return "면적 정보 없음";
  const minimum = Math.min(...areas);
  const maximum = Math.max(...areas);
  if (minimum === maximum) return `${formatArea(minimum)}㎡`;
  return `${formatArea(minimum)}–${formatArea(maximum)}㎡`;
}

function readOfferingHouseholds(offering: RentalOffering) {
  return offering.householdCount;
}

function readOfferingArea(offering: RentalOffering) {
  if (isNumber(offering.supplyAreaSquareMeters)) return offering.supplyAreaSquareMeters;
  return offering.exclusiveAreaSquareMeters;
}

function createHouseholdText(value: number | null) {
  if (value === null) return "정보 없음";
  return `${value.toLocaleString("ko-KR")}세대`;
}

function readDistrict(location: PublicRentalLocation) {
  return location.district;
}

function readProperties(location: PublicRentalLocation) {
  return location.properties;
}

function readNullableText(value: string | null | undefined) {
  if (!value) return "정보 없음";
  return value;
}

function readName(property: PublicRentalLocation["properties"][number]) {
  return property.name;
}

function sumNumbers(total: number, value: number) {
  return total + value;
}

function formatArea(value: number) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function createSourceKey(source: PublicRentalSourceRecord) {
  return `${source.source}:${source.sourceId}`;
}
