import { createMapMarkerImage, type MapMarkerCategory } from "./kakao-map-marker-image";

export type { MapMarkerCategory } from "./kakao-map-marker-image";

const KAKAO_MAP_SDK_SOURCE = "https://dapi.kakao.com/v2/maps/sdk.js";
const KAKAO_MAP_SDK_TIMEOUT_MILLISECONDS = 10_000;
const KAKAO_MAP_READY_TIMEOUT_MILLISECONDS = 10_000;
const KAKAO_MAP_SDK_ERROR = "카카오맵 SDK를 불러오지 못했습니다.";
const KAKAO_MAP_READY_ERROR = "카카오맵 타일을 불러오지 못했습니다.";
const SELECTED_MARKER_Z_INDEX = 20;
const DEFAULT_MARKER_Z_INDEX = 0;
const FOCUSED_MAP_LEVEL = 4;
const KAKAO_MAP_MAX_LEVEL = 14;
const CLUSTER_CLICK_PADDING = 48;
const DETAIL_OVERLAY_Z_INDEX = 30;
const DETAIL_OVERLAY_MEDIA_QUERY = "(min-width: 768px)";
const AGGREGATE_MARKER_BACKGROUND = "#172554";
const AGGREGATE_MARKER_BORDER = "#ffffff";

export type MapPadding = Readonly<{
  bottom: number;
  left: number;
  right: number;
  top: number;
}>;

export type MapMarkerDetailRow = Readonly<{
  areaText: string;
  categoryLabel: string;
  householdText: string;
}>;

export type MapMarkerDetail = Readonly<{
  address: string;
  rows: readonly MapMarkerDetailRow[];
}>;

export type MapBounds = Readonly<{
  east: number;
  north: number;
  south: number;
  west: number;
}>;

export type MapViewport = MapBounds &
  Readonly<{
    height: number;
    level: number;
    width: number;
  }>;

export type KakaoMapConfiguration = Readonly<{
  latitude: number;
  level: number;
  longitude: number;
  onViewportChanged?: () => void;
}>;

export type MapMarkerConfiguration = Readonly<{
  categories: readonly MapMarkerCategory[];
  clusterCount?: number;
  detail?: MapMarkerDetail;
  latitude: number;
  locationId: string;
  longitude: number;
  onClick?: (locationId: string) => void;
  title: string;
}>;

export type KakaoMapMarkerConfiguration = MapMarkerConfiguration;

export type KakaoMapController = Readonly<{
  destroy: () => void;
  fitMarkers: (padding: MapPadding) => void;
  focusBounds: (bounds: MapBounds, padding: MapPadding) => void;
  focusMarker: (locationId: string, padding: MapPadding) => void;
  readViewport: () => MapViewport | undefined;
  readVisibleLocationIds: () => readonly string[];
  relayout: () => void;
  replaceMarkers: (markers: readonly MapMarkerConfiguration[]) => void;
  selectMarker: (locationId: string | undefined) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}>;

type KakaoEventHandler = (...arguments_: readonly unknown[]) => void;
type KakaoEventTarget = object;
type KakaoLatLngInstance = Readonly<{
  getLat: () => number;
  getLng: () => number;
}>;
type KakaoCustomOverlayInstance = Readonly<{
  setContent: (content: HTMLElement) => void;
  setMap: (map: KakaoMapInstance | null) => void;
  setPosition: (position: KakaoLatLngInstance) => void;
}>;
type KakaoMarkerImageInstance = object;
type KakaoPointInstance = object;
type KakaoSizeInstance = object;

type KakaoLatLngBoundsInstance = Readonly<{
  contain: (position: KakaoLatLngInstance) => boolean;
  extend: (position: KakaoLatLngInstance) => void;
  getNorthEast: () => KakaoLatLngInstance;
  getSouthWest: () => KakaoLatLngInstance;
}>;

type KakaoMapInstance = Readonly<{
  getBounds: () => KakaoLatLngBoundsInstance;
  getLevel: () => number;
  panBy: (horizontalPixels: number, verticalPixels: number) => void;
  relayout: () => void;
  setCenter: (position: KakaoLatLngInstance) => void;
  setBounds: (
    bounds: KakaoLatLngBoundsInstance,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ) => void;
  setLevel: (level: number) => void;
}>;

type KakaoMarkerInstance = Readonly<{
  getPosition: () => KakaoLatLngInstance;
  setImage: (image: KakaoMarkerImageInstance) => void;
  setMap: (map: KakaoMapInstance | null) => void;
  setZIndex: (zIndex: number) => void;
}>;

type KakaoMarkerClustererInstance = Readonly<{
  addMarkers: (markers: readonly KakaoMarkerInstance[]) => void;
  clear: () => void;
}>;

