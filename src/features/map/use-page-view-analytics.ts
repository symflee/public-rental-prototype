import { useEffect, useRef } from "react";

export function usePageViewAnalytics(mapStatus: "error" | "loading" | "ready") {
  const recorded = useRef(false);
  useEffect(() => recordPageViewWhenReady(mapStatus, recorded), [mapStatus]);
}

function recordPageViewWhenReady(
  mapStatus: "error" | "loading" | "ready",
  recorded: { current: boolean },
) {
  if (mapStatus !== "ready" || recorded.current) return;
  recorded.current = true;
  void fetch("/api/analytics/page-view", { keepalive: true, method: "POST" }).catch(ignoreFailure);
}

function ignoreFailure() {
  return undefined;
}
