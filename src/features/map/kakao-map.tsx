"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, Dispatch, RefObject, SetStateAction } from "react";

import type {
  PublicRentalMapCluster,
  PublicRentalMapViewport,
  PublicRentalLegalCategory,
  PublicRentalLocation,
  PublicRentalMunicipality,
} from "@/domain/public-rental";
import { createGyeonggiMunicipalities } from "@/domain/public-rental";
import {
  renderKakaoMap,
  type KakaoMapController,
  type MapBounds,
  type MapMarkerConfiguration,
  type MapPadding,
} from "@/infrastructure/kakao/kakao-map-sdk";

import { MapControls } from "./map-controls";
import { createMapMarkerDetail } from "./map-location-detail";
import { MapLocationPanel, type MapLocationPanelProperties } from "./map-location-panel";
import {
  createAvailableCategories,
  createAvailableMunicipalities,
  filterMapLocations,
  toggleCategory,
  type MunicipalityFilter,
} from "./map-location-filter";
import { usePublicRentalMapData, type PublicRentalMapData } from "./public-rental-map-data";
import { usePageViewAnalytics } from "./use-page-view-analytics";

const GYEONGGI_CENTER = {
  latitude: 37.45,
  level: 10,
  longitude: 127.25,
};

const COLLAPSED_MAP_PADDING: MapPadding = {
  bottom: 160,
  left: 24,
  right: 24,
  top: 56,
};

const DESKTOP_MAP_PADDING: MapPadding = {
  bottom: 24,
  left: 24,
  right: 24,
  top: 24,
};

const ALL_PUBLIC_RENTAL_CATEGORIES = [
  "NATIONAL_RENTAL",
  "PERMANENT_RENTAL",
  "HAPPY_HOUSING",
  "INTEGRATED_PUBLIC_RENTAL",
  "PUBLIC_RENTAL",
  "PURCHASE_RENTAL",
] as const satisfies readonly PublicRentalLegalCategory[];
const ALL_GYEONGGI_MUNICIPALITIES = createGyeonggiMunicipalities();

type KakaoMapProperties = Readonly<{
  javascriptKey?: string;
  locations?: readonly PublicRentalLocation[];
}>;

type MapState = Readonly<{
  reason?: "load-failed" | "missing-key";
  status: "error" | "loading" | "ready";
}>;

type ExplorerState = Readonly<{
  categories: readonly PublicRentalLegalCategory[];
  expanded: boolean;
  fitRevision: number;
  municipality: MunicipalityFilter;
  pendingLocationIds: readonly string[] | undefined;
  query: string;
  selectedLocationId: string | undefined;
  viewportLocationIds: readonly string[] | undefined;
}>;

type ExplorerActions = Readonly<{
  applyViewport: () => void;
  changeMunicipality: (municipality: MunicipalityFilter) => void;
  changeQuery: (query: string) => void;
  clearViewport: () => void;
  reportViewport: (locationIds: readonly string[]) => void;
  resetFilters: () => void;
  selectLocation: (locationId: string) => void;
  toggleCategory: (category: PublicRentalLegalCategory) => void;
  toggleExpanded: () => void;
}>;

type ExplorerModel = Readonly<{
  actions: ExplorerActions;
  availableCategories: readonly PublicRentalLegalCategory[];
  availableMunicipalities: readonly PublicRentalMunicipality[];
  displayedLocations: readonly PublicRentalLocation[];
  pendingLocationCount: number | undefined;
  mapData: PublicRentalMapData;
  selectedLocation: PublicRentalLocation | undefined;
  selectedLocationId: string | undefined;
  state: ExplorerState;
}>;

type ControllerLifecycle = {
  active: boolean;
};

type LocatedPublicRentalLocation = PublicRentalLocation &
  Readonly<{ coordinate: NonNullable<PublicRentalLocation["coordinate"]> }>;

