import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import { MapLocationPanel } from "./map-location-panel";

test("클러스터 상태라도 필터 결과가 없으면 빈 결과 안내를 표시한다", () => {
  render(<MapLocationPanel {...createProperties()} clustered locationCount={0} locations={[]} />);

  expect(screen.getByText("조건에 맞는 임대주택이 없습니다.")).toBeVisible();
});

function createProperties() {
  return {
    availableCategories: [],
    availableMunicipalities: [],
    categories: [],
    expanded: true,
    municipality: "ALL" as const,
    onCategoryToggle: vi.fn(),
    onExpandedToggle: vi.fn(),
    onMunicipalityChange: vi.fn(),
    onQueryChange: vi.fn(),
    onResetFilters: vi.fn(),
    onSelect: vi.fn(),
    query: "없는 단지",
    selectedLocation: undefined,
    selectedLocationId: undefined,
  };
}

test("클러스터에 결과가 있으면 확대 안내를 표시한다", () => {
  render(<MapLocationPanel {...createProperties()} clustered locationCount={1} locations={[]} />);

  expect(screen.getByText("지도를 확대하면 개별 주택 핀과 목록을 볼 수 있습니다.")).toBeVisible();
});

test("저장한 주택 필터와 목록의 저장 상태를 표시한다", () => {
  const location: PublicRentalLocation = {
    addressAliases: [],
    completionDate: null,
    coordinate: null,
    district: "수정구",
    householdCount: null,
    id: "location-one",
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories: [],
    municipality: "SEONGNAM",
    name: "저장한 주택",
    offerings: [],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    recruitmentNotices: [],
    roadAddress: "경기도 성남시",
    sourceRecords: [],
  };
  const onBookmarkedOnlyChange = vi.fn();
  render(
    <MapLocationPanel
      {...createProperties()}
      bookmarkedLocationIds={[location.id]}
      bookmarkedOnly={false}
      locations={[location]}
      onBookmarkedOnlyChange={onBookmarkedOnlyChange}
    />,
  );

  expect(screen.getByText("저장됨")).toBeVisible();
  expect(screen.getByText("수집 시 모집공고 없음")).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: "저장한 주택만 보기" }));
  expect(onBookmarkedOnlyChange).toHaveBeenCalledWith(true);
});

test("오래된 스냅샷이면 모집 상태 갱신 필요를 알린다", () => {
  render(
    <MapLocationPanel
      {...createProperties()}
      generatedAt="2020-01-01T00:00:00.000Z"
      locations={[]}
      status="verified"
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("모집 상태 갱신 필요");
});