type KakaoClusterInstance = Readonly<{
  getBounds: () => KakaoLatLngBoundsInstance;
}>;

type KakaoMapConstructorOptions = Readonly<{
  center: KakaoLatLngInstance;
  draggable: boolean;
  level: number;
  scrollwheel: boolean;
}>;

type KakaoMarkerConstructorOptions = Readonly<{
  clickable: boolean;
  image: KakaoMarkerImageInstance;
  position: KakaoLatLngInstance;
  title: string;
}>;

type KakaoMarkerClustererOptions = Readonly<{
  averageCenter: boolean;
  calculator: readonly number[];
  disableClickZoom: boolean;
  gridSize: number;
  map: KakaoMapInstance;
  markers: readonly KakaoMarkerInstance[];
  minClusterSize: number;
  minLevel: number;
  styles: readonly Readonly<Record<string, string>>[];
}>;

type KakaoCustomOverlayOptions = Readonly<{
  clickable: boolean;
  content: HTMLElement;
  position: KakaoLatLngInstance;
  xAnchor: number;
  yAnchor: number;
  zIndex: number;
}>;

type KakaoEventApi = Readonly<{
  addListener: (target: KakaoEventTarget, type: string, handler: KakaoEventHandler) => void;
  removeListener: (target: KakaoEventTarget, type: string, handler: KakaoEventHandler) => void;
}>;

type KakaoMapConstructor = new (
  container: HTMLElement,
  options: KakaoMapConstructorOptions,
) => KakaoMapInstance;
type KakaoLatLngConstructor = new (latitude: number, longitude: number) => KakaoLatLngInstance;
type KakaoLatLngBoundsConstructor = new () => KakaoLatLngBoundsInstance;
type KakaoMarkerConstructor = new (options: KakaoMarkerConstructorOptions) => KakaoMarkerInstance;
type KakaoMarkerClustererConstructor = new (
  options: KakaoMarkerClustererOptions,
) => KakaoMarkerClustererInstance;
type KakaoCustomOverlayConstructor = new (
  options: KakaoCustomOverlayOptions,
) => KakaoCustomOverlayInstance;
type KakaoMarkerImageConstructor = new (
  source: string,
  size: KakaoSizeInstance,
  options: Readonly<{ offset: KakaoPointInstance }>,
) => KakaoMarkerImageInstance;
type KakaoPointConstructor = new (x: number, y: number) => KakaoPointInstance;
type KakaoSizeConstructor = new (width: number, height: number) => KakaoSizeInstance;

type KakaoMapsApi = Readonly<{
  CustomOverlay: KakaoCustomOverlayConstructor;
  event: KakaoEventApi;
  LatLng: KakaoLatLngConstructor;
  LatLngBounds: KakaoLatLngBoundsConstructor;
  load: (callback: () => void) => void;
  Map: KakaoMapConstructor;
  Marker: KakaoMarkerConstructor;
  MarkerClusterer: KakaoMarkerClustererConstructor;
  MarkerImage: KakaoMarkerImageConstructor;
  Point: KakaoPointConstructor;
  Size: KakaoSizeConstructor;
}>;

type KakaoNamespace = Readonly<{ maps: KakaoMapsApi }>;
type KakaoWindow = Window & typeof globalThis & { kakao?: KakaoNamespace };

type MarkerRecord = Readonly<{
  clickHandler: KakaoEventHandler | undefined;
  configuration: MapMarkerConfiguration;
  marker: KakaoMarkerInstance;
  position: KakaoLatLngInstance;
}>;

type ControllerResources = Readonly<{
  clusterer: KakaoMarkerClustererInstance;
  container: HTMLElement;
  map: KakaoMapInstance;
  maps: KakaoMapsApi;
}>;

type ControllerLifecycle = {
  clusterClickHandler: KakaoEventHandler;
  detailOverlay: KakaoCustomOverlayInstance | undefined;
  destroyed: boolean;
  idleHandler: KakaoEventHandler | undefined;
  selectedLocationId: string | undefined;
};

type ControllerState = {
  lifecycle: ControllerLifecycle;
  markerRecords: Map<string, MarkerRecord>;
  resources: ControllerResources;
};

type SharedMapRendering = {
  controllerLoading: Promise<KakaoMapController>;
  leaseCount: number;
};

type ControllerLeaseState = {
  active: boolean;
  container: HTMLElement;
  controller: KakaoMapController;
  rendering: SharedMapRendering;
};

