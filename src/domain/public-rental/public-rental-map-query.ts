import type {
  PublicRentalLegalCategory,
  PublicRentalLocation,
  PublicRentalMunicipality,
} from "./public-rental-location";

const INDIVIDUAL_PIN_LEVEL = 6;
const INDIVIDUAL_PIN_LIMIT = 180;
const INDIVIDUAL_PIN_CELL_PIXELS = 48;
const CLUSTER_CELL_PIXELS = 96;
const MINIMUM_CLUSTER_COLUMNS = 3;
const MAXIMUM_CLUSTER_COLUMNS = 12;
const MINIMUM_CLUSTER_ROWS = 3;
const MAXIMUM_CLUSTER_ROWS = 10;

export type PublicRentalMapViewport = Readonly<{
  east: number;
  height: number;
  level: number;
  north: number;
  south: number;
  west: number;
  width: number;
}>;

export type PublicRentalMapFilter = Readonly<{
  categories: readonly PublicRentalLegalCategory[];
  locationIdentifiers?: readonly string[];
  municipality: "ALL" | PublicRentalMunicipality;
  query: string;
}>;

export type PublicRentalMapRequest = Readonly<{
  filter: PublicRentalMapFilter;
  viewport: PublicRentalMapViewport;
}>;

export type PublicRentalMapCluster = Readonly<{
  bounds: Readonly<{ east: number; north: number; south: number; west: number }>;
  coordinate: Readonly<{ latitude: number; longitude: number }>;
  count: number;
  id: string;
}>;

export type PublicRentalMapResult = Readonly<{
  clusters: readonly PublicRentalMapCluster[];
  locations: readonly PublicRentalLocation[];
  mode: "clusters" | "locations";
  totalLocationCount: number;
}>;

type LocatedPublicRentalLocation = PublicRentalLocation &
  Readonly<{ coordinate: NonNullable<PublicRentalLocation["coordinate"]> }>;

type Grid = Readonly<{
  columns: number;
  latitudeStep: number;
  longitudeStep: number;
  rows: number;
}>;

type GridCell = Readonly<{ column: number; row: number }>;

export function createPublicRentalMapResult(
  locations: readonly PublicRentalLocation[],
  request: PublicRentalMapRequest,
): PublicRentalMapResult {
  const matches = findMapLocations(locations, request);
  if (shouldShowIndividualPins(matches, request.viewport)) {
    return createLocationResult(matches);
  }
  return createClusterResult(matches, request.viewport);
}

function findMapLocations(
  locations: readonly PublicRentalLocation[],
  request: PublicRentalMapRequest,
) {
  return locations.filter(hasCoordinate).filter((location) => matchesRequest(location, request));
}

function hasCoordinate(location: PublicRentalLocation): location is LocatedPublicRentalLocation {
  return location.coordinate !== null;
}

function matchesRequest(location: LocatedPublicRentalLocation, request: PublicRentalMapRequest) {
  if (!isWithinViewport(location, request.viewport)) return false;
  if (!matchesLocationIdentifiers(location, request.filter.locationIdentifiers)) return false;
  if (!matchesMunicipality(location, request.filter.municipality)) return false;
  if (!matchesCategories(location, request.filter.categories)) return false;
  return matchesQuery(location, request.filter.query);
}

function matchesLocationIdentifiers(
  location: LocatedPublicRentalLocation,
  locationIdentifiers: readonly string[] | undefined,
) {
  if (!locationIdentifiers) return true;
  return locationIdentifiers.includes(location.id);
}

function isWithinViewport(
  location: LocatedPublicRentalLocation,
  viewport: PublicRentalMapViewport,
) {
  const coordinate = location.coordinate;
  return (
    coordinate.latitude >= viewport.south &&
    coordinate.latitude <= viewport.north &&
    coordinate.longitude >= viewport.west &&
    coordinate.longitude <= viewport.east
  );
}

function matchesMunicipality(
  location: LocatedPublicRentalLocation,
  municipality: PublicRentalMapFilter["municipality"],
) {
  if (municipality === "ALL") return true;
  return location.municipality === municipality;
}

function matchesCategories(
  location: LocatedPublicRentalLocation,
  categories: readonly PublicRentalLegalCategory[],
) {
  if (categories.length === 0) return true;
  return categories.some((category) => location.legalCategories.includes(category));
}

function matchesQuery(location: LocatedPublicRentalLocation, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(`${location.name} ${location.roadAddress}`).includes(normalizedQuery);
}

function normalizeSearchText(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replaceAll(/\s+/gu, "");
}

function shouldShowIndividualPins(
  locations: readonly LocatedPublicRentalLocation[],
  viewport: PublicRentalMapViewport,
) {
  if (viewport.level > INDIVIDUAL_PIN_LEVEL) return false;
  if (locations.length > INDIVIDUAL_PIN_LIMIT) return false;
  return hasSeparatedPins(locations, viewport);
}

function hasSeparatedPins(
  locations: readonly LocatedPublicRentalLocation[],
  viewport: PublicRentalMapViewport,
) {
  const grid = createPinGrid(viewport);
  const occupiedCells = locations.map((location) => createPinCellKey(location, viewport, grid));
  return new Set(occupiedCells).size === locations.length;
}

