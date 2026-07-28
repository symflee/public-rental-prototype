import { expect, test } from "vitest";

import { parsePublicRentalSnapshot, publicRentalSnapshot } from "./public-rental-snapshot";

test("검증된 정적 위치를 앱에 제공한다", () => {
  expect(publicRentalSnapshot.schemaVersion).toBe(2);
  expect(publicRentalSnapshot.status).toBe("verified");
  expect(publicRentalSnapshot.locations).toHaveLength(269);
  expect(publicRentalSnapshot.locations.every((location) => location.provider === "LH")).toBe(true);
  expect(readLocationIdentifiers()).not.toContain("seongnam:dandae-happy-housing");
});

test("스냅샷 구조가 손상되면 앱 데이터로 허용하지 않는다", () => {
  const invalidSnapshot = {
    generatedAt: "2026-07-28",
    locations: [{ id: "missing-fields" }],
    schemaVersion: 2,
  };

  expect(() => parsePublicRentalSnapshot(invalidSnapshot)).toThrow(
    "공공임대 스냅샷 형식이 올바르지 않습니다.",
  );
});

function readLocationIdentifiers() {
  return publicRentalSnapshot.locations.map((location) => location.id);
}