const INITIAL_EXPLORER_STATE: ExplorerState = {
  categories: [],
  expanded: false,
  fitRevision: 0,
  municipality: "ALL",
  pendingLocationIds: undefined,
  query: "",
  selectedLocationId: undefined,
  viewportLocationIds: undefined,
};

const LOADING_STATE: MapState = { status: "loading" };
const READY_STATE: MapState = { status: "ready" };
const LOAD_FAILED_STATE: MapState = { reason: "load-failed", status: "error" };
const MISSING_KEY_STATE: MapState = { reason: "missing-key", status: "error" };

export function KakaoMap(properties: KakaoMapProperties) {
  const containerReference = useRef<HTMLDivElement>(null);
  const controllerReference = useRef<KakaoMapController | undefined>(undefined);
  const [viewport, setViewport] = useState<PublicRentalMapViewport | undefined>(undefined);
  const references = useMemo(
    () => ({ containerReference, controllerReference }),
    [containerReference, controllerReference],
  );
  const explorer = useMapExplorer(properties.locations, viewport);
  const interactions = useMapInteractions(explorer, controllerReference);
  const onViewportChanged = useViewportChangeHandler(controllerReference, setViewport);
  const locationMarkers = useMarkers(explorer.displayedLocations, explorer.actions.selectLocation);
  const clusterMarkers = useClusterMarkers(explorer.mapData.clusters, interactions.onClusterSelect);
  const markers = useMemo(
    () => [...locationMarkers, ...clusterMarkers],
    [clusterMarkers, locationMarkers],
  );
  const mapState = useMapRuntime(
    createRuntimeInput(properties, explorer, markers, onViewportChanged),
    references,
  );
  usePageViewAnalytics(mapState.status);
  const layout = createLayoutProperties(explorer, mapState, interactions);
  return <KakaoMapLayout {...layout} containerReference={containerReference} />;
}

type MapRuntimeInput = Readonly<{
  expanded: boolean;
  fitRevision: number;
  javascriptKey: string | undefined;
  markers: readonly MapMarkerConfiguration[];
  onViewportChanged: () => void;
  selectedLocationId: string | undefined;
}>;

type MapReferences = Readonly<{
  containerReference: RefObject<HTMLDivElement | null>;
  controllerReference: RefObject<KakaoMapController | undefined>;
}>;

function createRuntimeInput(
  properties: KakaoMapProperties,
  explorer: ExplorerModel,
  markers: readonly MapMarkerConfiguration[],
  onViewportChanged: () => void,
): MapRuntimeInput {
  return {
    expanded: explorer.state.expanded,
    fitRevision: explorer.state.fitRevision,
    javascriptKey: properties.javascriptKey,
    markers,
    onViewportChanged,
    selectedLocationId: explorer.selectedLocationId,
  };
}

function useMapRuntime(input: MapRuntimeInput, references: MapReferences) {
  const mapState = useMapController(input, references);
  useMarkerSynchronization(input, references.controllerReference, mapState);
  useSelectionSynchronization(input.selectedLocationId, references.controllerReference, mapState);
  useMapRelayout(input.expanded, references.controllerReference, mapState);
  return mapState;
}

function useMapController(input: MapRuntimeInput, references: MapReferences) {
  const [mapState, setMapState] = useState<MapState>(() =>
    createInitialMapState(input.javascriptKey),
  );
  const initialMarkers = useRef(input.markers);
  const javascriptKey = input.javascriptKey;
  const onViewportChanged = input.onViewportChanged;
  useEffect(() => {
    return startMapController(
      javascriptKey,
      references,
      initialMarkers.current,
      onViewportChanged,
      setMapState,
    );
  }, [javascriptKey, onViewportChanged, references]);
  return mapState;
}

function startMapController(
  javascriptKey: string | undefined,
  references: MapReferences,
  markers: readonly MapMarkerConfiguration[],
  onViewportChanged: () => void,
  setMapState: Dispatch<SetStateAction<MapState>>,
) {
  const container = references.containerReference.current;
  if (!container || !hasJavascriptKey(javascriptKey)) {
    setMapState(MISSING_KEY_STATE);
    return;
  }
  return renderController(
    javascriptKey,
    markers,
    container,
    onViewportChanged,
    references,
    setMapState,
  );
}