function createPinGrid(viewport: PublicRentalMapViewport): Grid {
  const columns = readPinGridCount(viewport.width);
  const rows = readPinGridCount(viewport.height);
  return {
    columns,
    latitudeStep: (viewport.north - viewport.south) / rows,
    longitudeStep: (viewport.east - viewport.west) / columns,
    rows,
  };
}

function readPinGridCount(size: number) {
  return Math.max(1, Math.floor(size / INDIVIDUAL_PIN_CELL_PIXELS));
}

function createPinCellKey(
  location: LocatedPublicRentalLocation,
  viewport: PublicRentalMapViewport,
  grid: Grid,
) {
  return createGridCellKey(locateGridCell(location.coordinate, viewport, grid));
}

function createLocationResult(
  locations: readonly LocatedPublicRentalLocation[],
): PublicRentalMapResult {
  return {
    clusters: [],
    locations,
    mode: "locations",
    totalLocationCount: locations.length,
  };
}

function createClusterResult(
  locations: readonly LocatedPublicRentalLocation[],
  viewport: PublicRentalMapViewport,
): PublicRentalMapResult {
  const grid = createGrid(viewport);
  return {
    clusters: createMapClusters(locations, viewport, grid),
    locations: [],
    mode: "clusters",
    totalLocationCount: locations.length,
  };
}

function createGrid(viewport: PublicRentalMapViewport): Grid {
  const columns = readGridCount(viewport.width, MINIMUM_CLUSTER_COLUMNS, MAXIMUM_CLUSTER_COLUMNS);
  const rows = readGridCount(viewport.height, MINIMUM_CLUSTER_ROWS, MAXIMUM_CLUSTER_ROWS);
  return {
    columns,
    latitudeStep: (viewport.north - viewport.south) / rows,
    longitudeStep: (viewport.east - viewport.west) / columns,
    rows,
  };
}

function readGridCount(size: number, minimum: number, maximum: number) {
  const preferred = Math.floor(size / CLUSTER_CELL_PIXELS);
  return Math.min(maximum, Math.max(minimum, preferred));
}

function createMapClusters(
  locations: readonly LocatedPublicRentalLocation[],
  viewport: PublicRentalMapViewport,
  grid: Grid,
) {
  const buckets = createClusterBuckets(locations, viewport, grid);
  return Array.from(buckets.entries()).map(([cell, values]) =>
    createMapCluster(cell, values, viewport, grid),
  );
}

function createClusterBuckets(
  locations: readonly LocatedPublicRentalLocation[],
  viewport: PublicRentalMapViewport,
  grid: Grid,
) {
  const buckets = new Map<string, LocatedPublicRentalLocation[]>();
  locations.forEach((location) => addToClusterBucket(buckets, location, viewport, grid));
  return buckets;
}

function addToClusterBucket(
  buckets: Map<string, LocatedPublicRentalLocation[]>,
  location: LocatedPublicRentalLocation,
  viewport: PublicRentalMapViewport,
  grid: Grid,
) {
  const cell = locateGridCell(location.coordinate, viewport, grid);
  const key = createGridCellKey(cell);
  const values = buckets.get(key) ?? [];
  values.push(location);
  buckets.set(key, values);
}

function locateGridCell(
  coordinate: LocatedPublicRentalLocation["coordinate"],
  viewport: PublicRentalMapViewport,
  grid: Grid,
): GridCell {
  return {
    column: readGridIndex(coordinate.longitude, viewport.west, grid.longitudeStep, grid.columns),
    row: readGridIndex(viewport.north - coordinate.latitude, 0, grid.latitudeStep, grid.rows),
  };
}

function readGridIndex(value: number, origin: number, step: number, length: number) {
  const index = Math.floor((value - origin) / step);
  return Math.min(length - 1, Math.max(0, index));
}

function createGridCellKey(cell: GridCell) {
  return `${cell.column}:${cell.row}`;
}

function createMapCluster(
  key: string,
  locations: readonly LocatedPublicRentalLocation[],
  viewport: PublicRentalMapViewport,
  grid: Grid,
): PublicRentalMapCluster {
  const cell = parseGridCellKey(key);
  return {
    bounds: createClusterBounds(cell, viewport, grid),
    coordinate: createClusterCoordinate(locations),
    count: locations.length,
    id: `cluster:${key}`,
  };
}

function parseGridCellKey(key: string): GridCell {
  const [columnText, rowText] = key.split(":");
  return { column: Number(columnText), row: Number(rowText) };
}

function createClusterBounds(cell: GridCell, viewport: PublicRentalMapViewport, grid: Grid) {
  const north = viewport.north - cell.row * grid.latitudeStep;
  const west = viewport.west + cell.column * grid.longitudeStep;
  return { east: west + grid.longitudeStep, north, south: north - grid.latitudeStep, west };
}

function createClusterCoordinate(locations: readonly LocatedPublicRentalLocation[]) {
  const count = locations.length;
  return {
    latitude: locations.reduce(sumLatitude, 0) / count,
    longitude: locations.reduce(sumLongitude, 0) / count,
  };
}

function sumLatitude(total: number, location: LocatedPublicRentalLocation) {
  return total + location.coordinate.latitude;
}

function sumLongitude(total: number, location: LocatedPublicRentalLocation) {
  return total + location.coordinate.longitude;
}
