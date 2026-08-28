import { beforeEach, expect, test, vi } from "vitest";

import { ManualRecruitmentNotFoundError } from "@/infrastructure/manual-recruitment";

import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  isAnalyticsAdministrator: vi.fn(() => true),
  revokeManualRecruitmentNotice: vi.fn(async () => undefined),
}));

vi.mock("@/infrastructure/analytics", () => ({
  isAnalyticsAdministrator: mocks.isAnalyticsAdministrator,
}));

vi.mock("@/infrastructure/manual-recruitment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/manual-recruitment")>()),
  revokeManualRecruitmentNotice: mocks.revokeManualRecruitmentNotice,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAnalyticsAdministrator.mockReturnValue(true);
  mocks.revokeManualRecruitmentNotice.mockResolvedValue(undefined);
});

test("관리자가 활성 공고를 철회한다", async () => {
  const response = await DELETE(createRequest(), createContext("20853"));

  expect(response.status).toBe(204);
  expect(mocks.revokeManualRecruitmentNotice).toHaveBeenCalledWith("20853");
});

test("없는 공고와 DB 실패를 구분한다", async () => {
  mocks.revokeManualRecruitmentNotice.mockRejectedValueOnce(new ManualRecruitmentNotFoundError());
  mocks.revokeManualRecruitmentNotice.mockRejectedValueOnce(new Error("database secret"));

  const missing = await DELETE(createRequest(), createContext("missing"));
  const databaseFailure = await DELETE(createRequest(), createContext("20853"));

  expect(missing.status).toBe(404);
  expect(databaseFailure.status).toBe(503);
});

test("인증이 없거나 식별자가 비어 있으면 철회하지 않는다", async () => {
  mocks.isAnalyticsAdministrator.mockReturnValue(false);
  const unauthorized = await DELETE(createRequest(), createContext("20853"));
  mocks.isAnalyticsAdministrator.mockReturnValue(true);
  const invalid = await DELETE(createRequest(), createContext(" "));

  expect(unauthorized.status).toBe(401);
  expect(invalid.status).toBe(400);
  expect(mocks.revokeManualRecruitmentNotice).not.toHaveBeenCalled();
});

test("다른 출처의 철회 요청을 거절한다", async () => {
  const request = createRequest();
  request.headers.set("Origin", "https://malicious.example");

  const response = await DELETE(request, createContext("20853"));

  expect(response.status).toBe(403);
  expect(mocks.revokeManualRecruitmentNotice).not.toHaveBeenCalled();
});

function createRequest() {
  return new Request("http://localhost/api/admin/recruitment-notices/20853", {
    headers: { Authorization: "Basic credential" },
    method: "DELETE",
  });
}

function createContext(noticeId: string) {
  return { params: Promise.resolve({ noticeId }) };
}