function renderController(
  javascriptKey: string,
  markers: readonly MapMarkerConfiguration[],
  container: HTMLDivElement,
  onViewportChanged: () => void,
  references: MapReferences,
  setMapState: Dispatch<SetStateAction<MapState>>,
) {
  const lifecycle: ControllerLifecycle = { active: true };
  setMapState(LOADING_STATE);
  const configuration = { ...GYEONGGI_CENTER, onViewportChanged };
  renderKakaoMap(container, javascriptKey.trim(), configuration, markers)
    .then((controller) =>
      completeController(controller, lifecycle, onViewportChanged, references, setMapState),
    )
    .catch(() => failController(lifecycle, setMapState));
  return () => stopController(lifecycle, references.controllerReference);
}

function completeController(
  controller: KakaoMapController,
  lifecycle: ControllerLifecycle,
  onViewportChanged: () => void,
  references: MapReferences,
  setMapState: Dispatch<SetStateAction<MapState>>,
) {
  if (!lifecycle.active) return controller.destroy();
  references.controllerReference.current = controller;
  setMapState(READY_STATE);
  onViewportChanged();
}

function failController(
  lifecycle: ControllerLifecycle,
  setMapState: Dispatch<SetStateAction<MapState>>,
) {
  if (!lifecycle.active) return;
  setMapState(LOAD_FAILED_STATE);
}

function stopController(
  lifecycle: ControllerLifecycle,
  controllerReference: RefObject<KakaoMapController | undefined>,
) {
  lifecycle.active = false;
  controllerReference.current?.destroy();
  controllerReference.current = undefined;
}

function useMarkerSynchronization(
  input: MapRuntimeInput,
  controllerReference: RefObject<KakaoMapController | undefined>,
  mapState: MapState,
) {
  const lastFitRevision = useRef(-1);
  const expanded = input.expanded;
  const fitRevision = input.fitRevision;
  const markers = input.markers;
  useEffect(() => {
    const padding = readMapPadding(expanded);
    synchronizeMarkers(
      markers,
      fitRevision,
      padding,
      controllerReference.current,
      mapState,
      lastFitRevision,
    );
  }, [controllerReference, expanded, fitRevision, mapState, markers]);
}

function synchronizeMarkers(
  markers: readonly MapMarkerConfiguration[],
  fitRevision: number,
  padding: MapPadding,
  controller: KakaoMapController | undefined,
  mapState: MapState,
  lastFitRevision: RefObject<number>,
) {
  if (!controller || mapState.status !== "ready") return;
  controller.replaceMarkers(markers);
  if (lastFitRevision.current === fitRevision) return;
  controller.fitMarkers(padding);
  lastFitRevision.current = fitRevision;
}

function useSelectionSynchronization(
  locationId: string | undefined,
  controllerReference: RefObject<KakaoMapController | undefined>,
  mapState: MapState,
) {
  useEffect(() => {
    if (mapState.status !== "ready") return;
    controllerReference.current?.selectMarker(locationId);
  }, [controllerReference, locationId, mapState]);
}

function useMapRelayout(
  expanded: boolean,
  controllerReference: RefObject<KakaoMapController | undefined>,
  mapState: MapState,
) {
  useEffect(() => {
    if (mapState.status !== "ready") return;
    controllerReference.current?.relayout();
  }, [controllerReference, expanded, mapState]);
}

