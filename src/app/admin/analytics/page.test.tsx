import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import AnalyticsPage from "./page";

const { readAnalyticsDashboard } = vi.hoisted(() => ({ readAnalyticsDashboard: vi.fn() }));

vi.mock("@/infrastructure/analytics", () => ({
  isAnalyticsStorageEnabled: () => true,
  readAnalyticsDashboard,
}));

test("검토자가 지도 조회와 공고 확인 의사만 먼저 확인한다", async () => {
  readAnalyticsDashboard.mockResolvedValue(createDashboard());

  render(await AnalyticsPage({ searchParams: Promise.resolve({ period: "7d" }) }));

  expect(screen.getByRole("heading", { name: "핵심 검증 지표" })).toBeVisible();
  expect(screen.getByText("지도 조회수")).toBeVisible();
  expect(screen.getByText("페이크 도어 테스트")).toBeVisible();
  expect(screen.getByText("공고 확인해보기를 누른 횟수입니다.")).toBeVisible();
  expect(readPrimaryMetrics().getByText("3")).toBeVisible();
  expect(readPrimaryMetrics().queryByText("실제 공고 열람 클릭 수")).not.toBeInTheDocument();
});

test("실제 공고 열람 통계는 하단 상세 통계에 표시한다", async () => {
  readAnalyticsDashboard.mockResolvedValue(createDashboard());

  render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("heading", { name: "상세 통계" })).toBeVisible();
  expect(screen.getByText("실제 공고 열람 클릭 수")).toBeVisible();
  expect(screen.getByText("모집 중 공고의 공식 상세 페이지로 이동한 횟수입니다.")).toBeVisible();
  expect(screen.getByText("조회수 대비 공고 확인 행동률")).toBeVisible();
  expect(screen.getByText("단지별 공고 확인해보기 클릭 수")).toBeVisible();
});

function readPrimaryMetrics() {
  const heading = screen.getByRole("heading", { name: "핵심 검증 지표" });
  return within(heading.closest("section") as HTMLElement);
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
