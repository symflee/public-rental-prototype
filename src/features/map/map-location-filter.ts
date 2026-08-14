import {
  createGyeonggiMunicipalities,
  type PublicRentalLegalCategory,
  type PublicRentalLocation,
  type PublicRentalMunicipality,
} from "@/domain/public-rental";

export type MunicipalityFilter = "ALL" | PublicRentalMunicipality;

export type MapLocationFilter = Readonly<{
  categories: readonly PublicRentalLegalCategory[];
  locationIdentifiers?: readonly string[];
  municipality: MunicipalityFilter;
  query: string;
}>;

const CATEGORY_ORDER: readonly PublicRentalLegalCategory[] = [
  "NATIONAL_RENTAL",
  "PERMANENT_RENTAL",
  "HAPPY_HOUSING",
  "INTEGRATED_PUBLIC_RENTAL",
  "PUBLIC_RENTAL",
  "PURCHASE_RENTAL",
];

export function filterMapLocations(
  locations: readonly PublicRentalLocation[],
  filter: MapLocationFilter,
) {
  return locations.filter((location) => matchesFilter(location, filter));
}

export function createAvailableCategories(locations: readonly PublicRentalLocation[]) {
  const categories = new Set(locations.flatMap(readLegalCategories));
  return CATEGORY_ORDER.filter((category) => categories.has(category));
}

export function createAvailableMunicipalities(locations: readonly PublicRentalLocation[]) {
  const municipalities = new Set(locations.map(readMunicipality));
  return createGyeonggiMunicipalities().filter((municipality) => municipalities.has(municipality));
}

export function toggleCategory(
  selected: readonly PublicRentalLegalCategory[],
  category: PublicRentalLegalCategory,
) {
  if (selected.includes(category)) return selected.filter((value) => value !== category);
  return [...selected, category];
}

function matchesFilter(location: PublicRentalLocation, filter: MapLocationFilter) {
  if (!matchesLocationIdentifiers(location, filter.locationIdentifiers)) return false;
  if (!matchesMunicipality(location, filter.municipality)) return false;
  if (!matchesCategory(location, filter.categories)) return false;
  return matchesQuery(location, filter.query);
}

function matchesLocationIdentifiers(
  location: PublicRentalLocation,
  locationIdentifiers: readonly string[] | undefined,
) {
  if (!locationIdentifiers) return true;
  return locationIdentifiers.includes(location.id);
}

function matchesMunicipality(location: PublicRentalLocation, municipality: MunicipalityFilter) {
  if (municipality === "ALL") return true;
  return readMunicipality(location) === municipality;
}

function matchesCategory(
  location: PublicRentalLocation,
  categories: readonly PublicRentalLegalCategory[],
) {
  if (categories.length === 0) return true;
  return categories.some((category) => location.legalCategories.includes(category));
}

function matchesQuery(location: PublicRentalLocation, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return createSearchTarget(location).includes(normalizedQuery);
}

function createSearchTarget(location: PublicRentalLocation) {
  return normalizeSearchText(`${location.name} ${location.roadAddress}`);
}

function normalizeSearchText(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replaceAll(/\s+/g, "");
}

function readMunicipality(location: PublicRentalLocation) {
  return location.municipality;
}

function readLegalCategories(location: PublicRentalLocation) {
  return location.legalCategories;
}
