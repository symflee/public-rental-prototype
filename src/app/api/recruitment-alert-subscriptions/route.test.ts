import { beforeEach, expect, test, vi } from "vitest";

import {
  RecruitmentAlertConflictError,
  RecruitmentAlertLocationNotFoundError,
  RecruitmentAlertStatusUnavailableError,
  RecruitmentAlertValidationError,
} from "@/infrastructure/recruitment-alert";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ subscribeRecruitmentAlert: vi.fn() }));

vi.mock("@/infrastructure/recruitment-alert", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/recruitment-alert")>()),
  subscribeRecruitmentAlert: mocks.subscribeRecruitmentAlert,
}));

beforeEach(() => vi.clearAllMocks());

test("새 신청과 중복 신청을 구분하지 않고 수락한다", async () => {
  const input = createInput();

  const response = await POST(createRequest(input));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ accepted: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.subscribeRecruitmentAlert).toHaveBeenCalledWith(input);
});

test("잘못된 입력과 JSON 요청을 400으로 거절한다", async () => {
  mocks.subscribeRecruitmentAlert.mockRejectedValueOnce(
    new RecruitmentAlertValidationError("이메일 형식이 올바르지 않습니다."),
  );

  const invalidInput = await POST(createRequest(createInput()));
  const invalidJson = await POST(createRawRequest("{"));
  const wrongContentType = await POST(createRawRequest("{}", "text/plain"));

  expect(invalidInput.status).toBe(400);
  expect(invalidJson.status).toBe(400);
  expect(wrongContentType.status).toBe(400);
});

test("존재하지 않는 단지와 모집 중인 단지를 구분한다", async () => {
  mocks.subscribeRecruitmentAlert.mockRejectedValueOnce(
    new RecruitmentAlertLocationNotFoundError(),
  );
  mocks.subscribeRecruitmentAlert.mockRejectedValueOnce(new RecruitmentAlertConflictError());

  const missing = await POST(createRequest(createInput()));
  const open = await POST(createRequest(createInput()));

  expect(missing.status).toBe(404);
  expect(open.status).toBe(409);
});

test("상태 또는 DB를 사용할 수 없으면 이메일을 노출하지 않고 503을 반환한다", async () => {
  mocks.subscribeRecruitmentAlert.mockRejectedValueOnce(
    new RecruitmentAlertStatusUnavailableError(),
  );
  mocks.subscribeRecruitmentAlert.mockRejectedValueOnce(new Error("user@example.com database"));

  const unavailableStatus = await POST(createRequest(createInput()));
  const databaseFailure = await POST(createRequest(createInput()));

  expect(unavailableStatus.status).toBe(503);
  expect(databaseFailure.status).toBe(503);
  expect(await databaseFailure.text()).not.toContain("user@example.com");
});

test("제한보다 큰 요청 본문은 서비스 호출 전에 413으로 거절한다", async () => {
  const response = await POST(createRawRequest(JSON.stringify({ padding: "가".repeat(2_000) })));

  expect(response.status).toBe(413);
  expect(mocks.subscribeRecruitmentAlert).not.toHaveBeenCalled();
});

function createInput() {
  return {
    email: "user@example.com",
    locationId: "31297390",
    privacyConsent: true,
    website: "",
  };
}

function createRequest(body: object) {
  return createRawRequest(JSON.stringify(body));
}

function createRawRequest(body: string, contentType = "application/json") {
  return new Request("http://localhost/api/recruitment-alert-subscriptions", {
    body,
    headers: { "Content-Type": contentType },
    method: "POST",
  });
}
