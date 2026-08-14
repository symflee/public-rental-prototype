import {
  PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
  PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT,
  type ExperimentEventKind,
} from "@/domain/announcement-analytics";

let pendingExperimentEvent = Promise.resolve();

export function recordExperimentEligible() {
  return recordExperimentEvent("EXPERIMENT_ELIGIBLE");
}

export function recordNoOpenNoticeLocationViewed(locationId: string) {
  return recordExperimentEvent("NO_OPEN_NOTICE_LOCATION_VIEWED", locationId);
}

export function recordBookmarkChange(locationId: string, bookmarked: boolean) {
  return recordExperimentEvent(readBookmarkEventKind(bookmarked), locationId);
}

function readBookmarkEventKind(bookmarked: boolean): ExperimentEventKind {
  if (bookmarked) return "BOOKMARK_ADDED";
  return "BOOKMARK_REMOVED";
}

function recordExperimentEvent(eventKind: ExperimentEventKind, locationId?: string) {
  pendingExperimentEvent = pendingExperimentEvent.then(() =>
    sendExperimentEvent(eventKind, locationId),
  );
  return pendingExperimentEvent;
}

async function sendExperimentEvent(eventKind: ExperimentEventKind, locationId?: string) {
  try {
    const request = createRequest(eventKind, locationId);
    const response = await fetch("/api/analytics/experiment-events", request);
    if (!shouldRetry(response, await readResponseBody(response))) return;
    await fetch("/api/analytics/experiment-events", request);
  } catch {
    return;
  }
}

function shouldRetry(response: Response, body: unknown) {
  if (response.status >= 500) return true;
  if (!response.ok || !isRecord(body)) return false;
  return body.recorded === false;
}

async function readResponseBody(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createRequest(eventKind: ExperimentEventKind, locationId?: string): RequestInit {
  return {
    body: JSON.stringify(createEvent(eventKind, locationId)),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  };
}

function createEvent(eventKind: ExperimentEventKind, locationId?: string) {
  return {
    eventId: crypto.randomUUID(),
    eventKind,
    experimentKey: PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
    locationId,
    variant: PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT,
  };
}