function useMapExplorer(
  staticLocations: readonly PublicRentalLocation[] | undefined,
  viewport: PublicRentalMapViewport | undefined,
): ExplorerModel {
  const [state, setState] = useState<ExplorerState>(INITIAL_EXPLORER_STATE);
  const actions = useMemo(() => createExplorerActions(setState), []);
  const filter = useMemo(
    () => createMapFilter(state.categories, state.municipality, state.query),
    [state.categories, state.municipality, state.query],
  );
  const mapData = usePublicRentalMapData(staticLocations, viewport, filter);
  const locations = mapData.locations;
  const filtered = useFilteredLocations(locations, state);
  const displayed = useViewportLocations(filtered, state.viewportLocationIds);
  const selectedLocation = findLocation(displayed, state.selectedLocationId);
  const pendingLocationCount = readPendingLocationCount(filtered, displayed, state);
  const availableCategories = readAvailableCategories(locations);
  const availableMunicipalities = readAvailableMunicipalities(locations);
  return createExplorerModel(
    state,
    actions,
    displayed,
    selectedLocation,
    pendingLocationCount,
    availableCategories,
    availableMunicipalities,
    mapData,
  );
}

function readAvailableCategories(locations: readonly PublicRentalLocation[]) {
  const categories = createAvailableCategories(locations);
  if (categories.length > 0) return categories;
  return ALL_PUBLIC_RENTAL_CATEGORIES;
}

function readAvailableMunicipalities(locations: readonly PublicRentalLocation[]) {
  const municipalities = createAvailableMunicipalities(locations);
  if (municipalities.length > 0) return municipalities;
  return ALL_GYEONGGI_MUNICIPALITIES;
}

function createMapFilter(
  categories: readonly PublicRentalLegalCategory[],
  municipality: MunicipalityFilter,
  query: string,
) {
  return { categories, municipality, query };
}

function useFilteredLocations(locations: readonly PublicRentalLocation[], state: ExplorerState) {
  const categories = state.categories;
  const municipality = state.municipality;
  const query = state.query;
  return useMemo(
    () => filterMapLocations(locations, { categories, municipality, query }),
    [categories, locations, municipality, query],
  );
}

function useViewportLocations(
  locations: readonly PublicRentalLocation[],
  locationIds: readonly string[] | undefined,
) {
  return useMemo(() => applyViewportFilter(locations, locationIds), [locationIds, locations]);
}

function createExplorerModel(
  state: ExplorerState,
  actions: ExplorerActions,
  displayedLocations: readonly PublicRentalLocation[],
  selectedLocation: PublicRentalLocation | undefined,
  pendingLocationCount: number | undefined,
  availableCategories: readonly PublicRentalLegalCategory[],
  availableMunicipalities: readonly PublicRentalMunicipality[],
  mapData: PublicRentalMapData,
): ExplorerModel {
  const selectedLocationId = selectedLocation?.id;
  return {
    actions,
    availableCategories,
    availableMunicipalities,
    displayedLocations,
    mapData,
    pendingLocationCount,
    selectedLocation,
    selectedLocationId,
    state,
  };
}

function createExplorerActions(setState: Dispatch<SetStateAction<ExplorerState>>): ExplorerActions {
  return {
    applyViewport: () => setState(applyPendingViewport),
    changeMunicipality: (value) => setState((state) => changeMunicipality(state, value)),
    changeQuery: (value) => setState((state) => changeQuery(state, value)),
    clearViewport: () => setState(clearViewport),
    reportViewport: (value) => setState((state) => reportViewport(state, value)),
    resetFilters: () => setState(resetFilters),
    selectLocation: (value) => setState((state) => selectLocation(state, value)),
    toggleCategory: (value) => setState((state) => changeCategory(state, value)),
    toggleExpanded: () => setState(toggleExpanded),
  };
}

function changeMunicipality(state: ExplorerState, municipality: MunicipalityFilter) {
  return resetSpatialFilter({ ...state, municipality });
}

function changeQuery(state: ExplorerState, query: string) {
  return resetSpatialFilter({ ...state, query });
}

function changeCategory(state: ExplorerState, category: PublicRentalLegalCategory) {
  const categories = toggleCategory(state.categories, category);
  return resetSpatialFilter({ ...state, categories });
}

