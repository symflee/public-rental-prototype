import type {
  PublicRentalLegalCategory,
  PublicRentalLocation,
  PublicRentalRecruitmentNotice,
  PublicRentalSourceRecord,
  RentalOffering,
} from "@/domain/public-rental";
import type { MapMarkerDetail } from "@/infrastructure/kakao/kakao-map-sdk";

import { createLegalCategoryText, readCategoryLabel, readProviderLabel } from "./map-labels";
import { RecruitmentInterestButton } from "./recruitment-interest-button";

type CategorySummary = Readonly<{
  areaText: string;
  category: PublicRentalLegalCategory;
  householdText: string;
}>;

export function MapLocationDetail({
  location,
}: Readonly<{ location: PublicRentalLocation | undefined }>) {
  if (!location) return <EmptyLocationDetail />;
  return <LocationDetail location={location} />;
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

function LocationDetail({ location }: Readonly<{ location: PublicRentalLocation }>) {
  return (
    <section
      aria-label="선택한 임대주택 상세"
      className="border-t border-slate-200 p-4"
      role="region"
    >
      <h2 className="text-base font-bold text-slate-950">{location.name}</h2>
      <LocationBadges location={location} />
      <LocationFacts location={location} />
      <CategorySummaries location={location} />
      <PropertyNames location={location} />
      <RecruitmentNoticeLinks
        locationId={location.id}
        notices={location.recruitmentNotices ?? []}
      />
      <SourceLinks sources={location.sourceRecords} />
    </section>
  );
}

function LocationBadges({ location }: Readonly<{ location: PublicRentalLocation }>) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
      <Badge className="bg-slate-100 text-slate-700" text={readProviderLabel(location.provider)} />
      <Badge
        className="bg-emerald-50 text-emerald-700"
        text={createLegalCategoryText(location.legalCategories)}
      />
    </div>
  );
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
  locationId,
  notices,
}: Readonly<{ locationId: string; notices: readonly PublicRentalRecruitmentNotice[] }>) {
  if (notices.length === 0) return <RecruitmentInterestButton locationId={locationId} />;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-500">모집 중 공고</h3>
      <ul className="mt-2 space-y-2">
        {notices.map((notice) => (
          <RecruitmentNoticeLink key={notice.id} locationId={locationId} notice={notice} />
        ))}
      </ul>
    </div>
  );
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
