"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { renderKakaoMap } from "@/infrastructure/kakao/kakao-map-sdk";

const SEONGNAM_CITY_HALL = {
  latitude: 37.420035,
  longitude: 127.127243,
  level: 5,
};

type KakaoMapProperties = Readonly<{
  javascriptKey?: string;
}>;

type MapState = Readonly<{
  reason?: "load-failed" | "missing-key";
  status: "error" | "loading" | "ready";
}>;

const LOADING_STATE: MapState = { status: "loading" };
const READY_STATE: MapState = { status: "ready" };
const LOAD_FAILED_STATE: MapState = { reason: "load-failed", status: "error" };
const MISSING_KEY_STATE: MapState = { reason: "missing-key", status: "error" };

export function KakaoMap({ javascriptKey }: KakaoMapProperties) {
  const containerReference = useRef<HTMLDivElement>(null);
  const state = useKakaoMap(containerReference, javascriptKey);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-slate-100">
      <KakaoMapCanvas containerReference={containerReference} state={state} />
      <MapFeedback state={state} />
    </main>
  );
}

function KakaoMapCanvas({
  containerReference,
  state,
}: Readonly<{ containerReference: RefObject<HTMLDivElement | null>; state: MapState }>) {
  return (
    <div
      aria-busy={state.status !== "ready"}
      aria-label="성남시청 인근 카카오맵"
      className="h-full w-full"
      data-map-state={state.status}
      ref={containerReference}
      role="region"
    />
  );
}

function MapFeedback({ state }: Readonly<{ state: MapState }>) {
  if (state.status === "ready") return null;
  if (state.status === "loading") return <LoadingFeedback />;
  return <ErrorFeedback reason={state.reason} />;
}

function LoadingFeedback() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-100" role="status">
      <p className="rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
        지도를 불러오는 중…
      </p>
    </div>
  );
}

function ErrorFeedback({ reason }: Readonly<{ reason?: MapState["reason"] }>) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-100 p-6" role="alert">
      <p className="max-w-md rounded-xl bg-white p-5 text-center text-sm text-slate-700 shadow-sm">
        {createErrorMessage(reason)}
      </p>
    </div>
  );
}

function createErrorMessage(reason: MapState["reason"]) {
  if (reason === "missing-key") {
    return "카카오맵 키가 설정되지 않았습니다. .env.local을 확인해 주세요.";
  }
  return "카카오맵을 불러오지 못했습니다. 등록 도메인과 API 사용 설정을 확인해 주세요.";
}

function useKakaoMap(
  containerReference: RefObject<HTMLDivElement | null>,
  javascriptKey: string | undefined,
) {
  const [state, setState] = useState<MapState>(() => createInitialState(javascriptKey));
  useEffect(
    () => startKakaoMap(containerReference.current, javascriptKey, setState),
    [containerReference, javascriptKey],
  );
  return state;
}

function createInitialState(javascriptKey: string | undefined) {
  if (!hasJavascriptKey(javascriptKey)) return MISSING_KEY_STATE;
  return LOADING_STATE;
}

function startKakaoMap(
  container: HTMLDivElement | null,
  javascriptKey: string | undefined,
  setState: Dispatch<SetStateAction<MapState>>,
) {
  if (!container || !hasJavascriptKey(javascriptKey)) return;
  const controller = new AbortController();
  renderKakaoMap(container, javascriptKey.trim(), SEONGNAM_CITY_HALL)
    .then(() => markMapReady(controller.signal, setState))
    .catch(() => markMapFailed(controller.signal, setState));
  return () => controller.abort();
}

function markMapReady(signal: AbortSignal, setState: Dispatch<SetStateAction<MapState>>) {
  if (signal.aborted) return;
  setState(READY_STATE);
}

function markMapFailed(signal: AbortSignal, setState: Dispatch<SetStateAction<MapState>>) {
  if (signal.aborted) return;
  setState(LOAD_FAILED_STATE);
}

function hasJavascriptKey(javascriptKey: string | undefined): javascriptKey is string {
  if (!javascriptKey) return false;
  return javascriptKey.trim().length > 0;
}
