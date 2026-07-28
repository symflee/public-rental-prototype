import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";
import { renderKakaoMap } from "@/infrastructure/kakao/kakao-map-sdk";

import { KakaoMap } from "./kakao-map";

vi.mock("@/infrastructure/kakao/kakao-map-sdk", () => ({
  renderKakaoMap: vi.fn(),
}));

const renderKakaoMapMock = vi.mocked(renderKakaoMap);
const controller = {
  destroy: vi.fn(),
  fitMarkers: vi.fn(),
  focusMarker: vi.fn(),
  readVisibleLocationIds: vi.fn<() => readonly string[]>(),
  relayout: vi.fn(),
  replaceMarkers: vi.fn(),
  selectMarker: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
};

const LOCATIONS = [
  createLocation({
    categories: ["NATIONAL_RENTAL"],
    district: "분당구",
    householdCount: 500,
    id: "lh:seongnam:one",
    municipality: "SEONGNAM",
    name: "판교 국민임대",
    roadAddress: "경기도 성남시 분당구 판교로 123",
  }),
  createLocation({
    categories: ["HAPPY_HOUSING"],
    district: "기흥구",
    householdCount: 70,
    id: "lh:yongin:two",
    municipality: "YONGIN",
    name: "용인 행복주택",
    roadAddress: "경기도 용인시 기흥구 동백로 45",
  }),
  createLocation({
    categories: ["PERMANENT_RENTAL", "NATIONAL_RENTAL"],
    district: "수정구",
    householdCount: 120,
    id: "lh:seongnam:three",
    municipality: "SEONGNAM",
    name: "성남 복합임대",
    roadAddress: "경기도 성남시 수정구 산성대로 10",
  }),
] as const;

beforeEach(() => {
  renderKakaoMapMock.mockResolvedValue(controller as never);
  controller.readVisibleLocationIds.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

test("키가 없어도 성남·용인 위치 목록과 설정 안내를 표시한다", () => {
  render(<KakaoMap locations={LOCATIONS} />);

  expect(screen.getByRole("alert")).toHaveTextContent("카카오맵 키가 설정되지 않았습니다.");
  expect(screen.getByRole("complementary", { name: "LH 임대주택 탐색" })).toBeVisible();
  expect(screen.getByText("총 3곳")).toBeVisible();
  expect(renderKakaoMapMock).not.toHaveBeenCalled();
});

test("좌표가 있는 위치를 카테고리 정보와 동일한 위치 ID의 마커로 만든다", async () => {
  render(<KakaoMap javascriptKey=" javascript-key " locations={LOCATIONS} />);

  await waitForMapReady();
  const markers = readRenderedMarkers();
  expect(markers).toHaveLength(3);
  expect(markers[0]).toMatchObject({
    categories: ["NATIONAL_RENTAL"],
    locationId: "lh:seongnam:one",
    title: "판교 국민임대",
  });
  await waitFor(() => expect(controller.fitMarkers).toHaveBeenCalled());
});

test("복합 위치 마커에 유형별 데스크톱 상세 행을 전달한다", async () => {
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);

  await waitForMapReady();
  expect(readRenderedMarkers()[2]?.detail).toEqual({
    address: "경기도 성남시 수정구 산성대로 10",
    rows: [
      {
        areaText: "46.20㎡",
        categoryLabel: "영구임대",
        householdText: "120세대",
      },
      {
        areaText: "면적 정보 없음",
        categoryLabel: "국민임대",
        householdText: "세대수 정보 없음",
      },
    ],
  });
});

test("SDK가 준비될 때까지 로딩 상태를 표시한다", () => {
  renderKakaoMapMock.mockReturnValue(new Promise(() => undefined));

  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);

  expect(screen.getByText("지도를 불러오는 중…")).toBeVisible();
  expect(readMapRegion()).toHaveAttribute("aria-busy", "true");
});

test("SDK를 불러오지 못하면 설정 확인 사항을 안내한다", async () => {
  renderKakaoMapMock.mockRejectedValue(new Error("SDK load failed"));

  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);

  await waitFor(() => expect(readMapRegion()).toHaveAttribute("data-map-state", "error"));
  expect(screen.getByRole("alert")).toHaveTextContent("등록 도메인과 API 사용 설정");
});