const CLUSTER_STYLE_BASE = {
  alignItems: "center",
  background: "#172554",
  border: "3px solid #ffffff",
  borderRadius: "9999px",
  boxShadow: "0 3px 10px rgba(15, 23, 42, 0.35)",
  color: "#ffffff",
  display: "flex",
  fontSize: "13px",
  fontWeight: "800",
  justifyContent: "center",
};
const CLUSTER_STYLES = [createClusterStyle(40), createClusterStyle(48), createClusterStyle(56)];
const CLUSTER_PADDING: MapPadding = {
  bottom: CLUSTER_CLICK_PADDING,
  left: CLUSTER_CLICK_PADDING,
  right: CLUSTER_CLICK_PADDING,
  top: CLUSTER_CLICK_PADDING,
};
const DETAIL_CARD_STYLE = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.2)",
  color: "#0f172a",
  maxWidth: "260px",
  padding: "12px",
  transform: "translateY(-58px)",
  whiteSpace: "normal",
  width: "max-content",
};

let sdkLoading: Promise<KakaoNamespace> | undefined;
const mapRenderings = new WeakMap<HTMLElement, SharedMapRendering>();

export function createKakaoMapSdkSource(javascriptKey: string) {
  const source = new URL(KAKAO_MAP_SDK_SOURCE);
  source.searchParams.set("appkey", javascriptKey);
  source.searchParams.set("autoload", "false");
  source.searchParams.set("libraries", "clusterer");
  return source.toString();
}

export function loadKakaoMapSdk(javascriptKey: string) {
  const existingKakao = readKakaoNamespace();
  if (existingKakao) return waitForKakaoMaps(existingKakao);
  if (sdkLoading) return sdkLoading;
  sdkLoading = rememberSdkLoading(createSdkLoading(javascriptKey));
  return sdkLoading;
}

export function renderKakaoMap(
  container: HTMLElement,
  javascriptKey: string,
  configuration: KakaoMapConfiguration,
  markers: readonly MapMarkerConfiguration[] = [],
) {
  const rendering = readOrCreateMapRendering(container, javascriptKey, configuration, markers);
  rendering.leaseCount += 1;
  return rendering.controllerLoading.then((controller) =>
    createControllerLease(container, rendering, controller),
  );
}

function readOrCreateMapRendering(
  container: HTMLElement,
  javascriptKey: string,
  configuration: KakaoMapConfiguration,
  markers: readonly MapMarkerConfiguration[],
) {
  const existingRendering = mapRenderings.get(container);
  if (existingRendering) return existingRendering;
  const controllerLoading = createMapRendering(container, javascriptKey, configuration, markers);
  const rendering = { controllerLoading, leaseCount: 0 };
  mapRenderings.set(container, rendering);
  return rendering;
}

function createMapRendering(
  container: HTMLElement,
  javascriptKey: string,
  configuration: KakaoMapConfiguration,
  markers: readonly MapMarkerConfiguration[],
) {
  const rendering = loadKakaoMapSdk(javascriptKey).then((kakao) =>
    createReadyMap(kakao, container, configuration, markers),
  );
  return rendering.catch((error: unknown) => forgetMapRendering(container, error));
}

function createReadyMap(
  kakao: KakaoNamespace,
  container: HTMLElement,
  configuration: KakaoMapConfiguration,
  markers: readonly MapMarkerConfiguration[],
) {
  assertDistinctLocationIds(markers);
  const resources = createControllerResources(kakao.maps, container, configuration);
  const tilesLoading = waitForMapTiles(kakao.maps.event, resources.map);
  const state = createControllerState(resources, configuration.onViewportChanged);
  const controller = createController(state);
  registerControllerEvents(state);
  controller.replaceMarkers(markers);
  return completeMapReadiness(tilesLoading, controller);
}

function completeMapReadiness(tilesLoading: Promise<void>, controller: KakaoMapController) {
  return tilesLoading
    .then(() => controller)
    .catch((error: unknown) => destroyControllerWithError(controller, error));
}

function createControllerResources(
  maps: KakaoMapsApi,
  container: HTMLElement,
  configuration: KakaoMapConfiguration,
) {
  const center = new maps.LatLng(configuration.latitude, configuration.longitude);
  const map = new maps.Map(container, createMapOptions(center, configuration.level));
  const clusterer = new maps.MarkerClusterer(createClustererOptions(map));
  return { clusterer, container, map, maps };
}

function createControllerState(
  resources: ControllerResources,
  onViewportChanged: (() => void) | undefined,
): ControllerState {
  const clusterClickHandler = createClusterClickHandler(resources.map);
  const lifecycle = createControllerLifecycle(clusterClickHandler, onViewportChanged);
  return { lifecycle, markerRecords: new Map(), resources };
}

function createControllerLifecycle(
  clusterClickHandler: KakaoEventHandler,
  idleHandler: (() => void) | undefined,
): ControllerLifecycle {
  return {
    clusterClickHandler,
    detailOverlay: undefined,
    destroyed: false,
    idleHandler,
    selectedLocationId: undefined,
  };
}

