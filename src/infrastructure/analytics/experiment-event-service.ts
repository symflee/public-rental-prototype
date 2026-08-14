import { randomUUID } from "node:crypto";

import {
  PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
  PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT,
  readKoreanDate,
  subtractDays,
  type AnalyticsDateRange,
  type ExperimentEventKind,
  type ExperimentSubjectKind,
  type ExperimentVariant,
} from "@/domain/announcement-analytics";

import { createExperimentEventRepository } from "./experiment-event-repository";
import { hasExperimentVisitorHashSecret } from "./experiment-visitor";

const EXPERIMENT_RETENTION_DAYS = 90;
const repository = createExperimentEventRepository();

export type ExperimentEventInput = Readonly<{
  eventId: string;
  eventKind: ExperimentEventKind;
  experimentKey: string;
  locationId?: string;
  variant: ExperimentVariant;
}>;

export function recordExperimentEvent(input: ExperimentEventInput, visitorHash: string) {
  const subject = createExperimentSubject(input.eventKind, input.locationId);
  return repository.record({
    ...input,
    metricDate: readKoreanDate(),
    subjectId: subject.id,
    subjectKind: subject.kind,
    visitorHash,
  });
}

export function recordOpenAnnouncementViewed(locationId: string, visitorHash: string) {
  return recordExperimentEvent(createOpenAnnouncementEvent(locationId), visitorHash);
}

export function readExperimentFacts(range: AnalyticsDateRange, experimentKey?: string) {
  return repository.readFacts(range, experimentKey);
}

export function readAllHomesBookmarkAddedEventCount(
  range: AnalyticsDateRange,
  experimentKey: string,
) {
  return repository.countAllHomesBookmarkAddedEvents(range, experimentKey);
}

export function purgeExpiredExperimentEvents() {
  const expirationDate = subtractDays(readKoreanDate(), EXPERIMENT_RETENTION_DAYS);
  return repository.purgeBefore(expirationDate);
}

export function initializeExperimentAnalyticsStorage() {
  return repository.initialize();
}

export function isExperimentAnalyticsEnabled() {
  if (!repository.isEnabled()) return false;
  return hasExperimentVisitorHashSecret();
}

function createOpenAnnouncementEvent(locationId: string): ExperimentEventInput {
  return {
    eventId: randomUUID(),
    eventKind: "OPEN_ANNOUNCEMENT_VIEWED",
    experimentKey: PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
    locationId,
    variant: PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT,
  };
}

function createExperimentSubject(
  eventKind: ExperimentEventKind,
  locationId: string | undefined,
): Readonly<{ id: string; kind: ExperimentSubjectKind }> {
  if (eventKind === "EXPERIMENT_ELIGIBLE") return { id: "all", kind: "SITE" };
  if (!locationId) throw new Error("위치 이벤트에는 단지 식별자가 필요합니다.");
  return { id: locationId, kind: "LOCATION" };
}
