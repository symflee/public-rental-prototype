import { beforeEach, expect, test, vi } from "vitest";

import {
  ManualRecruitmentConflictError,
  ManualRecruitmentValidationError,
} from "@/infrastructure/manual-recruitment";

import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  appendManualRecruitmentNotice: vi.fn(),
  isAnalyticsAdministrator: vi.fn(() => true),
  readActiveManualRecruitmentNotices: vi.fn(),
}));

vi.mock("@/infrastructure/analytics", () => ({
  isAnalyticsAdministrator: mocks.isAnalyticsAdministrator,
}));

vi.mock("@/infrastructure/manual-recruitment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/manual-recruitment")>()),
  appendManualRecruitmentNotice: mocks.appendManualRecruitmentNotice,
  readActiveManualRecruitmentNotices: mocks.readActiveManualRecruitmentNotices,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAnalyticsAdministrator.mockReturnValue(true);
  mocks.readActiveManualRecruitmentNotices.mockResolvedValue([]);
});

test("관리자만 활성 수기 공고를 조회한다", async () => {
  const response = await GET(createRequest("GET"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ notices: [] });
  expect(response.headers.get("cache-control")).toBe("no-store");
});

test("인증이 없으면 관리자 공고 API를 거절한다", async () => {
  mocks.isAnalyticsAdministrator.mockReturnValue(false);

  const response = await GET(createRequest("GET"));

  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain("Basic");
  expect(mocks.readActiveManualRecruitmentNotices).not.toHaveBeenCalled();
});

test("검증된 수기 공고를 추가한다", async () => {
  const notice = { id: "20853", locationIds: ["30855346"] };
  mocks.appendManualRecruitmentNotice.mockResolvedValue(notice);

  const response = await POST(createRequest("POST", notice));

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ notice });
  expect(mocks.appendManualRecruitmentNotice).toHaveBeenCalledWith(notice);
});

test("잘못된 입력과 중복 공고를 구분한다", async () => {
  mocks.appendManualRecruitmentNotice.mockRejectedValueOnce(
    new ManualRecruitmentValidationError("입력 오류"),
  );
  mocks.appendManualRecruitmentNotice.mockRejectedValueOnce(new ManualRecruitmentConflictError());

  const invalid = await POST(createRequest("POST", {}));
  const duplicate = await POST(createRequest("POST", {}));

  expect(invalid.status).toBe(400);
  expect(duplicate.status).toBe(409);
});

test("JSON 또는 DB 처리 실패를 안전한 응답으로 바꾼다", async () => {
  const invalidJson = await POST(createRawRequest("{"));
  mocks.appendManualRecruitmentNotice.mockRejectedValue(new Error("database secret"));
  const databaseFailure = await POST(createRequest("POST", {}));

  expect(invalidJson.status).toBe(400);
  expect(databaseFailure.status).toBe(503);
  expect(await databaseFailure.text()).not.toContain("database secret");
});

test("다른 출처의 관리자 쓰기 요청을 거절한다", async () => {
  const request = createRequest("POST", {});
  request.headers.set("Origin", "https://malicious.example");

  const response = await POST(request);

  expect(response.status).toBe(403);
  expect(mocks.appendManualRecruitmentNotice).not.toHaveBeenCalled();
});

function createRequest(method: string, body?: object) {
  const init: RequestInit = { headers: { Authorization: "Basic credential" }, method };
  if (body) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/admin/recruitment-notices", init);
}

function createRawRequest(body: string) {
  return new Request("http://localhost/api/admin/recruitment-notices", {
    body,
    headers: { Authorization: "Basic credential" },
    method: "POST",
  });
}