function createController(state: ControllerState): KakaoMapController {
  return {
    destroy: () => destroyController(state),
    fitMarkers: (padding) => fitMarkers(state, padding),
    focusBounds: (bounds, padding) => focusBounds(state, bounds, padding),
    focusMarker: (locationId, padding) => focusMarker(state, locationId, padding),
    readViewport: () => readMapViewport(state),
    readVisibleLocationIds: () => readVisibleLocationIds(state),
    relayout: () => relayoutMap(state),
    replaceMarkers: (markers) => replaceMarkers(state, markers),
    selectMarker: (locationId) => selectMarker(state, locationId),
    zoomIn: () => changeZoom(state, -1),
    zoomOut: () => changeZoom(state, 1),
  };
}

function createControllerLease(
  container: HTMLElement,
  rendering: SharedMapRendering,
  controller: KakaoMapController,
) {
  const state = { active: true, container, controller, rendering };
  return createLeaseController(state);
}

function createLeaseController(state: ControllerLeaseState): KakaoMapController {
  return {
    ...createLeaseMapActions(state),
    destroy: () => releaseControllerLease(state),
    readViewport: () => readLeaseViewport(state),
    readVisibleLocationIds: () => readLeaseVisibleLocationIds(state),
  };
}

function createLeaseMapActions(state: ControllerLeaseState) {
  return {
    fitMarkers: (padding: MapPadding) =>
      runLeaseAction(state, (controller) => controller.fitMarkers(padding)),
    focusBounds: (bounds: MapBounds, padding: MapPadding) =>
      runLeaseAction(state, (controller) => controller.focusBounds(bounds, padding)),
    focusMarker: (locationId: string, padding: MapPadding) =>
      runLeaseAction(state, (controller) => controller.focusMarker(locationId, padding)),
    relayout: () => runLeaseAction(state, (controller) => controller.relayout()),
    replaceMarkers: (markers: readonly MapMarkerConfiguration[]) =>
      runLeaseAction(state, (controller) => controller.replaceMarkers(markers)),
    selectMarker: (locationId: string | undefined) =>
      runLeaseAction(state, (controller) => controller.selectMarker(locationId)),
    zoomIn: () => runLeaseAction(state, (controller) => controller.zoomIn()),
    zoomOut: () => runLeaseAction(state, (controller) => controller.zoomOut()),
  };
}

function runLeaseAction(
  state: ControllerLeaseState,
  action: (controller: KakaoMapController) => void,
) {
  if (!state.active) return;
  action(state.controller);
}

function readLeaseVisibleLocationIds(state: ControllerLeaseState) {
  if (!state.active) return [];
  return state.controller.readVisibleLocationIds();
}

function readLeaseViewport(state: ControllerLeaseState) {
  if (!state.active) return undefined;
  return state.controller.readViewport();
}

function releaseControllerLease(state: ControllerLeaseState) {
  if (!state.active) return;
  state.active = false;
  state.rendering.leaseCount -= 1;
  if (state.rendering.leaseCount > 0) return;
  state.controller.destroy();
  forgetOwnedMapRendering(state.container, state.rendering);
}

function forgetOwnedMapRendering(container: HTMLElement, rendering: SharedMapRendering) {
  if (mapRenderings.get(container) !== rendering) return;
  mapRenderings.delete(container);
}

function replaceMarkers(state: ControllerState, configurations: readonly MapMarkerConfiguration[]) {
  if (state.lifecycle.destroyed) return;
  assertDistinctLocationIds(configurations);
  removeMarkerRecords(state);
  state.resources.clusterer.clear();
  const records = configurations.map((item) => createMarkerRecord(state.resources.maps, item));
  state.markerRecords = new Map(records.map(createMarkerRecordEntry));
  state.resources.clusterer.addMarkers(records.map(readMarker));
  restoreMarkerSelection(state);
}

function createMarkerRecord(
  maps: KakaoMapsApi,
  configuration: MapMarkerConfiguration,
): MarkerRecord {
  const position = new maps.LatLng(configuration.latitude, configuration.longitude);
  const image = createKakaoMarkerImage(maps, configuration, false);
  const marker = new maps.Marker(createMarkerOptions(configuration, position, image));
  const clickHandler = createMarkerClickHandler(configuration);
  registerOptionalEvent(maps.event, marker, "click", clickHandler);
  return { clickHandler, configuration, marker, position };
}

function createMarkerOptions(
  configuration: MapMarkerConfiguration,
  position: KakaoLatLngInstance,
  image: KakaoMarkerImageInstance,
) {
  return { clickable: true, image, position, title: configuration.title };
}

function createMarkerClickHandler(configuration: MapMarkerConfiguration) {
  const onClick = configuration.onClick;
  if (!onClick) return undefined;
  return () => onClick(configuration.locationId);
}

