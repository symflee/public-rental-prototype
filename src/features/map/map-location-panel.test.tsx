import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

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
