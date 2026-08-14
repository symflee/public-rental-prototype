import { expect, test } from "vitest";

import {
  isExperimentEventKind,
  isExperimentSubjectKind,
  isExperimentVariant,
  PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
  PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT,
} from "./experiment-event";

test("전체 주택 탐색 실험 계약을 검증한다", () => {
  expect(PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY).toBe("whole-housing-bookmark-v1");
  expect(PUBLIC_RENTAL_EXPLORATION_TREATMENT_VARIANT).toBe("ALL_HOMES");
  expect(isExperimentEventKind("BOOKMARK_ADDED")).toBe(true);
  expect(isExperimentEventKind("UNKNOWN")).toBe(false);
  expect(isExperimentVariant("OPEN_NOTICES_ONLY")).toBe(true);
  expect(isExperimentSubjectKind("LOCATION")).toBe(true);
});
