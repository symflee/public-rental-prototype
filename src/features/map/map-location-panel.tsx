import type { ChangeEvent } from "react";

import type {
  PublicRentalLegalCategory,
  PublicRentalLocation,
  PublicRentalMunicipality,
} from "@/domain/public-rental";

import { MapLocationDetail } from "./map-location-detail";
import {
  CATEGORY_PRESENTATIONS,
  createLegalCategoryText,
  readMunicipalityLabel,
} from "./map-labels";
import type { MunicipalityFilter } from "./map-location-filter";

type LocationSelectionHandler = (locationId: string) => void;

export type MapLocationPanelProperties = Readonly<{
  availableCategories: readonly PublicRentalLegalCategory[];
  availableMunicipalities: readonly PublicRentalMunicipality[];
  categories: readonly PublicRentalLegalCategory[];
  clustered?: boolean;
  expanded: boolean;
  generatedAt?: string;
  locationCount?: number;
  locations: readonly PublicRentalLocation[];
  municipality: MunicipalityFilter;
  onCategoryToggle: (category: PublicRentalLegalCategory) => void;
  onExpandedToggle: () => void;
  onMunicipalityChange: (municipality: MunicipalityFilter) => void;
  onQueryChange: (query: string) => void;
  onResetFilters: () => void;
  onSelect: LocationSelectionHandler;
  query: string;
  selectedLocation: PublicRentalLocation | undefined;
  selectedLocationId: string | undefined;
  status?: "partial" | "verified";
}>;

export function MapLocationPanel(properties: MapLocationPanelProperties) {
  return (
    <aside aria-label="LH 임대주택 탐색" className={createPanelClass(properties.expanded)}>
      <PanelHeader {...properties} />
      <PanelBody {...properties} />
      <PanelAnnouncements {...properties} />
    </aside>
  );
}

function PanelHeader(properties: MapLocationPanelProperties) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
      <PanelTitle count={readLocationCount(properties)} />
      <MobileSheetToggle {...properties} />
      <SnapshotNotice generatedAt={properties.generatedAt} status={properties.status} />
    </header>
  );
}

function readLocationCount(properties: MapLocationPanelProperties) {
  if (properties.locationCount !== undefined) return properties.locationCount;
  return properties.locations.length;
}

function PanelTitle({ count }: Readonly<{ count: number }>) {
  return (
    <>
      <p className="text-xs font-semibold tracking-wide text-emerald-700">LH · 경기도</p>
      <div className="mt-1 flex items-baseline justify-between gap-3 pr-10 md:pr-0">
        <h1 className="text-lg font-bold text-slate-950">임대주택 위치</h1>
        <p className="text-sm font-medium text-slate-600">총 {count}곳</p>
      </div>
    </>
  );
}

function MobileSheetToggle(properties: MapLocationPanelProperties) {
  return (
    <button
      aria-expanded={properties.expanded}
      aria-label={createSheetToggleLabel(properties.expanded)}
      className="absolute right-4 top-3 grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 md:hidden"
      onClick={properties.onExpandedToggle}
      type="button"
    >
      {createSheetToggleSymbol(properties.expanded)}
    </button>
  );
}

function PanelBody(properties: MapLocationPanelProperties) {
  return (
    <div className={createPanelBodyClass(properties.expanded)}>
      <MapFilters {...properties} />
      <MapLocationDetail location={properties.selectedLocation} />
      <LocationList {...properties} />
    </div>
  );
}

function MapFilters(properties: MapLocationPanelProperties) {
  return (
    <section aria-label="임대주택 필터" className="border-b border-slate-200 p-4">
      <MunicipalityFilterControl {...properties} />
      <CategoryFilterControl {...properties} />
      <SearchControl {...properties} />
      <ResetFilterButton {...properties} />
    </section>
  );
}

function MunicipalityFilterControl(properties: MapLocationPanelProperties) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">시·군</p>
      <div
        aria-label="시·군 선택"
        className="mt-2 grid max-h-40 grid-cols-3 gap-1 overflow-y-auto pr-1"
        role="radiogroup"
      >
        {createMunicipalityOptions(properties)}
      </div>
    </div>
  );
}

