import { expect, test } from "vitest";

import { isPublicRentalSnapshotFresh } from "./public-rental-snapshot-freshness";

const NOW = new Date("2026-08-14T12:00:00.000Z");

test("스냅샷 생성 후 72시간까지 모집 상태를 최신으로 본다", () => {
  expect(isPublicRentalSnapshotFresh("2026-08-11T12:00:00.000Z", NOW)).toBe(true);
  expect(isPublicRentalSnapshotFresh("2026-08-11T11:59:59.999Z", NOW)).toBe(false);
});

test("잘못된 생성 시각은 최신 스냅샷으로 보지 않는다", () => {
  expect(isPublicRentalSnapshotFresh("invalid", NOW)).toBe(false);
});