function resetFilters(state: ExplorerState): ExplorerState {
  return resetSpatialFilter({ ...state, categories: [], municipality: "ALL", query: "" });
}

function resetSpatialFilter(state: ExplorerState): ExplorerState {
  return {
    ...state,
    fitRevision: state.fitRevision + 1,
    pendingLocationIds: undefined,
    selectedLocationId: undefined,
    viewportLocationIds: undefined,
  };
}

function reportViewport(state: ExplorerState, locationIds: readonly string[]): ExplorerState {
  return { ...state, pendingLocationIds: uniqueLocationIds(locationIds) };
}

function applyPendingViewport(state: ExplorerState): ExplorerState {
  if (!state.pendingLocationIds) return state;
  return {
    ...state,
    pendingLocationIds: undefined,
    selectedLocationId: readViewportSelection(state),
    viewportLocationIds: state.pendingLocationIds,
  };
}

function clearViewport(state: ExplorerState): ExplorerState {
  return {
    ...state,
    fitRevision: state.fitRevision + 1,
    pendingLocationIds: undefined,
    viewportLocationIds: undefined,
  };
}

function selectLocation(state: ExplorerState, selectedLocationId: string): ExplorerState {
  return { ...state, expanded: true, selectedLocationId };
}

function toggleExpanded(state: ExplorerState): ExplorerState {
  return { ...state, expanded: !state.expanded };
}

function applyViewportFilter(
  locations: readonly PublicRentalLocation[],
  locationIds: readonly string[] | undefined,
) {
  if (!locationIds) return locations;
  const identifiers = new Set(locationIds);
  return locations.filter((location) => identifiers.has(location.id));
}

function readPendingLocationCount(
  filtered: readonly PublicRentalLocation[],
  displayed: readonly PublicRentalLocation[],
  state: ExplorerState,
) {
  if (!state.pendingLocationIds) return undefined;
  const pending = applyViewportFilter(filtered, state.pendingLocationIds);
  if (hasSameLocationIds(pending, displayed)) return undefined;
  return pending.length;
}

function hasSameLocationIds(
  first: readonly PublicRentalLocation[],
  second: readonly PublicRentalLocation[],
) {
  if (first.length !== second.length) return false;
  const secondIdentifiers = new Set(second.map(readLocationId));
  return first.every((location) => secondIdentifiers.has(location.id));
}

function findLocation(locations: readonly PublicRentalLocation[], locationId: string | undefined) {
  if (!locationId) return undefined;
  return locations.find((location) => location.id === locationId);
}

function useMarkers(
  locations: readonly PublicRentalLocation[],
  onSelect: (locationId: string) => void,
) {
  return useMemo(() => createMarkers(locations, onSelect), [locations, onSelect]);
}

function createMarkers(
  locations: readonly PublicRentalLocation[],
  onSelect: (locationId: string) => void,
) {
  return locations.filter(hasCoordinate).map((location) => createMarker(location, onSelect));
}

function createMarker(
  location: LocatedPublicRentalLocation,
  onSelect: (locationId: string) => void,
): MapMarkerConfiguration {
  return {
    categories: location.legalCategories,
    detail: createMapMarkerDetail(location),
    latitude: location.coordinate.latitude,
    locationId: location.id,
    longitude: location.coordinate.longitude,
    onClick: onSelect,
    title: location.name,
  };
}

function useClusterMarkers(
  clusters: readonly PublicRentalMapCluster[],
  onSelect: (bounds: MapBounds) => void,
) {
  return useMemo(() => createClusterMarkers(clusters, onSelect), [clusters, onSelect]);
}

function createClusterMarkers(
  clusters: readonly PublicRentalMapCluster[],
  onSelect: (bounds: MapBounds) => void,
) {
  return clusters.map((cluster) => createClusterMarker(cluster, onSelect));
}