function createMunicipalityOptions(properties: MapLocationPanelProperties) {
  const municipalities: readonly MunicipalityFilter[] = [
    "ALL",
    ...properties.availableMunicipalities,
  ];
  return municipalities.map((municipality) => (
    <MunicipalityOption
      key={municipality}
      municipality={municipality}
      onChange={properties.onMunicipalityChange}
      selected={properties.municipality === municipality}
    />
  ));
}

function MunicipalityOption(properties: {
  municipality: MunicipalityFilter;
  onChange: (municipality: MunicipalityFilter) => void;
  selected: boolean;
}) {
  return (
    <button
      aria-checked={properties.selected}
      className={createMunicipalityClass(properties.selected)}
      onClick={() => properties.onChange(properties.municipality)}
      role="radio"
      type="button"
    >
      {readMunicipalityLabel(properties.municipality)}
    </button>
  );
}

function CategoryFilterControl(properties: MapLocationPanelProperties) {
  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-semibold text-slate-600">공급유형</legend>
      <div className="mt-2 flex flex-wrap gap-2">{createCategoryOptions(properties)}</div>
    </fieldset>
  );
}

function createCategoryOptions(properties: MapLocationPanelProperties) {
  return CATEGORY_PRESENTATIONS.filter((presentation) =>
    properties.availableCategories.includes(presentation.category),
  ).map((presentation) => (
    <CategoryOption
      category={presentation.category}
      checked={properties.categories.includes(presentation.category)}
      key={presentation.category}
      label={presentation.label}
      onToggle={properties.onCategoryToggle}
    />
  ));
}

function CategoryOption(properties: {
  category: PublicRentalLegalCategory;
  checked: boolean;
  label: string;
  onToggle: (category: PublicRentalLegalCategory) => void;
}) {
  return (
    <label className={createCategoryOptionClass(properties.checked)}>
      <input
        checked={properties.checked}
        className="sr-only"
        onChange={() => properties.onToggle(properties.category)}
        type="checkbox"
      />
      {properties.label}
    </label>
  );
}

function SearchControl(properties: MapLocationPanelProperties) {
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold text-slate-600">검색</span>
      <input
        aria-label="단지명 또는 주소 검색"
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => properties.onQueryChange(readInputValue(event))}
        placeholder="단지명 또는 주소"
        type="search"
        value={properties.query}
      />
    </label>
  );
}

function ResetFilterButton(properties: MapLocationPanelProperties) {
  if (!hasActiveFilter(properties)) return null;
  return (
    <button
      className="mt-3 min-h-11 text-sm font-semibold text-slate-600 underline underline-offset-4"
      onClick={properties.onResetFilters}
      type="button"
    >
      필터 초기화
    </button>
  );
}

function LocationList(properties: MapLocationPanelProperties) {
  if (properties.locations.length === 0)
    return (
      <EmptyLocationList
        clustered={properties.clustered}
        hasResults={readLocationCount(properties) > 0}
      />
    );
  return (
    <ul aria-label="임대주택 위치 목록" className="space-y-2 p-3">
      {properties.locations.map((location) => (
        <LocationListItem
          key={location.id}
          location={location}
          onSelect={properties.onSelect}
          selected={location.id === properties.selectedLocationId}
        />
      ))}
    </ul>
  );
}

function EmptyLocationList({
  clustered,
  hasResults,
}: Readonly<{ clustered?: boolean; hasResults: boolean }>) {
  if (clustered && hasResults) return <ClusteredLocationList />;
  return (
    <div className="p-5 text-center text-sm text-slate-500">
      <p>조건에 맞는 임대주택이 없습니다.</p>
      <p className="mt-1 text-xs">도시나 공급유형 필터를 조정해 보세요.</p>
    </div>
  );
}

function ClusteredLocationList() {
  return (
    <div className="p-5 text-center text-sm text-slate-500">
      <p>지도를 확대하면 개별 주택 핀과 목록을 볼 수 있습니다.</p>
      <p className="mt-1 text-xs">숫자 핀을 선택하면 해당 영역으로 이동합니다.</p>
    </div>
  );
}

