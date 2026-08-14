import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import type {
  ExperimentDashboard,
  ExperimentDecisionStatus,
} from "@/domain/announcement-analytics";

import { ExperimentDashboardSection } from "./experiment-dashboard-section";

test("표본이 부족하면 관측률과 신뢰 하한을 보여주면서 판정을 보류한다", () => {
  renderSection(createDashboard());

  const decision = screen.getByRole("status");
  expect(decision).toHaveTextContent("판정 보류");
  expect(decision).toHaveTextContent("253명 중 100명");
  expect(readMetric("관측 북마크 전환율").getByText("20.0%")).toBeVisible();
  expect(readMetric("단측 95% 신뢰 하한").getByText("14.0%")).toBeVisible();
});

test("고유 방문자 퍼널과 위치별 북마크 순위를 표시한다", () => {
  renderSection(createDashboard());

  expect(screen.getByText("자격 방문자")).toBeVisible();
  expect(screen.getByText("비모집 주택 상세 조회")).toBeVisible();
  expect(readMetric("북마크 고유 사용자율").getByText("20.0%")).toBeVisible();
  expect(readMetric("북마크 고유 사용자율").getByText(/방문자당 1회 집계/u)).toBeVisible();
  expect(readMetric("북마크 등록 횟수").getByText("37")).toBeVisible();
  expect(
    readMetric("북마크 등록 횟수").getByText(/반복 추가를 포함한 원시 이벤트 수/u),
  ).toBeVisible();
  expect(screen.getByText("상세 조회 후 북마크")).toBeVisible();
  const ranking = screen.getByRole("heading", { name: "위치별 북마크 방문자 순위" });
  expect(within(ranking.closest("section") as HTMLElement).getByText("행복주택 A")).toBeVisible();
});

test("표본 충족 후 관측률로 성공과 목표 미달을 구분한다", () => {
  const success = createDecidedDashboard("SUCCESS", 10);
  const { rerender } = render(createSection(success));
  expect(screen.getByRole("status")).toHaveTextContent("성공");

  const belowTarget = createDecidedDashboard("BELOW_TARGET", 9.9);
  rerender(createSection(belowTarget));
  expect(screen.getByRole("status")).toHaveTextContent("목표 미달");
});

test("신규 실험 계측이 비활성화되면 설정 경고를 표시한다", () => {
  render(createSection(createDashboard(), false));

  expect(screen.getByRole("alert")).toHaveTextContent("신규 실험 계측이 중지되었습니다");
});

function createDashboard(): ExperimentDashboard {
  return {
    bookmarkAddCount: 37,
    bookmarkRanks: [{ subjectId: "location-a", total: 12 }],
    bookmarkRate: 20,
    bookmarkVisitorCount: 20,
    decision: createInsufficientDecision(),
    detailToBookmarkRate: 40,
    eligibleVisitorCount: 100,
    noOpenDetailRate: 50,
    noOpenDetailVisitorCount: 50,
  };
}

function createInsufficientDecision() {
  return {
    confidenceLowerBound: 14,
    minimumSampleSize: 253,
    observedRate: 20,
    sampleSize: 100,
    status: "INSUFFICIENT_SAMPLE" as const,
    targetRate: 10,
  };
}

function createDecidedDashboard(status: ExperimentDecisionStatus, observedRate: number) {
  return {
    ...createDashboard(),
    decision: {
      ...createDashboard().decision,
      observedRate,
      sampleSize: 253,
      status,
    },
  };
}

function readLabel(locationId: string) {
  if (locationId === "location-a") return "행복주택 A";
  return locationId;
}

function readMetric(label: string) {
  const term = screen.getByText(label);
  return within(term.closest("div") as HTMLElement);
}

function renderSection(dashboard: ExperimentDashboard) {
  return render(createSection(dashboard));
}

function createSection(dashboard: ExperimentDashboard, trackingEnabled = true) {
  return (
    <ExperimentDashboardSection
      dashboard={dashboard}
      readLocationLabel={readLabel}
      trackingEnabled={trackingEnabled}
    />
  );
}