function createClusterMarker(
  cluster: PublicRentalMapCluster,
  onSelect: (bounds: MapBounds) => void,
): MapMarkerConfiguration {
  return {
    categories: [],
    clusterCount: cluster.count,
    latitude: cluster.coordinate.latitude,
    locationId: cluster.id,
    longitude: cluster.coordinate.longitude,
    onClick: () => onSelect(cluster.bounds),
    title: `${cluster.count.toLocaleString("ko-KR")}곳 확대`,
  };
}

type MapLayoutProperties = Readonly<{
  controls: ComponentProps<typeof MapControls>;
  mapState: MapState;
  panel: MapLocationPanelProperties;
}>;

type MapInteractions = Readonly<{
  onClusterSelect: (bounds: MapBounds) => void;
  onListSelect: (locationId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}>;

function useMapInteractions(
  explorer: ExplorerModel,
  controllerReference: RefObject<KakaoMapController | undefined>,
): MapInteractions {
  const onListSelect = (locationId: string) => {
    explorer.actions.selectLocation(locationId);
    controllerReference.current?.focusMarker(locationId, readMapPadding(true));
  };
  const onZoomIn = () => controllerReference.current?.zoomIn();
  const onZoomOut = () => controllerReference.current?.zoomOut();
  const onClusterSelect = (bounds: MapBounds) =>
    controllerReference.current?.focusBounds(bounds, readMapPadding(false));
  return { onClusterSelect, onListSelect, onZoomIn, onZoomOut };
}

function createLayoutProperties(
  explorer: ExplorerModel,
  mapState: MapState,
  interactions: MapInteractions,
): MapLayoutProperties {
  const controls = createControlProperties(explorer, mapState, interactions);
  const panel = createPanelProperties(explorer, interactions);
  return { controls, mapState, panel };
}

function createControlProperties(
  explorer: ExplorerModel,
  mapState: MapState,
  interactions: MapInteractions,
) {
  return {
    expanded: explorer.state.expanded,
    onApplyViewport: explorer.actions.applyViewport,
    onFitAll: explorer.actions.clearViewport,
    onZoomIn: interactions.onZoomIn,
    onZoomOut: interactions.onZoomOut,
    pendingLocationCount: explorer.pendingLocationCount,
    ready: mapState.status === "ready",
  };
}

function createPanelProperties(
  explorer: ExplorerModel,
  interactions: MapInteractions,
): MapLocationPanelProperties {
  return {
    availableCategories: explorer.availableCategories,
    availableMunicipalities: explorer.availableMunicipalities,
    categories: explorer.state.categories,
    expanded: explorer.state.expanded,
    clustered: explorer.mapData.mode === "clusters",
    generatedAt: explorer.mapData.generatedAt,
    locationCount: readPanelLocationCount(explorer),
    locations: explorer.displayedLocations,
    municipality: explorer.state.municipality,
    onCategoryToggle: explorer.actions.toggleCategory,
    onExpandedToggle: explorer.actions.toggleExpanded,
    onMunicipalityChange: explorer.actions.changeMunicipality,
    onQueryChange: explorer.actions.changeQuery,
    onResetFilters: explorer.actions.resetFilters,
    onSelect: interactions.onListSelect,
    query: explorer.state.query,
    selectedLocation: explorer.selectedLocation,
    selectedLocationId: explorer.selectedLocationId,
    status: explorer.mapData.status,
  };
}

function readPanelLocationCount(explorer: ExplorerModel) {
  if (explorer.mapData.mode === "clusters") return explorer.mapData.totalLocationCount;
  return explorer.displayedLocations.length;
}

function KakaoMapLayout(
  properties: MapLayoutProperties &
    Readonly<{ containerReference: RefObject<HTMLDivElement | null> }>,
) {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-slate-100">
      <MapViewport {...properties} />
      <MapLocationPanel {...properties.panel} />
    </main>
  );
}

function MapViewport(
  properties: MapLayoutProperties &
    Readonly<{ containerReference: RefObject<HTMLDivElement | null> }>,
) {
  return (
    <section className="absolute inset-0 md:left-96">
      <MapCanvas
        containerReference={properties.containerReference}
        mapState={properties.mapState}
      />
      <MapFeedback mapState={properties.mapState} />
      <MapControls {...properties.controls} />
    </section>
  );
}