function LocationListItem(properties: {
  location: PublicRentalLocation;
  onSelect: LocationSelectionHandler;
  selected: boolean;
}) {
  return (
    <li>
      <button
        aria-label={`${properties.location.name} 선택`}
        aria-pressed={properties.selected}
        className={createLocationButtonClass(properties.selected)}
        onClick={() => properties.onSelect(properties.location.id)}
        type="button"
      >
        <LocationListItemContent location={properties.location} />
      </button>
    </li>
  );
}

function LocationListItemContent({ location }: Readonly<{ location: PublicRentalLocation }>) {
  return (
    <>
      <span className="block font-semibold text-slate-950">{location.name}</span>
      <span className="mt-1 block text-xs font-medium text-emerald-700">
        {createLegalCategoryText(location.legalCategories)}
      </span>
      <RecruitmentBadge location={location} />
      <span className="mt-1 block text-xs leading-5 text-slate-600">{location.roadAddress}</span>
    </>
  );
}

function RecruitmentBadge({ location }: Readonly<{ location: PublicRentalLocation }>) {
  if (!location.recruitmentNotices || location.recruitmentNotices.length === 0) return null;
  return <span className="mt-1 inline-block text-xs font-semibold text-amber-700">모집 중</span>;
}

function SnapshotNotice({
  generatedAt,
  status,
}: Readonly<{ generatedAt?: string; status?: "partial" | "verified" }>) {
  if (!generatedAt || !status) return null;
  if (status === "partial") return <PartialSnapshotNotice generatedAt={generatedAt} />;
  return <p className="mt-2 text-xs text-slate-500">{createSnapshotDateLabel(generatedAt)}</p>;
}

function PartialSnapshotNotice({ generatedAt }: Readonly<{ generatedAt: string }>) {
  return (
    <p className="mt-2 text-xs leading-5 text-amber-800">
      CSV 검수 중 · {createSnapshotDateLabel(generatedAt)}
    </p>
  );
}

function PanelAnnouncements(properties: MapLocationPanelProperties) {
  return (
    <div className="sr-only">
      <p aria-live="polite" role="status">
        검색 결과 {properties.locations.length}곳
      </p>
      <SelectionAnnouncement location={properties.selectedLocation} />
    </div>
  );
}

function SelectionAnnouncement({
  location,
}: Readonly<{ location: PublicRentalLocation | undefined }>) {
  if (!location) return null;
  return (
    <p aria-live="polite" role="status">
      {location.name} 선택됨
    </p>
  );
}

function createPanelClass(expanded: boolean) {
  const base =
    "absolute inset-x-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur transition-[height] md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-96 md:rounded-none";
  if (expanded) return `${base} h-[56dvh]`;
  return `${base} h-[120px]`;
}

function createPanelBodyClass(expanded: boolean) {
  const base = "min-h-0 flex-1 overflow-y-auto bg-white md:block";
  if (expanded) return base;
  return `${base} hidden`;
}

function createMunicipalityClass(selected: boolean) {
  const base = "min-h-11 rounded-lg px-2 text-sm font-semibold";
  if (selected) return `${base} bg-slate-900 text-white`;
  return `${base} bg-slate-100 text-slate-600 hover:bg-slate-200`;
}

function createCategoryOptionClass(selected: boolean) {
  const base = "cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold";
  if (selected) return `${base} border-emerald-700 bg-emerald-700 text-white`;
  return `${base} border-slate-300 bg-white text-slate-600`;
}

function createLocationButtonClass(selected: boolean) {
  const base =
    "w-full rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";
  if (selected) return `${base} border-emerald-500 bg-emerald-50`;
  return `${base} border-slate-200 bg-white hover:border-emerald-300`;
}

function createSheetToggleLabel(expanded: boolean) {
  if (expanded) return "목록 접기";
  return "목록 펼치기";
}

function createSheetToggleSymbol(expanded: boolean) {
  if (expanded) return "⌄";
  return "⌃";
}

function createSnapshotDateLabel(generatedAt: string) {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return "기준일 확인 필요";
  const formatted = date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  return `${formatted} 기준`;
}

function readInputValue(event: ChangeEvent<HTMLInputElement>) {
  return event.currentTarget.value;
}

function hasActiveFilter(properties: MapLocationPanelProperties) {
  if (properties.municipality !== "ALL") return true;
  if (properties.categories.length > 0) return true;
  return properties.query.length > 0;
}
