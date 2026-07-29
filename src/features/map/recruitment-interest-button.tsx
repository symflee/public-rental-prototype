"use client";

import { useState } from "react";

type InterestState = "idle" | "submitting" | "confirmed" | "failed";

export function RecruitmentInterestButton({ locationId }: Readonly<{ locationId: string }>) {
  const [state, setState] = useState<InterestState>("idle");
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-500">모집공고</h3>
      <button
        className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-400"
        disabled={state !== "idle"}
        onClick={() => void submitInterest(locationId, setState)}
        type="button"
      >
        {readButtonText(state)}
      </button>
      <InterestFeedback state={state} />
    </div>
  );
}

async function submitInterest(locationId: string, setState: (state: InterestState) => void) {
  setState("submitting");
  try {
    const response = await fetch("/api/analytics/announcement-interest", createRequest(locationId));
    setState(readResponseState(response));
  } catch {
    setState("failed");
  }
}

function createRequest(locationId: string) {
  return {
    body: JSON.stringify({ locationId }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  };
}

function readResponseState(response: Response): InterestState {
  if (response.ok) return "confirmed";
  return "failed";
}

function readButtonText(state: InterestState) {
  if (state === "submitting") return "확인 중…";
  if (state === "confirmed") return "확인 의향 기록됨";
  return "공고 확인해보기";
}

function InterestFeedback({ state }: Readonly<{ state: InterestState }>) {
  if (state === "confirmed") return <ConfirmedInterestFeedback />;
  if (state === "failed") return <FailedInterestFeedback />;
  return null;
}

function ConfirmedInterestFeedback() {
  return (
    <p className="mt-2 text-xs leading-5 text-slate-600" role="status">
      현재 이 단지에 등록된 모집 공고가 없습니다.
    </p>
  );
}

function FailedInterestFeedback() {
  return (
    <p className="mt-2 text-xs leading-5 text-rose-700" role="alert">
      확인 의향을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.
    </p>
  );
}
