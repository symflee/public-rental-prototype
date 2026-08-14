export const EXPERIMENT_EVENT_KINDS = [
  "EXPERIMENT_ELIGIBLE",
  "NO_OPEN_NOTICE_LOCATION_VIEWED",
  "BOOKMARK_ADDED",
  "BOOKMARK_REMOVED",
  "OPEN_ANNOUNCEMENT_VIEWED",
] as const;

export type ExperimentEventKind = (typeof EXPERIMENT_EVENT_KINDS)[number];

export const EXPERIMENT_VARIANTS = ["OPEN_NOTICES_ONLY", "ALL_HOMES"] as const;

export type ExperimentVariant = (typeof EXPERIMENT_VARIANTS)[number];

export const EXPERIMENT_SUBJECT_KINDS = ["SITE", "LOCATION"] as const;

export type ExperimentSubjectKind = (typeof EXPERIMENT_SUBJECT_KINDS)[number];

export const PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY = "whole-housing-bookmark-v1";

export const PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT = "ALL_HOMES";

export type ExperimentEvent = Readonly<{
  eventId: string;
  eventKind: ExperimentEventKind;
  experimentKey: string;
  metricDate: string;
  subjectId: string;
  subjectKind: ExperimentSubjectKind;
  variant: ExperimentVariant;
  visitorHash: string;
}>;

export type ExperimentFact = Omit<ExperimentEvent, "eventId">;

export function isExperimentEventKind(value: unknown): value is ExperimentEventKind {
  return EXPERIMENT_EVENT_KINDS.some((eventKind) => eventKind === value);
}

export function isExperimentVariant(value: unknown): value is ExperimentVariant {
  return EXPERIMENT_VARIANTS.some((variant) => variant === value);
}

export function isExperimentSubjectKind(value: unknown): value is ExperimentSubjectKind {
  return EXPERIMENT_SUBJECT_KINDS.some((subjectKind) => subjectKind === value);
}
