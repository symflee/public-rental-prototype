import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import HistoricalAnalyticsRunPage from "./page";

vi.mock("@/infrastructure/analytics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/infrastructure/analytics")>();
  return {
    ...original,
    isHistoricalLocationDetailRunReady: vi.fn(async () => true),
    readLocationDetailViewSummary: vi.fn(async () => ({
      noOpenNoticeLocationDetailViewCount: 52,
      openNoticeLocationDetailViewCount: 80,
    })),
    readLocationDetailViewBreakdown: vi.fn(async () => [
      { locationId: "30855346", noOpenCount: 0, openCount: 14, total: 14 },
      { locationId: "30699503", noOpenCount: 7, openCount: 0, total: 7 },
    ]),
  };
});

test("재구성 실행의 출처와 주택별 조회를 표시한다", async () => {
  render(await HistoricalAnalyticsRunPage());

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2026.08.11~08.14");
  expect(screen.getByText("재구성 데이터")).toBeVisible();
  expect(screen.getByRole("note")).toHaveTextContent("확인된 원자료는 전체 132건");
  expect(screen.getByText("하남미사 A13BL")).toBeVisible();
  expect(screen.getByText("금오주공2단지")).toBeVisible();
  expect(screen.getAllByText("공식 LH 공고 · 수기 연결")).toHaveLength(3);
  expect(screen.getByText("132건")).toBeVisible();
  expect(screen.getByText("52건")).toBeVisible();
  expect(screen.getByText("39.4%")).toBeVisible();
});