function createMarkerRecordEntry(record: MarkerRecord) {
  return [record.configuration.locationId, record] as const;
}

function readMarker(record: MarkerRecord) {
  return record.marker;
}

function selectMarker(state: ControllerState, locationId: string | undefined) {
  if (state.lifecycle.destroyed) return;
  const previousLocationId = state.lifecycle.selectedLocationId;
  const selectedLocationId = readSelectableLocationId(state, locationId);
  updateSelectedMarker(state, previousLocationId, false);
  state.lifecycle.selectedLocationId = selectedLocationId;
  updateSelectedMarker(state, selectedLocationId, true);
  updateMarkerDetailOverlay(state);
}

function restoreMarkerSelection(state: ControllerState) {
  const selectedLocationId = readSelectableLocationId(state, state.lifecycle.selectedLocationId);
  state.lifecycle.selectedLocationId = selectedLocationId;
  updateSelectedMarker(state, selectedLocationId, true);
  updateMarkerDetailOverlay(state);
}

function readSelectableLocationId(state: ControllerState, locationId: string | undefined) {
  if (!locationId) return undefined;
  if (!state.markerRecords.has(locationId)) return undefined;
  return locationId;
}

function updateSelectedMarker(
  state: ControllerState,
  locationId: string | undefined,
  selected: boolean,
) {
  if (!locationId) return;
  const record = state.markerRecords.get(locationId);
  if (!record) return;
  updateMarkerSelection(state, record, selected);
}

function updateMarkerSelection(state: ControllerState, record: MarkerRecord, selected: boolean) {
  const image = createKakaoMarkerImage(state.resources.maps, record.configuration, selected);
  record.marker.setImage(image);
  record.marker.setZIndex(readMarkerZIndex(selected));
}

function updateMarkerDetailOverlay(state: ControllerState) {
  if (!canShowMarkerDetailOverlay()) return hideMarkerDetailOverlay(state);
  const locationId = state.lifecycle.selectedLocationId;
  if (!locationId) return hideMarkerDetailOverlay(state);
  const record = state.markerRecords.get(locationId);
  if (!record) return hideMarkerDetailOverlay(state);
  if (!record.configuration.detail) return hideMarkerDetailOverlay(state);
  showMarkerDetailOverlay(state, record);
}

function canShowMarkerDetailOverlay() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DETAIL_OVERLAY_MEDIA_QUERY).matches;
}

function showMarkerDetailOverlay(state: ControllerState, record: MarkerRecord) {
  const detail = record.configuration.detail;
  if (!detail) return;
  const content = createMarkerDetailContent(record.configuration.title, detail);
  const overlay = state.lifecycle.detailOverlay;
  if (overlay) return updateExistingDetailOverlay(state, overlay, record, content);
  const options = createDetailOverlayOptions(record.position, content);
  const createdOverlay = new state.resources.maps.CustomOverlay(options);
  state.lifecycle.detailOverlay = createdOverlay;
  createdOverlay.setMap(state.resources.map);
}

function updateExistingDetailOverlay(
  state: ControllerState,
  overlay: KakaoCustomOverlayInstance,
  record: MarkerRecord,
  content: HTMLElement,
) {
  overlay.setContent(content);
  overlay.setPosition(record.position);
  overlay.setMap(state.resources.map);
}

function createDetailOverlayOptions(position: KakaoLatLngInstance, content: HTMLElement) {
  return {
    clickable: true,
    content,
    position,
    xAnchor: 0.5,
    yAnchor: 1,
    zIndex: DETAIL_OVERLAY_Z_INDEX,
  };
}

function hideMarkerDetailOverlay(state: ControllerState) {
  const overlay = state.lifecycle.detailOverlay;
  if (!overlay) return;
  overlay.setMap(null);
}

function createMarkerDetailContent(title: string, detail: MapMarkerDetail) {
  const card = document.createElement("section");
  Object.assign(card.style, DETAIL_CARD_STYLE);
  card.setAttribute("aria-label", `${title} 상세`);
  card.setAttribute("role", "group");
  card.append(createDetailTitle(title));
  card.append(createDetailRows(detail.rows));
  card.append(createDetailAddress(detail.address));
  return card;
}

function createDetailTitle(title: string) {
  const heading = document.createElement("strong");
  heading.style.display = "block";
  heading.style.fontSize = "14px";
  heading.style.marginBottom = "8px";
  heading.textContent = title;
  return heading;
}

function createDetailRows(rows: readonly MapMarkerDetailRow[]) {
  const list = document.createElement("ul");
  list.style.display = "grid";
  list.style.gap = "6px";
  rows.forEach((row) => list.append(createDetailRow(row)));
  return list;
}