test("지도 화면을 닫으면 컨트롤러 이벤트와 마커를 정리한다", async () => {
  const view = render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();

  view.unmount();

  expect(controller.destroy).toHaveBeenCalledOnce();
});

test("도시를 선택하면 해당 도시의 목록과 마커만 안정적으로 남긴다", async () => {
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();

  fireEvent.click(screen.getByRole("radio", { name: "용인" }));

  expect(screen.getByText("총 1곳")).toBeVisible();
  expect(screen.getByRole("button", { name: "용인 행복주택 선택" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "판교 국민임대 선택" })).not.toBeInTheDocument();
  await waitFor(() => expect(readLatestReplacementIdentifiers()).toEqual(["lh:yongin:two"]));
});

test("공급유형은 여러 개를 선택할 수 있고 선택 유형 중 하나라도 있는 위치를 찾는다", async () => {
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();

  fireEvent.click(screen.getByRole("checkbox", { name: "행복주택" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "영구임대" }));

  expect(screen.getByText("총 2곳")).toBeVisible();
  expect(screen.getByRole("button", { name: "용인 행복주택 선택" })).toBeVisible();
  expect(screen.getByRole("button", { name: "성남 복합임대 선택" })).toBeVisible();
});

test("단지명과 주소 검색을 공백에 영향받지 않고 수행한다", () => {
  render(<KakaoMap locations={LOCATIONS} />);

  fireEvent.change(screen.getByRole("searchbox", { name: "단지명 또는 주소 검색" }), {
    target: { value: "동 백 로" },
  });

  expect(screen.getByText("총 1곳")).toBeVisible();
  expect(screen.getByRole("button", { name: "용인 행복주택 선택" })).toBeVisible();
});

