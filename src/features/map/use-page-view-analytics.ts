import { useEffect, useRef } from "react";

import { recordExperimentEligible } from "./experiment-event-client";

export function usePageViewAnalytics(
  mapStatus: "error" | "loading" | "ready",
  explorationReady = true,
) {
  const pageViewRecorded = useRef(false);
  const eligibilityRecorded = useRef(false);
  useEffect(() => recordPageViewWhenReady(mapStatus, pageViewRecorded), [mapStatus]);
  useEffect(
    () => recordEligibilityWhenReady(mapStatus, explorationReady, eligibilityRecorded),
    [explorationReady, mapStatus],
  );
}

function recordPageViewWhenReady(
  mapStatus: "error" | "loading" | "ready",
  recorded: { current: boolean },
) {
  if (mapStatus !== "ready" || recorded.current) return;
  recorded.current = true;
  void fetch("/api/analytics/page-view", { keepalive: true, method: "POST" }).catch(ignoreFailure);
}

function recordEligibilityWhenReady(
  mapStatus: "error" | "loading" | "ready",
  explorationReady: boolean,
  recorded: { current: boolean },
) {
  if (mapStatus !== "ready" || !explorationReady || recorded.current) return;
  recorded.current = true;
  void recordExperimentEligible();
}

function ignoreFailure() {
  return undefined;
}