function createDetailRow(row: MapMarkerDetailRow) {
  const item = document.createElement("li");
  item.style.fontSize = "12px";
  item.style.lineHeight = "1.45";
  item.textContent = `${row.categoryLabel} · ${row.householdText} · ${row.areaText}`;
  return item;
}

function createDetailAddress(address: string) {
  const paragraph = document.createElement("p");
  paragraph.style.color = "#475569";
  paragraph.style.fontSize = "11px";
  paragraph.style.marginTop = "8px";
  paragraph.textContent = address;
  return paragraph;
}

function createKakaoMarkerImage(
  maps: KakaoMapsApi,
  configuration: MapMarkerConfiguration,
  selected: boolean,
) {
  const count = configuration.clusterCount;
  if (count !== undefined) return createAggregateMarkerImage(maps, count);
  const image = createMapMarkerImage(configuration.categories, selected);
  const size = new maps.Size(image.width, image.height);
  const offset = new maps.Point(image.width / 2, image.height);
  return new maps.MarkerImage(image.source, size, { offset });
}

function createAggregateMarkerImage(maps: KakaoMapsApi, count: number) {
  const dimension = readAggregateMarkerDimension(count);
  const source = createAggregateMarkerSource(count, dimension);
  const size = new maps.Size(dimension, dimension);
  const offset = new maps.Point(dimension / 2, dimension / 2);
  return new maps.MarkerImage(source, size, { offset });
}

function readAggregateMarkerDimension(count: number) {
  if (count >= 1000) return 64;
  if (count >= 100) return 56;
  return 48;
}

function createAggregateMarkerSource(count: number, dimension: number) {
  const label = count.toLocaleString("ko-KR");
  const radius = dimension / 2 - 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}"><circle cx="${dimension / 2}" cy="${dimension / 2}" r="${radius}" fill="${AGGREGATE_MARKER_BACKGROUND}" stroke="${AGGREGATE_MARKER_BORDER}" stroke-width="3"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="800">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function readMarkerZIndex(selected: boolean) {
  if (selected) return SELECTED_MARKER_Z_INDEX;
  return DEFAULT_MARKER_Z_INDEX;
}

function fitMarkers(state: ControllerState, padding: MapPadding) {
  if (state.lifecycle.destroyed) return;
  if (state.markerRecords.size === 0) return;
  const bounds = createMarkerBounds(state.resources.maps, state.markerRecords.values());
  setMapBounds(state.resources.map, bounds, padding);
}

function focusMarker(state: ControllerState, locationId: string, padding: MapPadding) {
  if (state.lifecycle.destroyed) return;
  const record = state.markerRecords.get(locationId);
  if (!record) return;
  focusMapPosition(state.resources.map, record.position, padding);
}

function focusBounds(state: ControllerState, bounds: MapBounds, padding: MapPadding) {
  if (state.lifecycle.destroyed) return;
  const kakaoBounds = createKakaoBounds(state.resources.maps, bounds);
  setMapBounds(state.resources.map, kakaoBounds, padding);
}

function createKakaoBounds(maps: KakaoMapsApi, bounds: MapBounds) {
  const kakaoBounds = new maps.LatLngBounds();
  kakaoBounds.extend(new maps.LatLng(bounds.south, bounds.west));
  kakaoBounds.extend(new maps.LatLng(bounds.north, bounds.east));
  return kakaoBounds;
}

function createMarkerBounds(maps: KakaoMapsApi, records: IterableIterator<MarkerRecord>) {
  const bounds = new maps.LatLngBounds();
  Array.from(records).forEach((record) => bounds.extend(record.position));
  return bounds;
}

function focusMapPosition(
  map: KakaoMapInstance,
  position: KakaoLatLngInstance,
  padding: MapPadding,
) {
  map.setLevel(FOCUSED_MAP_LEVEL);
  map.setCenter(position);
  const horizontalOffset = (padding.right - padding.left) / 2;
  const verticalOffset = (padding.bottom - padding.top) / 2;
  map.panBy(horizontalOffset, verticalOffset);
}

function setMapBounds(
  map: KakaoMapInstance,
  bounds: KakaoLatLngBoundsInstance,
  padding: MapPadding,
) {
  map.setBounds(bounds, padding.top, padding.right, padding.bottom, padding.left);
}

function readVisibleLocationIds(state: ControllerState) {
  if (state.lifecycle.destroyed) return [];
  const bounds = state.resources.map.getBounds();
  return Array.from(state.markerRecords.values())
    .filter((record) => bounds.contain(record.position))
    .map((record) => record.configuration.locationId);
}

function readMapViewport(state: ControllerState): MapViewport | undefined {
  if (state.lifecycle.destroyed) return undefined;
  const bounds = state.resources.map.getBounds();
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  return {
    east: northEast.getLng(),
    height: readViewportHeight(state.resources.container),
    level: state.resources.map.getLevel(),
    north: northEast.getLat(),
    south: southWest.getLat(),
    west: southWest.getLng(),
    width: readViewportWidth(state.resources.container),
  };
}

