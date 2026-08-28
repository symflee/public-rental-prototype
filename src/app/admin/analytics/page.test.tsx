import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import AnalyticsPage from "./page";

const mocks = vi.hoisted(() => ({
  isAnalyticsStorageEnabled: vi.fn(() => true),
  readAnalyticsDashboard: vi.fn(),
}));

vi.mock("@/infrastructure/analytics", () => mocks);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAnalyticsStorageEnabled.mockReturnValue(true);
  mocks.readAnalyticsDashboard.mockResolvedValue(createDashboard());
});

test("일반 서비스 이용 지표와 주택 정보 조회 카드 세 개를 표시한다", async () => {
  await renderAnalyticsPage();

  expect(screen.getByRole("heading", { level: 1, name: "서비스 이용 지표" })).toBeVisible();
  const section = readSection("주택 정보 조회");
  expect(readMetric(section, "전체 주택 정보 조회")).toHaveTextContent("132건");
  expect(readMetric(section, "공고 중이 아닌 주택 조회")).toHaveTextContent("52건");
  expect(readMetric(section, "공고 중이 아닌 주택 조회 비율")).toHaveTextContent("39.4%");
});

test("기존 비북마크 이용 지표와 단지별 순위를 유지한다", async () => {
  await renderAnalyticsPage();

  const section = readSection("서비스 이용 현황");
  expect(readMetric(section, "지도 조회수")).toHaveTextContent("10");
  expect(readMetric(section, "공식 공고 열람")).toHaveTextContent("3");
  expect(readMetric(section, "공고 확인해보기")).toHaveTextContent("3");
  expect(readMetric(section, "조회수 대비 공고 확인 행동률")).toHaveTextContent("60.0%");
  expect(screen.getByRole("heading", { name: "단지별 공고 확인해보기 클릭 수" })).toBeVisible();
  expect(screen.getByText("location-a")).toBeVisible();
});

test("날짜 필터를 유지하고 선택 범위로 대시보드를 조회한다", async () => {
  await renderAnalyticsPage({ from: "2026-08-01", to: "2026-08-07" });

  expectPresetLinks();
  expectDateInputs();
  expectRangeQuery();
});

function expectPresetLinks() {
  expect(screen.getByRole("link", { name: "최근 7일" })).toHaveAttribute(
    "href",
    "/admin/analytics?period=7d",
  );
  expect(screen.getByRole("link", { name: "최근 30일" })).toHaveAttribute(
    "href",
    "/admin/analytics?period=30d",
  );
  expect(screen.getByRole("link", { name: "이번 달" })).toHaveAttribute(
    "href",
    "/admin/analytics?period=month",
  );
}

function expectDateInputs() {
  expect(screen.getByLabelText("시작일")).toHaveValue("2026-08-01");
  expect(screen.getByLabelText("종료일")).toHaveValue("2026-08-07");
}

function expectRangeQuery() {
  expect(mocks.readAnalyticsDashboard).toHaveBeenCalledWith({
    from: "2026-08-01",
    to: "2026-08-07",
  });
}

test("과거 dataset 쿼리도 일반 날짜 필터와 서비스 이용 현황으로 통합한다", async () => {
  await renderAnalyticsPage({ dataset: "history", from: "2026-08-11", to: "2026-08-14" });

  expect(screen.getByLabelText("시작일")).toHaveValue("2026-08-11");
  expect(screen.getByLabelText("종료일")).toHaveValue("2026-08-14");
  expect(screen.getByRole("heading", { name: "서비스 이용 현황" })).toBeVisible();
  expect(screen.queryByText("8월 11~14일 재구성")).not.toBeInTheDocument();
  expect(mocks.readAnalyticsDashboard).toHaveBeenCalledWith({
    from: "2026-08-11",
    to: "2026-08-14",
  });
});

test("상세 조회 원본 테이블 장애를 정상 지표로 위장하지 않는다", async () => {
  mocks.readAnalyticsDashboard.mockRejectedValue(new Error("missing table"));

  await renderAnalyticsPage();

  expect(screen.getByRole("heading", { name: "분석 데이터를 불러오지 못했습니다" })).toBeVisible();
  expect(screen.queryByText("132건")).not.toBeInTheDocument();
});

test("연결된 화면에서 실험·북마크·판정과 설명 문단을 제거한다", async () => {
  await renderAnalyticsPage();
  const main = screen.getByRole("main");

  expect(within(main).queryByText(/가설|북마크|판정|신뢰 하한/u)).not.toBeInTheDocument();
  expect(within(main).queryByRole("alert")).not.toBeInTheDocument();
  expect(within(main).queryByRole("status")).not.toBeInTheDocument();
  expect(main.querySelector("p")).toBeNull();
});

test("분석 저장소가 없으면 연결 안내를 유지한다", async () => {
  mocks.isAnalyticsStorageEnabled.mockReturnValue(false);
  await renderAnalyticsPage();

  expect(screen.getByRole("heading", { name: "분석 저장소를 연결해 주세요" })).toBeVisible();
  expect(screen.getByText(/DATABASE_URL 또는 POSTGRES_URL/u)).toBeVisible();
  expect(mocks.readAnalyticsDashboard).not.toHaveBeenCalled();
});

type SearchParameters = Readonly<{
  dataset?: string;
  from?: string;
  period?: string;
  to?: string;
}>;

async function renderAnalyticsPage(searchParameters: SearchParameters = {}) {
  const page = await AnalyticsPage({ searchParams: Promise.resolve(searchParameters) });
  return render(page);
}

function readSection(title: string) {
  const heading = screen.getByRole("heading", { name: title });
  return within(heading.closest("section") as HTMLElement);
}

function readMetric(section: ReturnType<typeof within>, label: string) {
  const term = section.getByText(label);
  return term.closest("div") as HTMLElement;
}

function createDashboard() {
  return {
    announcementActionCount: 6,
    announcementActionRate: 60,
    announcementInterestCount: 3,
    announcementOpenCount: 3,
    announcementRanks: [],
    locationDetailViewCount: 132,
    locationRanks: [{ subjectId: "location-a", total: 2 }],
    noOpenNoticeLocationDetailViewCount: 52,
    noOpenNoticeLocationDetailViewRate: (52 / 132) * 100,
    pageViewCount: 10,
  };
}
