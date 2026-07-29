import {
  createGyeonggiMunicipalities,
  type PublicRentalLegalCategory,
  type PublicRentalMapFilter,
  type PublicRentalMapRequest,
  type PublicRentalMapViewport,
  type PublicRentalMunicipality,
} from "@/domain/public-rental";

const REQUEST_ERROR_MESSAGE = "지도 요청 형식이 올바르지 않습니다.";
const MINIMUM_VIEWPORT_SIZE = 200;
const MAXIMUM_VIEWPORT_SIZE = 4096;
const MINIMUM_MAP_LEVEL = 1;
const MAXIMUM_MAP_LEVEL = 14;
const MAXIMUM_QUERY_LENGTH = 100;
const LEGAL_CATEGORIES = new Set<PublicRentalLegalCategory>([
  "NATIONAL_RENTAL",
  "PERMANENT_RENTAL",
  "HAPPY_HOUSING",
  "INTEGRATED_PUBLIC_RENTAL",
  "PUBLIC_RENTAL",
  "PURCHASE_RENTAL",
]);
const MUNICIPALITIES = new Set<PublicRentalMunicipality>(createGyeonggiMunicipalities());

export function readPublicRentalMapRequest(parameters: URLSearchParams): PublicRentalMapRequest {
  return { filter: readFilter(parameters), viewport: readViewport(parameters) };
}

function readFilter(parameters: URLSearchParams): PublicRentalMapFilter {
  return {
    categories: readCategories(parameters.get("categories")),
    municipality: readMunicipality(parameters.get("municipality")),
    query: readQuery(parameters.get("query")),
  };
}

function readCategories(value: string | null) {
  if (!value) return [];
  const categories = value.split(",").filter(isNonEmpty);
  if (categories.every(isLegalCategory)) return categories;
  throw new Error(REQUEST_ERROR_MESSAGE);
}

function isNonEmpty(value: string) {
  return value.length > 0;
}

function isLegalCategory(value: string): value is PublicRentalLegalCategory {
  return LEGAL_CATEGORIES.has(value as PublicRentalLegalCategory);
}

function readMunicipality(value: string | null) {
  if (!value || value === "ALL") return "ALL" as const;
  if (MUNICIPALITIES.has(value as PublicRentalMunicipality)) {
    return value as PublicRentalMunicipality;
  }
  throw new Error(REQUEST_ERROR_MESSAGE);
}

function readQuery(value: string | null) {
  if (!value) return "";
  if (value.length <= MAXIMUM_QUERY_LENGTH) return value;
  throw new Error(REQUEST_ERROR_MESSAGE);
}

function readViewport(parameters: URLSearchParams): PublicRentalMapViewport {
  const viewport = {
    east: readNumber(parameters, "east"),
    height: readNumber(parameters, "height"),
    level: readNumber(parameters, "level"),
    north: readNumber(parameters, "north"),
    south: readNumber(parameters, "south"),
    west: readNumber(parameters, "west"),
    width: readNumber(parameters, "width"),
  };
  validateViewport(viewport);
  return viewport;
}

function readNumber(parameters: URLSearchParams, name: string) {
  const value = Number(parameters.get(name));
  if (Number.isFinite(value)) return value;
  throw new Error(REQUEST_ERROR_MESSAGE);
}

function validateViewport(viewport: PublicRentalMapViewport) {
  if (viewport.north <= viewport.south) throw new Error(REQUEST_ERROR_MESSAGE);
  if (viewport.east <= viewport.west) throw new Error(REQUEST_ERROR_MESSAGE);
  validateMapLevel(viewport.level);
  validateViewportSize(viewport.width);
  validateViewportSize(viewport.height);
}

function validateMapLevel(level: number) {
  if (Number.isInteger(level) && level >= MINIMUM_MAP_LEVEL && level <= MAXIMUM_MAP_LEVEL) return;
  throw new Error(REQUEST_ERROR_MESSAGE);
}

function validateViewportSize(size: number) {
  if (Number.isInteger(size) && size >= MINIMUM_VIEWPORT_SIZE && size <= MAXIMUM_VIEWPORT_SIZE)
    return;
  throw new Error(REQUEST_ERROR_MESSAGE);
}