function MapCanvas({
  containerReference,
  mapState,
}: Readonly<{
  containerReference: RefObject<HTMLDivElement | null>;
  mapState: MapState;
}>) {
  return (
    <div
      aria-busy={mapState.status !== "ready"}
      aria-label="경기도 LH 임대주택 지도"
      className="h-full w-full"
      data-map-state={mapState.status}
      ref={containerReference}
      role="region"
    />
  );
}

function MapFeedback({ mapState }: Readonly<{ mapState: MapState }>) {
  if (mapState.status === "ready") return null;
  if (mapState.status === "loading") return <LoadingFeedback />;
  return <ErrorFeedback reason={mapState.reason} />;
}

function LoadingFeedback() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-100" role="status">
      <p className="rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
        지도를 불러오는 중…
      </p>
    </div>
  );
}

function ErrorFeedback({ reason }: Readonly<{ reason?: MapState["reason"] }>) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-100 p-6" role="alert">
      <p className="max-w-md rounded-xl bg-white p-5 text-center text-sm text-slate-700 shadow-sm">
        {createErrorMessage(reason)}
      </p>
    </div>
  );
}

function createErrorMessage(reason: MapState["reason"]) {
  if (reason === "missing-key") {
    return "카카오맵 키가 설정되지 않았습니다. .env.local을 확인해 주세요.";
  }
  return "카카오맵을 불러오지 못했습니다. 등록 도메인과 API 사용 설정을 확인해 주세요.";
}

function createInitialMapState(javascriptKey: string | undefined) {
  if (!hasJavascriptKey(javascriptKey)) return MISSING_KEY_STATE;
  return LOADING_STATE;
}

function hasJavascriptKey(javascriptKey: string | undefined): javascriptKey is string {
  if (!javascriptKey) return false;
  return javascriptKey.trim().length > 0;
}

function hasCoordinate(location: PublicRentalLocation): location is LocatedPublicRentalLocation {
  return location.coordinate !== null;
}

function useViewportChangeHandler(
  controllerReference: RefObject<KakaoMapController | undefined>,
  setViewport: Dispatch<SetStateAction<PublicRentalMapViewport | undefined>>,
) {
  return useCallback(
    () => updateViewport(controllerReference, setViewport),
    [controllerReference, setViewport],
  );
}

function updateViewport(
  controllerReference: RefObject<KakaoMapController | undefined>,
  setViewport: Dispatch<SetStateAction<PublicRentalMapViewport | undefined>>,
) {
  setViewport(readMapViewport(controllerReference.current));
}

function readMapViewport(controller: KakaoMapController | undefined) {
  if (!controller) return undefined;
  return controller.readViewport();
}

function readViewportSelection(state: ExplorerState) {
  const selectedLocationId = state.selectedLocationId;
  if (!selectedLocationId) return undefined;
  if (state.pendingLocationIds?.includes(selectedLocationId)) return selectedLocationId;
  return undefined;
}

function readMapPadding(expanded: boolean) {
  if (!canReadDesktopMedia()) return createMobileMapPadding(expanded);
  if (window.matchMedia("(min-width: 768px)").matches) return DESKTOP_MAP_PADDING;
  return createMobileMapPadding(expanded);
}

function createMobileMapPadding(expanded: boolean) {
  if (!expanded) return COLLAPSED_MAP_PADDING;
  const bottom = Math.round(window.innerHeight * 0.56) + 16;
  return { ...COLLAPSED_MAP_PADDING, bottom };
}

function canReadDesktopMedia() {
  if (typeof window === "undefined") return false;
  return typeof window.matchMedia === "function";
}

function uniqueLocationIds(locationIds: readonly string[]) {
  return [...new Set(locationIds)];
}

function readLocationId(location: PublicRentalLocation) {
  return location.id;
}