function readViewportWidth(container: HTMLElement) {
  return Math.max(320, container.clientWidth);
}

function readViewportHeight(container: HTMLElement) {
  return Math.max(480, container.clientHeight);
}

function changeZoom(state: ControllerState, change: number) {
  if (state.lifecycle.destroyed) return;
  const currentLevel = state.resources.map.getLevel();
  const nextLevel = Math.min(KAKAO_MAP_MAX_LEVEL, Math.max(1, currentLevel + change));
  state.resources.map.setLevel(nextLevel);
}

function relayoutMap(state: ControllerState) {
  if (state.lifecycle.destroyed) return;
  state.resources.map.relayout();
}

function registerControllerEvents(state: ControllerState) {
  const { event } = state.resources.maps;
  const { clusterer, map } = state.resources;
  event.addListener(clusterer, "clusterclick", state.lifecycle.clusterClickHandler);
  registerOptionalEvent(event, map, "idle", state.lifecycle.idleHandler);
}

function createClusterClickHandler(map: KakaoMapInstance): KakaoEventHandler {
  return (cluster: unknown) => handleClusterClick(map, cluster);
}

function handleClusterClick(map: KakaoMapInstance, cluster: unknown) {
  if (!isKakaoCluster(cluster)) return;
  setMapBounds(map, cluster.getBounds(), CLUSTER_PADDING);
}

function isKakaoCluster(value: unknown): value is KakaoClusterInstance {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  return typeof Reflect.get(value, "getBounds") === "function";
}

function destroyController(state: ControllerState) {
  if (state.lifecycle.destroyed) return;
  state.lifecycle.destroyed = true;
  removeControllerEvents(state);
  hideMarkerDetailOverlay(state);
  state.lifecycle.detailOverlay = undefined;
  removeMarkerRecords(state);
  state.resources.clusterer.clear();
}

function removeControllerEvents(state: ControllerState) {
  const { event } = state.resources.maps;
  const { clusterer, map } = state.resources;
  event.removeListener(clusterer, "clusterclick", state.lifecycle.clusterClickHandler);
  removeOptionalEvent(event, map, "idle", state.lifecycle.idleHandler);
}

function removeMarkerRecords(state: ControllerState) {
  state.markerRecords.forEach((record) => removeMarkerRecord(state.resources.maps, record));
  state.markerRecords.clear();
}

function removeMarkerRecord(maps: KakaoMapsApi, record: MarkerRecord) {
  removeOptionalEvent(maps.event, record.marker, "click", record.clickHandler);
  record.marker.setMap(null);
}

function registerOptionalEvent(
  eventApi: KakaoEventApi,
  target: KakaoEventTarget,
  type: string,
  handler: KakaoEventHandler | undefined,
) {
  if (!handler) return;
  eventApi.addListener(target, type, handler);
}

function removeOptionalEvent(
  eventApi: KakaoEventApi,
  target: KakaoEventTarget,
  type: string,
  handler: KakaoEventHandler | undefined,
) {
  if (!handler) return;
  eventApi.removeListener(target, type, handler);
}

function assertDistinctLocationIds(configurations: readonly MapMarkerConfiguration[]) {
  const locationIds = configurations.map((item) => item.locationId);
  if (new Set(locationIds).size === locationIds.length) return;
  throw new Error("지도 마커 위치 ID가 중복되었습니다.");
}

function createMapOptions(center: KakaoLatLngInstance, level: number) {
  return { center, draggable: true, level, scrollwheel: true };
}

function createClustererOptions(map: KakaoMapInstance): KakaoMarkerClustererOptions {
  return {
    averageCenter: true,
    calculator: [10, 50],
    disableClickZoom: true,
    gridSize: 60,
    map,
    markers: [],
    minClusterSize: 2,
    minLevel: 7,
    styles: CLUSTER_STYLES,
  };
}

function createClusterStyle(size: number) {
  return {
    ...CLUSTER_STYLE_BASE,
    height: `${size}px`,
    width: `${size}px`,
  };
}

function forgetMapRendering(container: HTMLElement, error: unknown): never {
  mapRenderings.delete(container);
  throw error;
}

function destroyControllerWithError(controller: KakaoMapController, error: unknown): never {
  controller.destroy();
  throw error;
}

function rememberSdkLoading(loading: Promise<KakaoNamespace>) {
  return loading.catch(resetSdkLoading);
}

function resetSdkLoading(error: unknown): never {
  sdkLoading = undefined;
  throw error;
}

