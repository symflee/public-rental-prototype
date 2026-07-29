import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import AnalyticsPage from "./page";

const { readAnalyticsDashboard } = vi.hoisted(() => ({ readAnalyticsDashboard: vi.fn() }));

vi.mock("@/infrastructure/analytics", () => ({
  isAnalyticsStorageEnabled: () => true,
  readAnalyticsDashboard,
}));

test("검토자가 먼저 확인할 세 가지 지표를 상단에 표시한다", async () => {
  readAnalyticsDashboard.mockResolvedValue(createDashboard());

  render(await AnalyticsPage({ searchParams: Promise.resolve({ period: "7d" }) }));

  expect(screen.getByRole("heading", { name: "핵심 검증 지표" })).toBeVisible();
  expect(screen.getByText("지도 조회수")).toBeVisible();
  expect(screen.getByText("페이크 도어 테스트")).toBeVisible();
  expect(screen.getByText("실제 공고 열람 클릭 수")).toBeVisible();
});

test("보조 통계는 하단 상세 통계 영역에 유지한다", async () => {
  readAnalyticsDashboard.mockResolvedValue(createDashboard());

  render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("heading", { name: "상세 통계" })).toBeVisible();
  expect(screen.getByText("총 공고 확인 행동 수")).toBeVisible();
  expect(screen.getByText("조회수 대비 공고 확인 행동률")).toBeVisible();
});

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
