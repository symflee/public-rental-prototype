import { expect, test } from "vitest";

import {
  createDandaeHappyHousingLocation,
  type PublicRentalLocation,
} from "@/domain/public-rental";

import { createPublicRentalReviewCsv, createPublicRentalSnapshot } from "./public-rental-artifacts";

test("위치 ID 순서가 고정된 검증 스냅샷을 만든다", () => {
  const dandae = createDandaeHappyHousingLocation();
  const laterIdentifier = { ...dandae, id: "z-location", name: "성남 행복주택" };

  const snapshot = createPublicRentalSnapshot("2026-07-28T00:00:00.000Z", [
    laterIdentifier,
    dandae,
  ]);

  expect(snapshot.locations.map((location) => location.id)).toEqual([
    "seongnam:dandae-happy-housing",
    "z-location",
  ]);
  expect(snapshot.status).toBe("verified");
  expect(snapshot.schemaVersion).toBe(2);
});

test("배포 조건을 충족하지 못하면 스냅샷을 만들지 않는다", () => {
  const invalidLocation = {
    ...createDandaeHappyHousingLocation(),
    coordinate: null,
  } satisfies PublicRentalLocation;

  expectSnapshotFailureToIdentifyLocation(invalidLocation);
});

test("공급조건별 행과 출처 기준일을 보존한다", () => {
  const csv = createPublicRentalReviewCsv([createDandaeHappyHousingLocation()]);

  expect(csv.split("\n")).toHaveLength(5);
  expect(csv).toContain('"exclusiveAreaSquareMeters"');
  expect(csv).toContain('"municipality"');
  expect(csv).toContain('"propertySourceId"');
  expect(csv).toContain('"offeringSourceId"');
  expect(csv).toContain('"16"');
  expect(csv).toContain('"26"');
  expect(csv).toContain('"44"');
  expect(csv).toContain('"2026-07-28"');
});

function expectSnapshotFailureToIdentifyLocation(location: PublicRentalLocation) {
  const createSnapshot = () => createPublicRentalSnapshot("2026-07-28T00:00:00.000Z", [location]);

  expect(createSnapshot).toThrow("seongnam:dandae-happy-housing [INVALID_COORDINATE]");
}
