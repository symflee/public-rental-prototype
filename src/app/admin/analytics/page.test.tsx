import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import AnalyticsPage from "./page";

const { readAllHomesBookmarkAddedEventCount, readAnalyticsDashboard, readExperimentFacts } =
  vi.hoisted(() => ({
    readAllHomesBookmarkAddedEventCount: vi.fn(),
    readAnalyticsDashboard: vi.fn(),
    readExperimentFacts: vi.fn(),
  }));

vi.mock("@/infrastructure/analytics", () => ({
  isAnalyticsStorageEnabled: () => true,
  isExperimentAnalyticsEnabled: () => true,
  readAllHomesBookmarkAddedEventCount,
  readAnalyticsDashboard,
  readExperimentFacts,
}));

beforeEach(() => {
  readAllHomesBookmarkAddedEventCount.mockResolvedValue(0);
  readAnalyticsDashboard.mockResolvedValue(createDashboard());
  readExperimentFacts.mockResolvedValue([]);
});

test("검토자가 지도 조회와 공고 확인 의사만 먼저 확인한다", async () => {
  render(await AnalyticsPage({ searchParams: Promise.resolve({ period: "7d" }) }));

  expect(screen.getByRole("heading", { name: "핵심 검증 지표" })).toBeVisible();
  expect(screen.getByText("지도 조회수")).toBeVisible();
  expect(screen.getByText("페이크 도어 테스트")).toBeVisible();
  expect(screen.getByText("공고 확인해보기를 누른 횟수입니다.")).toBeVisible();
  expect(readPrimaryMetrics().getByText("3")).toBeVisible();
  expect(readPrimaryMetrics().queryByText("실제 공고 열람 클릭 수")).not.toBeInTheDocument();
});

test("실제 공고 열람 통계는 하단 상세 통계에 표시한다", async () => {
  render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("heading", { name: "상세 통계" })).toBeVisible();
  expect(screen.getByText("실제 공고 열람 클릭 수")).toBeVisible();
  expect(screen.getByText("모집 중 공고의 공식 상세 페이지로 이동한 횟수입니다.")).toBeVisible();
  expect(screen.getByText("조회수 대비 공고 확인 행동률")).toBeVisible();
  expect(screen.getByText("단지별 공고 확인해보기 클릭 수")).toBeVisible();
});

test("비모집 주택 실험의 고유 방문자 전환과 표본 판정을 표시한다", async () => {
  readAllHomesBookmarkAddedEventCount.mockResolvedValue(7);
  readExperimentFacts.mockResolvedValue(createExperimentFacts());

  render(await AnalyticsPage({ searchParams: Promise.resolve({ period: "30d" }) }));

  expect(screen.getByRole("heading", { name: "비모집 임대주택 탐색과 북마크" })).toBeVisible();
  expect(screen.getByText("자격 방문자")).toBeVisible();
  expect(readExperimentMetric("북마크 고유 사용자율").getByText("100.0%")).toBeVisible();
  expect(readExperimentMetric("북마크 등록 횟수").getByText("7")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("판정 보류");
  expect(readExperimentFacts).toHaveBeenCalledWith(
    expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    "whole-housing-bookmark-v1",
  );
  expect(readAllHomesBookmarkAddedEventCount).toHaveBeenCalledWith(
    expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    "whole-housing-bookmark-v1",
  );
});

function readPrimaryMetrics() {
  const heading = screen.getByRole("heading", { name: "핵심 검증 지표" });
  return within(heading.closest("section") as HTMLElement);
}

function readExperimentMetric(label: string) {
  const term = screen.getByText(label);
  return within(term.closest("div") as HTMLElement);
}

function createDashboard() {
  return {
    announcementActionCount: 6,
    announcementActionRate: 60,
    announcementInterestCount: 3,
    announcementOpenCount: 3,
    announcementRanks: [],
    locationRanks: [],
    pageViewCount: 10,
  };
}

function createExperimentFacts() {
  return [
    createExperimentFact("EXPERIMENT_ELIGIBLE", "SITE", "all"),
    createExperimentFact("BOOKMARK_ADDED", "LOCATION", "location-a"),
  ];
}

function createExperimentFact(eventKind: string, subjectKind: string, subjectId: string) {
  return {
    eventKind,
    experimentKey: "whole-housing-bookmark-v1",
    metricDate: "2026-08-14",
    subjectId,
    subjectKind,
    variant: "ALL_HOMES",
    visitorHash: "visitor-a",
  };
}