test("결과가 없을 때 안내하고 필터 초기화로 전체 목록을 복원한다", () => {
  render(<KakaoMap locations={LOCATIONS} />);

  fireEvent.click(screen.getByRole("radio", { name: "용인" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "국민임대" }));

  expect(screen.getByText("조건에 맞는 임대주택이 없습니다.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
  expect(screen.getByText("총 3곳")).toBeVisible();
});

test("지도 이동 뒤 현재 영역 후보를 명시적으로 적용할 때만 목록을 좁힌다", async () => {
  controller.readVisibleLocationIds.mockReturnValue(["lh:seongnam:three"]);
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();

  act(readViewportChanged);

  expect(screen.getByText("총 3곳")).toBeVisible();
  const applyButton = screen.getByRole("button", { name: "이 지도 영역에서 보기 · 1곳" });
  fireEvent.click(applyButton);

  expect(screen.getByText("총 1곳")).toBeVisible();
  expect(screen.getByRole("button", { name: "성남 복합임대 선택" })).toBeVisible();
  expect(controller.fitMarkers).not.toHaveBeenCalledTimes(2);
});

test("전체 위치 보기로 지도 영역 제한을 해제하고 결과에 맞춘다", async () => {
  controller.readVisibleLocationIds.mockReturnValue(["lh:seongnam:three"]);
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();
  act(readViewportChanged);
  fireEvent.click(screen.getByRole("button", { name: "이 지도 영역에서 보기 · 1곳" }));

  fireEvent.click(screen.getByRole("button", { name: "전체 위치 보기" }));

  expect(screen.getByText("총 3곳")).toBeVisible();
  await waitFor(() => expect(controller.fitMarkers).toHaveBeenCalledTimes(2));
});

test("목록을 선택하면 지도 핀과 상세를 같은 위치 ID로 연결한다", async () => {
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();

  fireEvent.click(screen.getByRole("button", { name: "판교 국민임대 선택" }));

  expect(controller.selectMarker).toHaveBeenLastCalledWith("lh:seongnam:one");
  expect(controller.focusMarker).toHaveBeenCalledWith("lh:seongnam:one", expect.any(Object));
  expect(readDetail()).toHaveTextContent("판교 국민임대");
  expect(readDetail()).toHaveTextContent("500세대");
  expect(readDetail()).toHaveTextContent("46.20㎡");
});

test("지도 핀을 선택하면 목록과 상세의 같은 위치가 선택된다", async () => {
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();
  const marker = readRenderedMarkers()[1];

  act(() => marker?.onClick?.("lh:yongin:two"));

  expect(screen.getByRole("button", { name: "용인 행복주택 선택" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(readDetail()).toHaveTextContent("용인 행복주택");
});

test("확대·축소 컨트롤과 공급유형 범례를 제공한다", async () => {
  render(<KakaoMap javascriptKey="javascript-key" locations={LOCATIONS} />);
  await waitForMapReady();

  fireEvent.click(screen.getByRole("button", { name: "지도 확대" }));
  fireEvent.click(screen.getByRole("button", { name: "지도 축소" }));

  expect(controller.zoomIn).toHaveBeenCalledOnce();
  expect(controller.zoomOut).toHaveBeenCalledOnce();
  expect(screen.getByRole("list", { name: "공급유형 범례" })).toHaveTextContent("국민임대");
  expect(screen.getByRole("list", { name: "공급유형 범례" })).toHaveTextContent("매입임대");
});

test("모바일 목록 시트를 펼치고 접을 수 있다", () => {
  render(<KakaoMap locations={LOCATIONS} />);
  const toggleButton = screen.getByRole("button", { name: "목록 펼치기" });

  fireEvent.click(toggleButton);

  expect(screen.getByRole("button", { name: "목록 접기" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("검색 결과와 선택 변경을 보조기기에 알린다", () => {
  render(<KakaoMap locations={LOCATIONS} />);

  fireEvent.click(screen.getByRole("button", { name: "판교 국민임대 선택" }));

  const announcements = screen.getAllByRole("status");
  expect(announcements.some((element) => element.textContent === "검색 결과 3곳")).toBe(true);
  expect(announcements.some((element) => element.textContent === "판교 국민임대 선택됨")).toBe(
    true,
  );
});

function createLocation(input: {
  categories: PublicRentalLocation["legalCategories"];
  district: string;
  householdCount: number;
  id: string;
  municipality: "SEONGNAM" | "YONGIN";
  name: string;
  roadAddress: string;
}) {
  const coordinate = readCoordinate(input.municipality);
  return {
    addressAliases: [],
    completionDate: "2020-01-31",
    coordinate,
    district: input.district,
    householdCount: input.householdCount,
    id: input.id,
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories: input.categories,
    municipality: input.municipality,
    name: input.name,
    offerings: [
      {
        commonAreaSquareMeters: null,
        depositWon: null,
        exclusiveAreaSquareMeters: 46.2,
        householdCount: input.householdCount,
        legalCategory: input.categories[0],
        monthlyRentWon: null,
        sourceId: `${input.id}:offering`,
        styleName: "46",
        supplyAreaSquareMeters: 46.2,
        supplyTypeName: "테스트 임대",
      },
    ],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    roadAddress: input.roadAddress,
    sourceRecords: [
      {
        referenceDate: "2025-09-18",
        source: "MY_HOME_PUBLIC_RENTAL_API",
        sourceId: input.id,
        sourceUrl: "https://www.data.go.kr/",
      },
    ],
  } as unknown as PublicRentalLocation;
}

function readCoordinate(municipality: "SEONGNAM" | "YONGIN") {
  if (municipality === "SEONGNAM") {
    return { latitude: 37.4, longitude: 127.11, source: "KAKAO_ADDRESS_SEARCH" };
  }
  return { latitude: 37.27, longitude: 127.12, source: "KAKAO_ADDRESS_SEARCH" };
}

async function waitForMapReady() {
  await waitFor(() => expect(readMapRegion()).toHaveAttribute("data-map-state", "ready"));
}

function readMapRegion() {
  return screen.getByRole("region", { name: /임대주택 지도/ });
}

function readRenderedMarkers() {
  return renderKakaoMapMock.mock.calls[0]?.[3] ?? [];
}

function readLatestReplacementIdentifiers() {
  const calls = controller.replaceMarkers.mock.calls;
  const latest = calls[calls.length - 1]?.[0] ?? [];
  return latest.map((marker: { locationId: string }) => marker.locationId);
}

function readViewportChanged() {
  const configuration = renderKakaoMapMock.mock.calls[0]?.[2] as {
    onViewportChanged?: () => void;
  };
  configuration.onViewportChanged?.();
}

function readDetail() {
  return screen.getByRole("region", { name: "선택한 임대주택 상세" });
}
