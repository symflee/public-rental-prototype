import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { RecruitmentAlertSignup } from "./recruitment-alert-signup";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("이메일과 개인정보 동의를 제출하면 알림 신청을 완료한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<RecruitmentAlertSignup locationId="location-one" />);

  fireEvent.click(screen.getByRole("button", { name: "공고 시작하면 메일 받기" }));
  expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
    "href",
    "/privacy",
  );
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "USER@example.com" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /개인정보 수집·이용에 동의/u }));
  fireEvent.click(screen.getByRole("button", { name: "알림 신청" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "알림 신청이 저장되었습니다. 공고를 확인하면 운영자가 이메일로 안내합니다.",
  );
  expect(screen.queryByDisplayValue("USER@example.com")).not.toBeInTheDocument();
  expect(readRequestBody(fetchMock)).toEqual({
    email: "USER@example.com",
    locationId: "location-one",
    privacyConsent: true,
    website: "",
  });
});

test("이메일 형식과 개인정보 동의를 제출 전에 확인한다", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<RecruitmentAlertSignup locationId="location-one" />);

  fireEvent.click(screen.getByRole("button", { name: "공고 시작하면 메일 받기" }));
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "not-an-email" } });
  fireEvent.submit(screen.getByRole("form", { name: "모집공고 이메일 알림 신청" }));

  expect(screen.getByRole("alert")).toHaveTextContent(
    "올바른 이메일을 입력하고 개인정보 수집·이용에 동의해 주세요.",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  [400, "입력 내용을 확인해 주세요."],
  [409, "이미 모집이 시작되어 지금은 알림을 신청할 수 없습니다."],
  [503, "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."],
])("서버 응답 %i에 맞는 안내를 표시한다", async (status, message) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  render(<RecruitmentAlertSignup locationId="location-one" />);

  submitValidForm();

  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByDisplayValue("user@example.com")).toBeVisible();
});

test("네트워크 오류 뒤 입력값을 유지하고 다시 시도할 수 있다", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
  render(<RecruitmentAlertSignup locationId="location-one" />);

  submitValidForm();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "네트워크 연결을 확인하고 다시 시도해 주세요.",
  );
  expect(screen.getByDisplayValue("user@example.com")).toBeVisible();
  expect(screen.getByRole("button", { name: "알림 신청" })).toBeEnabled();
});

test("다른 단지로 이동하면 열려 있던 폼과 결과를 초기화한다", () => {
  const view = render(<RecruitmentAlertSignup locationId="location-one" />);
  fireEvent.click(screen.getByRole("button", { name: "공고 시작하면 메일 받기" }));
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });

  view.rerender(<RecruitmentAlertSignup locationId="location-two" />);

  expect(screen.queryByLabelText("이메일")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "공고 시작하면 메일 받기" })).toBeVisible();
});

function submitValidForm() {
  fireEvent.click(screen.getByRole("button", { name: "공고 시작하면 메일 받기" }));
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /개인정보 수집·이용에 동의/u }));
  fireEvent.submit(screen.getByRole("form", { name: "모집공고 이메일 알림 신청" }));
}

function readRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  if (typeof request?.body !== "string") throw new Error("요청 본문이 없습니다.");
  return JSON.parse(request.body) as unknown;
}
