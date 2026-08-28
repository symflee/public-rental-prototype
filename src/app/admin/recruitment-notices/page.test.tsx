import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import ManualRecruitmentNoticesPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/infrastructure/manual-recruitment", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/infrastructure/manual-recruitment")>();
  return {
    ...original,
    isManualRecruitmentStorageEnabled: vi.fn(() => true),
    readActiveManualRecruitmentNotices: vi.fn(async () => [
      original.HISTORICAL_MANUAL_RECRUITMENT_NOTICES[0],
    ]),
  };
});

test("공고 기간과 연결 주택을 입력하고 활성 수기 공고를 확인한다", async () => {
  render(await ManualRecruitmentNoticesPage());

  expect(screen.getByRole("heading", { level: 1, name: "수기 모집공고 관리" })).toBeVisible();
  expect(screen.getByLabelText("공고 식별자")).toBeRequired();
  expect(screen.getByLabelText("모집 시작")).toBeRequired();
  expect(screen.getByLabelText("모집 종료")).toBeRequired();
  expect(screen.getByLabelText("연결할 주택 ID")).toBeRequired();
  expect(screen.getByText(/하남감일8단지/u)).toBeVisible();
  expect(screen.getByText("하남미사 A13BL, 하남감일 8단지(국민, 영구)A3블록")).toBeVisible();
  expect(screen.getByRole("button", { name: "연결 해제" })).toBeVisible();
});