function createSdkLoading(javascriptKey: string) {
  const existingScript = findSdkScript();
  if (existingScript) return waitForSdkScript(existingScript);
  const script = createSdkScript(javascriptKey);
  const loading = waitForSdkScript(script);
  document.head.append(script);
  return loading;
}

function createSdkScript(javascriptKey: string) {
  const script = document.createElement("script");
  script.async = true;
  script.dataset.kakaoMapSdk = "true";
  script.src = createKakaoMapSdkSource(javascriptKey);
  return script;
}

function findSdkScript() {
  return document.head.querySelector<HTMLScriptElement>("[data-kakao-map-sdk]");
}

function waitForSdkScript(script: HTMLScriptElement) {
  return new Promise<KakaoNamespace>((resolve, reject) => {
    startSdkScriptWaiting(script, resolve, reject);
  });
}

function startSdkScriptWaiting(
  script: HTMLScriptElement,
  resolve: (kakao: KakaoNamespace) => void,
  reject: (reason: Error) => void,
) {
  const timeout = window.setTimeout(
    () => rejectSdkLoading(script, timeout, reject),
    KAKAO_MAP_SDK_TIMEOUT_MILLISECONDS,
  );
  script.onload = () => completeSdkScript(script, timeout, resolve, reject);
  script.onerror = () => rejectSdkLoading(script, timeout, reject);
}

function completeSdkScript(
  script: HTMLScriptElement,
  timeout: number,
  resolve: (kakao: KakaoNamespace) => void,
  reject: (reason: Error) => void,
) {
  const kakao = readKakaoNamespace();
  if (!kakao) return rejectSdkLoading(script, timeout, reject);
  kakao.maps.load(() => resolveSdkLoading(script, timeout, kakao, resolve));
}

function resolveSdkLoading(
  script: HTMLScriptElement,
  timeout: number,
  kakao: KakaoNamespace,
  resolve: (kakao: KakaoNamespace) => void,
) {
  clearScriptWaiting(script, timeout);
  resolve(kakao);
}

function rejectSdkLoading(
  script: HTMLScriptElement,
  timeout: number,
  reject: (reason: Error) => void,
) {
  clearScriptWaiting(script, timeout);
  script.remove();
  reject(new Error(KAKAO_MAP_SDK_ERROR));
}

function clearScriptWaiting(script: HTMLScriptElement, timeout: number) {
  window.clearTimeout(timeout);
  script.onload = null;
  script.onerror = null;
}

function waitForKakaoMaps(kakao: KakaoNamespace) {
  return new Promise<KakaoNamespace>((resolve, reject) => {
    startKakaoMapsWaiting(kakao, resolve, reject);
  });
}

function startKakaoMapsWaiting(
  kakao: KakaoNamespace,
  resolve: (kakao: KakaoNamespace) => void,
  reject: (reason: Error) => void,
) {
  const timeout = window.setTimeout(
    () => reject(new Error(KAKAO_MAP_SDK_ERROR)),
    KAKAO_MAP_SDK_TIMEOUT_MILLISECONDS,
  );
  kakao.maps.load(() => resolveKakaoMaps(kakao, timeout, resolve));
}

function resolveKakaoMaps(
  kakao: KakaoNamespace,
  timeout: number,
  resolve: (kakao: KakaoNamespace) => void,
) {
  window.clearTimeout(timeout);
  resolve(kakao);
}

function waitForMapTiles(eventApi: KakaoEventApi, map: KakaoMapInstance) {
  return new Promise<void>((resolve, reject) => {
    startMapTilesWaiting(eventApi, map, resolve, reject);
  });
}

function startMapTilesWaiting(
  eventApi: KakaoEventApi,
  map: KakaoMapInstance,
  resolve: () => void,
  reject: (reason: Error) => void,
) {
  const handler = () => resolveMapTiles(eventApi, map, handler, timeout, resolve);
  const timeout = window.setTimeout(
    () => rejectMapTiles(eventApi, map, handler, reject),
    KAKAO_MAP_READY_TIMEOUT_MILLISECONDS,
  );
  eventApi.addListener(map, "tilesloaded", handler);
}

function resolveMapTiles(
  eventApi: KakaoEventApi,
  map: KakaoMapInstance,
  handler: KakaoEventHandler,
  timeout: number,
  resolve: () => void,
) {
  window.clearTimeout(timeout);
  eventApi.removeListener(map, "tilesloaded", handler);
  resolve();
}

function rejectMapTiles(
  eventApi: KakaoEventApi,
  map: KakaoMapInstance,
  handler: KakaoEventHandler,
  reject: (reason: Error) => void,
) {
  eventApi.removeListener(map, "tilesloaded", handler);
  reject(new Error(KAKAO_MAP_READY_ERROR));
}

function readKakaoNamespace() {
  return (window as KakaoWindow).kakao;
}
