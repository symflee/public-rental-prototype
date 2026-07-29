import {
  readGyeonggiMunicipalityAddressName,
  type PublicRentalLocation,
} from "@/domain/public-rental";

import type {
  CoordinateResolutionFailure,
  CoordinateResolutionRequest,
  RentalCoordinate,
} from "./kakao-coordinate-resolver";

const EXPECTED_LOCATION_COUNT = 269;
const EXPECTED_SEONGNAM_COUNT = 87;
const EXPECTED_YONGIN_COUNT = 182;

export type RoadLevelLocationWarning = Readonly<{
  locationId: string;
  roadAddress: string;
}>;

export type CoordinateReviewFailure = CoordinateResolutionFailure &
  Readonly<{
    district: PublicRentalLocation["district"] | null;
    locationName: string | null;
    municipality: PublicRentalLocation["municipality"] | null;
  }>;

export function applyResolvedCoordinates(
  locations: readonly PublicRentalLocation[],
  coordinates: Readonly<Record<string, RentalCoordinate>>,
) {
  return locations.map((location) => applyCoordinate(location, coordinates[location.id]));
}

export function selectResolvedLocations(
  locations: readonly PublicRentalLocation[],
  coordinates: Readonly<Record<string, RentalCoordinate>>,
) {
  return locations.filter((location) => coordinates[location.id] !== undefined);
}

export function createCoordinateReviewFailures(
  locations: readonly PublicRentalLocation[],
  failures: readonly CoordinateResolutionFailure[],
) {
  return Object.freeze(
    failures.map((failure) => createCoordinateReviewFailure(locations, failure)),
  );
}

export function createCoordinateRequests(
  locations: readonly PublicRentalLocation[],
): readonly CoordinateResolutionRequest[] {
  return locations.map(createCoordinateRequest);
}

export function assertExpectedLhLocationProfile(locations: readonly PublicRentalLocation[]) {
  assertLocationCount(locations, EXPECTED_LOCATION_COUNT, "총");
  assertMunicipalityCount(locations, "SEONGNAM", EXPECTED_SEONGNAM_COUNT);
  assertMunicipalityCount(locations, "YONGIN", EXPECTED_YONGIN_COUNT);
  if (locations.every((location) => location.provider === "LH")) return;
  throw new Error("LH 이외 운영주체가 포함되어 게시를 중단했습니다.");
}

export function findRoadLevelLocations(
  locations: readonly PublicRentalLocation[],
): readonly RoadLevelLocationWarning[] {
  return locations.filter(isRoadLevelLocation).map(createRoadLevelWarning);
}

function applyCoordinate(
  location: PublicRentalLocation,
  coordinate: RentalCoordinate | undefined,
): PublicRentalLocation {
  if (!coordinate) return { ...location, coordinate: null };
  return {
    ...location,
    coordinate: { ...coordinate, source: "KAKAO_ADDRESS_SEARCH" },
  };
}

function createCoordinateReviewFailure(
  locations: readonly PublicRentalLocation[],
  failure: CoordinateResolutionFailure,
): CoordinateReviewFailure {
  const location = locations.find((candidate) => candidate.id === failure.locationId);
  return {
    ...failure,
    district: location?.district ?? null,
    locationName: location?.name ?? null,
    municipality: location?.municipality ?? null,
  };
}

function createCoordinateRequest(location: PublicRentalLocation): CoordinateResolutionRequest {
  return {
    addressAliases: location.addressAliases,
    district: location.district,
    locationId: location.id,
    municipality: readMunicipalityName(location),
    roadAddress: location.roadAddress,
  };
}

function readMunicipalityName(location: PublicRentalLocation) {
  return readGyeonggiMunicipalityAddressName(location.municipality);
}

function assertLocationCount(
  locations: readonly PublicRentalLocation[],
  expectedCount: number,
  label: string,
) {
  if (locations.length === expectedCount) return;
  throw new Error(`${label} 위치는 ${expectedCount}곳이어야 합니다: ${locations.length}곳`);
}

function assertMunicipalityCount(
  locations: readonly PublicRentalLocation[],
  municipality: PublicRentalLocation["municipality"],
  expectedCount: number,
) {
  const matching = locations.filter((location) => location.municipality === municipality);
  assertLocationCount(matching, expectedCount, readMunicipalityLabel(municipality));
}

function readMunicipalityLabel(municipality: PublicRentalLocation["municipality"]) {
  if (municipality === "SEONGNAM") return "성남";
  return "용인";
}

function isRoadLevelLocation(location: PublicRentalLocation) {
  if (!/(?:로|길)\d*번?길?/u.test(location.roadAddress)) return false;
  return !/(?:로|길)\s+\d+(?:-\d+)?(?:\s|$)/u.test(location.roadAddress);
}

function createRoadLevelWarning(location: PublicRentalLocation): RoadLevelLocationWarning {
  return { locationId: location.id, roadAddress: location.roadAddress };
}
