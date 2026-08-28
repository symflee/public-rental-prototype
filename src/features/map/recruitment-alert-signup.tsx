"use client";

import { type FormEvent, useState } from "react";

type SignupState = Readonly<{
  kind: "closed" | "editing" | "submitting" | "success";
  message?: string;
}>;

const CLOSED_STATE: SignupState = { kind: "closed" };
const EDITING_STATE: SignupState = { kind: "editing" };
const SUBMITTING_STATE: SignupState = { kind: "submitting" };
const SUCCESS_STATE: SignupState = { kind: "success" };

export function RecruitmentAlertSignup({ locationId }: Readonly<{ locationId: string }>) {
  return <RecruitmentAlertSignupForm key={locationId} locationId={locationId} />;
}

function RecruitmentAlertSignupForm({ locationId }: Readonly<{ locationId: string }>) {
  const [state, setState] = useState<SignupState>(CLOSED_STATE);
  if (state.kind === "closed") return <OpenSignupButton onOpen={() => setState(EDITING_STATE)} />;
  if (state.kind === "success") return <SuccessFeedback />;
  return <SignupForm locationId={locationId} setState={setState} state={state} />;
}

function OpenSignupButton({ onOpen }: Readonly<{ onOpen: () => void }>) {
  return (
    <button
      className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      onClick={onOpen}
      type="button"
    >
      공고 시작하면 메일 받기
    </button>
  );
}

type SignupFormProperties = Readonly<{
  locationId: string;
  setState: (state: SignupState) => void;
  state: SignupState;
}>;

function SignupForm({ locationId, setState, state }: SignupFormProperties) {
  return (
    <form
      aria-label="모집공고 이메일 알림 신청"
      className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3"
      onSubmit={(event) => void submitForm(event, locationId, setState)}
    >
      <WebsiteField />
      <EmailField disabled={state.kind === "submitting"} />
      <PrivacyConsent disabled={state.kind === "submitting"} />
      <FormActions disabled={state.kind === "submitting"} onCancel={() => setState(CLOSED_STATE)} />
      <ErrorFeedback message={state.message} />
    </form>
  );
}

function WebsiteField() {
  return (
    <input
      aria-hidden="true"
      autoComplete="off"
      className="absolute -left-[10000px]"
      name="website"
      tabIndex={-1}
      type="text"
    />
  );
}

function EmailField({ disabled }: Readonly<{ disabled: boolean }>) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      이메일
      <EmailInput disabled={disabled} />
    </label>
  );
}

function EmailInput({ disabled }: Readonly<{ disabled: boolean }>) {
  return (
    <input
      autoComplete="email"
      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
      disabled={disabled}
      maxLength={254}
      name="email"
      placeholder="name@example.com"
      required
      type="email"
    />
  );
}

function PrivacyConsent({ disabled }: Readonly<{ disabled: boolean }>) {
  return (
    <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600">
      <input className="mt-1" disabled={disabled} name="privacyConsent" required type="checkbox" />
      <span>
        다음 모집공고 1회 안내를 위한 개인정보 수집·이용에 동의합니다.{" "}
        <a className="font-medium underline underline-offset-2" href="/privacy">
          개인정보처리방침
        </a>
      </span>
    </label>
  );
}

function FormActions({
  disabled,
  onCancel,
}: Readonly<{ disabled: boolean; onCancel: () => void }>) {
  return (
    <div className="mt-3 flex w-full gap-2">
      <SubmitButton disabled={disabled} />
      <CancelButton disabled={disabled} onCancel={onCancel} />
    </div>
  );
}

function CancelButton({
  disabled,
  onCancel,
}: Readonly<{ disabled: boolean; onCancel: () => void }>) {
  return (
    <button
      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
      disabled={disabled}
      onClick={onCancel}
      type="button"
    >
      취소
    </button>
  );
}

function SubmitButton({ disabled }: Readonly<{ disabled: boolean }>) {
  return (
    <button
      className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-400"
      disabled={disabled}
      type="submit"
    >
      {readSubmitText(disabled)}
    </button>
  );
}

function SuccessFeedback() {
  return (
    <p
      className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"
      role="status"
    >
      알림 신청이 저장되었습니다. 공고를 확인하면 운영자가 이메일로 안내합니다.
    </p>
  );
}

function ErrorFeedback({ message }: Readonly<{ message?: string }>) {
  if (!message) return null;
  return (
    <p className="mt-2 text-xs leading-5 text-rose-700" role="alert">
      {message}
    </p>
  );
}

async function submitForm(
  event: FormEvent<HTMLFormElement>,
  locationId: string,
  setState: (state: SignupState) => void,
) {
  event.preventDefault();
  const request = createSignupRequest(event.currentTarget, locationId);
  if (!request) return setState(readValidationState());
  setState(SUBMITTING_STATE);
  await sendSignupRequest(request, setState);
}

function createSignupRequest(form: HTMLFormElement, locationId: string) {
  const formData = new FormData(form);
  const email = String(formData.get("email") ?? "").trim();
  const privacyConsent = formData.get("privacyConsent") === "on";
  if (!isValidEmail(email) || !privacyConsent) return null;
  const website = String(formData.get("website") ?? "").trim();
  return { email, locationId, privacyConsent, website };
}

async function sendSignupRequest(body: SignupRequest, setState: (state: SignupState) => void) {
  try {
    const response = await fetch("/api/recruitment-alert-subscriptions", createRequest(body));
    setState(readResponseState(response));
  } catch {
    setState(readNetworkErrorState());
  }
}

type SignupRequest = Readonly<{
  email: string;
  locationId: string;
  privacyConsent: true;
  website: string;
}>;

function createRequest(body: SignupRequest) {
  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  };
}

function readResponseState(response: Response): SignupState {
  if (response.ok) return SUCCESS_STATE;
  if (response.status === 400) return readErrorState("입력 내용을 확인해 주세요.");
  if (response.status === 409)
    return readErrorState("이미 모집이 시작되어 지금은 알림을 신청할 수 없습니다.");
  return readErrorState("신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}

function readValidationState() {
  return readErrorState("올바른 이메일을 입력하고 개인정보 수집·이용에 동의해 주세요.");
}

function readNetworkErrorState() {
  return readErrorState("네트워크 연결을 확인하고 다시 시도해 주세요.");
}

function readErrorState(message: string): SignupState {
  return { kind: "editing", message };
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

function readSubmitText(disabled: boolean) {
  if (disabled) return "신청 중…";
  return "알림 신청";
}
