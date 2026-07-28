import { afterEach, expect, test, vi } from "vitest";

import type { KakaoMapController, MapMarkerConfiguration, MapPadding } from "./kakao-map-sdk";

const JAVASCRIPT_KEY = "key with symbols+/=";
const MAP_CONFIGURATION = {
  latitude: 37.420035,
  level: 8,
  longitude: 127.127243,
};
const PADDING: MapPadding = { bottom: 40, left: 50, right: 30, top: 20 };
const MARKERS: readonly MapMarkerConfiguration[] = [
  {
    categories: ["NATIONAL_RENTAL"],
    detail: {
      address: "경기도 성남시 수정구 안전로 1",
      rows: [
        {
          areaText: "36.00–46.00㎡",
          categoryLabel: "국민임대",
          householdText: "100세대",
        },
      ],
    },
    latitude: 37.4,
    locationId: "seongnam-1",
    longitude: 127.1,
    title: "성남 국민임대",
  },
  {
    categories: ["HAPPY_HOUSING", "PERMANENT_RENTAL"],
    latitude: 37.3,
    locationId: "yongin-1",
    longitude: 127.3,
    title: "용인 복합 임대",
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelector("[data-kakao-map-sdk]")?.remove();
  Reflect.deleteProperty(window, "kakao");
});

test("클러스터러를 포함하고 자동 로드를 끈 SDK 주소를 만든다", async () => {
  const { createKakaoMapSdkSource } = await importFreshSdkModule();
  const source = new URL(createKakaoMapSdkSource(JAVASCRIPT_KEY));

  expect(source.searchParams.get("appkey")).toBe(JAVASCRIPT_KEY);
  expect(source.searchParams.get("autoload")).toBe("false");
  expect(source.searchParams.get("libraries")).toBe("clusterer");
});

test("동시 요청에는 SDK 스크립트를 한 번만 추가한다", async () => {
  const { loadKakaoMapSdk } = await importFreshSdkModule();
  const firstLoading = loadKakaoMapSdk(JAVASCRIPT_KEY);
  const secondLoading = loadKakaoMapSdk(JAVASCRIPT_KEY);
  installKakaoApi(createLoadingKakaoApi());

  dispatchSdkEvent("load");

  await Promise.all([firstLoading, secondLoading]);
  expect(document.head.querySelectorAll("[data-kakao-map-sdk]")).toHaveLength(1);
});

test("SDK 오류는 키를 노출하지 않는 메시지로 실패한다", async () => {
  const { loadKakaoMapSdk } = await importFreshSdkModule();
  const loading = loadKakaoMapSdk(JAVASCRIPT_KEY);

  dispatchSdkEvent("error");

  await expect(loading).rejects.toThrow("카카오맵 SDK를 불러오지 못했습니다.");
  await expect(loading).rejects.not.toThrow(JAVASCRIPT_KEY);
});

test("마커 이미지와 클러스터 설정을 적용해 컨트롤러를 만든다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  expect(controller).toBeDefined();
  expectClusterConfiguration(fixture);
  expectMarkerConfiguration(fixture);
});

test("같은 컨테이너의 각 lease는 마지막 해제 전까지 지도를 공유한다", async () => {
  const fixture = createMapFixture();
  const [firstController, secondController] = await renderSharedControllers(fixture);
  firstController.destroy();
  secondController.zoomIn();
  expectActiveSharedController(fixture, firstController, secondController);
  secondController.destroy();
  expect(fixture.markerInstances[0]?.setMap).toHaveBeenCalledWith(null);
});

test("마커 교체 시 기존 이벤트와 클러스터 마커를 정리한다", async () => {
  const fixture = createMapFixture();
  const onClick = vi.fn();
  const initialMarkers = [{ ...MARKERS[0]!, onClick: vi.fn() }, MARKERS[1]!];
  const controller = await renderFixtureMap(fixture, initialMarkers);
  const replacement = { ...MARKERS[0]!, onClick };

  controller.replaceMarkers([replacement]);
  fixture.dispatchLatestMarkerClick();

  expectMarkerReplacement(fixture, onClick);
});

test("선택한 핀만 확대 이미지와 높은 순서로 갱신한다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  controller.selectMarker("yongin-1");

  expect(fixture.markerInstances[0]?.setZIndex).not.toHaveBeenCalled();
  expect(fixture.markerInstances[1]?.setZIndex).toHaveBeenLastCalledWith(20);
  expect(readLatestMarkerImage(fixture.markerInstances[1])).toContain("selected-marker");
});

test("마커를 교체해도 남아 있는 위치의 선택 상태를 유지한다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  controller.selectMarker("seongnam-1");
  controller.replaceMarkers(MARKERS);

  expect(fixture.markerInstances[2]?.setZIndex).toHaveBeenLastCalledWith(20);
  expect(readLatestMarkerImage(fixture.markerInstances[2])).toContain("selected-marker");
});

test("선택 상세는 안전한 DOM으로 한 개만 표시하고 상세가 없으면 숨긴다", async () => {
  const fixture = createMapFixture();
  const unsafeMarker = createUnsafeDetailMarker();
  installDesktopMediaQuery(true);
  const controller = await renderFixtureMap(fixture, [unsafeMarker, MARKERS[1]!]);

  controller.selectMarker("seongnam-1");

  expectSafeDetailOverlay(fixture);
  controller.selectMarker("yongin-1");
  expect(fixture.customOverlayInstance.setMap).toHaveBeenLastCalledWith(null);
  expect(fixture.customOverlayConstructor).toHaveBeenCalledOnce();
});

test("모바일에서는 상세 모델이 있어도 지도 CustomOverlay를 표시하지 않는다", async () => {
  const fixture = createMapFixture();
  installDesktopMediaQuery(false);
  const controller = await renderFixtureMap(fixture, MARKERS);

  controller.selectMarker("seongnam-1");

  expect(fixture.customOverlayConstructor).not.toHaveBeenCalled();
  expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
});

test("matchMedia 미지원 환경에서는 지도 CustomOverlay를 표시하지 않는다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  controller.selectMarker("seongnam-1");

  expect(fixture.customOverlayConstructor).not.toHaveBeenCalled();
});

test("전체 마커를 패딩이 적용된 bounds에 맞춘다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  controller.fitMarkers(PADDING);

  expect(fixture.mapInstance.setBounds).toHaveBeenLastCalledWith(
    expect.objectContaining({ pointCount: 2 }),
    20,
    30,
    40,
    50,
  );
});

test("위치 포커스는 패딩과 레벨 4를 적용하고 좌표로 이동한다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  controller.focusMarker("seongnam-1", PADDING);

  expectFocusedMap(fixture);
});

test("현재 지도 영역에 포함된 위치 ID만 반환한다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);
  fixture.visibleLongitudeMaximum = 127.2;

  expect(controller.readVisibleLocationIds()).toEqual(["seongnam-1"]);
});

test("줌·재배치와 idle 알림을 지도 API에 위임한다", async () => {
  const fixture = createMapFixture();
  const onViewportChanged = vi.fn();
  const configuration = { ...MAP_CONFIGURATION, onViewportChanged };
  const controller = await renderFixtureMap(fixture, MARKERS, configuration);

  invokeViewportActions(controller, fixture);

  expectViewportActions(fixture, onViewportChanged);
});

test("축소 컨트롤은 카카오 ROADMAP 최대 레벨 14를 넘지 않는다", async () => {
  const fixture = createMapFixture();
  const controller = await renderFixtureMap(fixture, MARKERS);

  Array.from({ length: 7 }).forEach(() => controller.zoomOut());

  expect(fixture.mapInstance.setLevel).toHaveBeenLastCalledWith(14);
});

test("타일 준비 리스너를 많은 마커를 만들기 전에 등록한다", async () => {
  const fixture = createMapFixture();

  await renderFixtureMap(fixture, MARKERS);

  const tileListenerOrder = readEventListenerOrder(fixture, "tilesloaded");
  const markerCreationOrder = fixture.markerConstructor.mock.invocationCallOrder[0];
  expect(tileListenerOrder).toBeLessThan(markerCreationOrder!);
});

test("클러스터 클릭은 해당 bounds에 패딩을 주어 확대한다", async () => {
  const fixture = createMapFixture();
  await renderFixtureMap(fixture, MARKERS);
  const clusterBounds = { cluster: true };

  fixture.dispatchClusterClick({ getBounds: () => clusterBounds });

  expect(fixture.mapInstance.setBounds).toHaveBeenLastCalledWith(clusterBounds, 48, 48, 48, 48);
});

test("destroy는 모든 이벤트와 오버레이를 정리하고 재초기화를 허용한다", async () => {
  const fixture = createMapFixture();
  const configuration = { ...MAP_CONFIGURATION, onViewportChanged: vi.fn() };
  installDesktopMediaQuery(true);
  const controller = await renderFixtureMap(fixture, MARKERS, configuration);

  controller.selectMarker("seongnam-1");
  controller.destroy();
  await renderAgain(fixture);

  expect(fixture.customOverlayInstance.setMap).toHaveBeenCalledWith(null);
  expect(fixture.markerInstances[0]?.setMap).toHaveBeenCalledWith(null);
  expectRemovedMapListeners(fixture);
  expect(fixture.mapConstructor).toHaveBeenCalledTimes(2);
});

function expectClusterConfiguration(fixture: MapFixture) {
  expect(fixture.clustererConstructor).toHaveBeenCalledWith(
    expect.objectContaining(createExpectedClusterConfiguration()),
  );
}

function createExpectedClusterConfiguration() {
  return {
    averageCenter: true,
    calculator: [10, 50],
    disableClickZoom: true,
    gridSize: 60,
    minClusterSize: 2,
    minLevel: 6,
    styles: createExpectedClusterStyles(),
  };
}

function createExpectedClusterStyles() {
  const base = { background: "#172554", border: "3px solid #ffffff" };
  return [
    expect.objectContaining({
      ...base,
      boxShadow: "0 3px 10px rgba(15, 23, 42, 0.35)",
      color: "#ffffff",
      height: "40px",
      width: "40px",
    }),
    expect.objectContaining({ height: "48px", width: "48px" }),
    expect.objectContaining({ height: "56px", width: "56px" }),
  ];
}

function expectMarkerConfiguration(fixture: MapFixture) {
  expect(fixture.markerConstructor).toHaveBeenCalledTimes(2);
  expect(fixture.markerConstructor.mock.calls[0]?.[0]).toMatchObject({
    clickable: true,
    title: "성남 국민임대",
  });
  expect(fixture.clustererInstance.addMarkers).toHaveBeenCalledWith(
    fixture.markerInstances.slice(0, 2),
  );
}

function expectMarkerReplacement(fixture: MapFixture, onClick: ReturnType<typeof vi.fn>) {
  expect(onClick).toHaveBeenCalledWith("seongnam-1");
  expect(fixture.clustererInstance.clear).toHaveBeenCalledTimes(2);
  expect(fixture.clustererInstance.addMarkers).toHaveBeenLastCalledWith([
    fixture.markerInstances[2],
  ]);
  expectRemovedMarkerListener(fixture, fixture.markerInstances[0]);
}

function expectFocusedMap(fixture: MapFixture) {
  expect(fixture.mapInstance.setLevel).toHaveBeenLastCalledWith(4);
  expect(fixture.mapInstance.setCenter).toHaveBeenLastCalledWith(
    expect.objectContaining({ longitude: 127.1 }),
  );
  expect(fixture.mapInstance.panBy).toHaveBeenLastCalledWith(-10, 10);
  expect(fixture.mapInstance.panTo).not.toHaveBeenCalled();
}

function createUnsafeDetailMarker(): MapMarkerConfiguration {
  return {
    ...MARKERS[0]!,
    detail: {
      address: "<img src=x onerror=alert(1)>",
      rows: [
        {
          areaText: "<b>36㎡</b>",
          categoryLabel: "국민임대",
          householdText: "100세대",
        },
      ],
    },
  };
}

async function renderSharedControllers(fixture: MapFixture) {
  installKakaoApi(fixture.kakaoApi);
  const { renderKakaoMap } = await importFreshSdkModule();
  const first = renderKakaoMap(fixture.container, JAVASCRIPT_KEY, MAP_CONFIGURATION, MARKERS);
  const second = renderKakaoMap(fixture.container, JAVASCRIPT_KEY, MAP_CONFIGURATION, MARKERS);
  await finishMapRendering(fixture);
  return Promise.all([first, second]);
}

function expectActiveSharedController(
  fixture: MapFixture,
  firstController: KakaoMapController,
  secondController: KakaoMapController,
) {
  expect(secondController).not.toBe(firstController);
  expect(fixture.mapConstructor).toHaveBeenCalledOnce();
  expect(fixture.mapInstance.setLevel).toHaveBeenLastCalledWith(7);
  expect(fixture.markerInstances[0]?.setMap).not.toHaveBeenCalled();
}

function expectSafeDetailOverlay(fixture: MapFixture) {
  const options = fixture.customOverlayConstructor.mock.calls[0]?.[0];
  const content = Reflect.get(options!, "content") as HTMLElement;
  expect(fixture.customOverlayConstructor).toHaveBeenCalledOnce();
  expect(content.style.maxWidth).toBe("260px");
  expect(content.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(content.textContent).toContain("<b>36㎡</b>");
  expect(content.querySelector("img")).toBeNull();
  expect(fixture.customOverlayInstance.setMap).toHaveBeenLastCalledWith(fixture.mapInstance);
}

function readEventListenerOrder(fixture: MapFixture, eventType: string) {
  const index = fixture.eventApi.addListener.mock.calls.findIndex((call) => call[1] === eventType);
  return fixture.eventApi.addListener.mock.invocationCallOrder[index]!;
}

function invokeViewportActions(controller: KakaoMapController, fixture: MapFixture) {
  controller.zoomIn();
  controller.zoomOut();
  controller.relayout();
  fixture.dispatchMapIdle();
}

function expectViewportActions(fixture: MapFixture, onViewportChanged: ReturnType<typeof vi.fn>) {
  expect(fixture.mapInstance.setLevel).toHaveBeenNthCalledWith(1, 7);
  expect(fixture.mapInstance.setLevel).toHaveBeenNthCalledWith(2, 8);
  expect(fixture.mapInstance.relayout).toHaveBeenCalledOnce();
  expect(onViewportChanged).toHaveBeenCalledOnce();
}

function expectRemovedMarkerListener(fixture: MapFixture, marker: FakeMarker | undefined) {
  expect(fixture.eventApi.removeListener).toHaveBeenCalledWith(
    marker,
    "click",
    expect.any(Function),
  );
}

function expectRemovedMapListeners(fixture: MapFixture) {
  expect(fixture.eventApi.removeListener).toHaveBeenCalledWith(
    fixture.mapInstance,
    "idle",
    expect.any(Function),
  );
  expect(fixture.eventApi.removeListener).toHaveBeenCalledWith(
    fixture.clustererInstance,
    "clusterclick",
    expect.any(Function),
  );
}

function readLatestMarkerImage(marker: FakeMarker | undefined) {
  const image = marker?.setImage.mock.calls.at(-1)?.[0];
  return decodeURIComponent(image?.source ?? "");
}

async function renderFixtureMap(
  fixture: MapFixture,
  markers: readonly MapMarkerConfiguration[],
  configuration = MAP_CONFIGURATION,
) {
  installKakaoApi(fixture.kakaoApi);
  const { renderKakaoMap } = await importFreshSdkModule();
  const rendering = renderKakaoMap(fixture.container, JAVASCRIPT_KEY, configuration, markers);
  await finishMapRendering(fixture);
  return rendering;
}

async function finishMapRendering(fixture: MapFixture) {
  await waitForMapListener();
  fixture.dispatchMapTilesLoaded();
  await waitForMapListener();
}

async function renderAgain(fixture: MapFixture) {
  const { renderKakaoMap } = await import("./kakao-map-sdk");
  const rendering = renderKakaoMap(fixture.container, JAVASCRIPT_KEY, MAP_CONFIGURATION, []);
  await finishMapRendering(fixture);
  await rendering;
}

async function importFreshSdkModule() {
  vi.resetModules();
  return import("./kakao-map-sdk");
}

function installKakaoApi(kakaoApi: object) {
  Object.defineProperty(window, "kakao", {
    configurable: true,
    value: kakaoApi,
  });
}

function installDesktopMediaQuery(matches: boolean) {
  const matchMedia = vi.fn((media: string) => ({ matches, media }));
  vi.stubGlobal("matchMedia", matchMedia);
}

function dispatchSdkEvent(eventName: "load" | "error") {
  const script = document.head.querySelector("[data-kakao-map-sdk]");
  script?.dispatchEvent(new Event(eventName));
}

function createLoadingKakaoApi() {
  return createMapFixture().kakaoApi;
}

type EventHandler = (...arguments_: readonly unknown[]) => void;
type Listener = Readonly<{ handler: EventHandler; target: object; type: string }>;

type FakeMarker = ReturnType<typeof createFakeMarker>;
type MapFixture = ReturnType<typeof createMapFixture>;
type FixtureDependencies = Readonly<{
  clustererInstance: ReturnType<typeof createFakeClusterer>;
  constructors: ReturnType<typeof createConstructors>;
  customOverlayInstance: ReturnType<typeof createFakeCustomOverlay>;
  eventApi: ReturnType<typeof createEventApi>;
  mapInstance: ReturnType<typeof createFakeMap>;
}>;
type FixtureInstances = Readonly<{
  clustererInstance: ReturnType<typeof createFakeClusterer>;
  customOverlayInstance: ReturnType<typeof createFakeCustomOverlay>;
  mapInstance: ReturnType<typeof createFakeMap>;
  markerInstances: FakeMarker[];
}>;

function createMapFixture() {
  const listeners: Listener[] = [];
  const dependencies = createFixtureDependencies(listeners);
  const fixture = createFixtureObject(dependencies);
  return attachFixtureActions(fixture, listeners);
}

function createFixtureDependencies(listeners: Listener[]): FixtureDependencies {
  const eventApi = createEventApi(listeners);
  const markerInstances: FakeMarker[] = [];
  const mapInstance = createFakeMap();
  const clustererInstance = createFakeClusterer();
  const customOverlayInstance = createFakeCustomOverlay();
  const instances = { clustererInstance, customOverlayInstance, mapInstance, markerInstances };
  const constructors = createConstructors(instances);
  return { clustererInstance, constructors, customOverlayInstance, eventApi, mapInstance };
}

function createFixtureObject(dependencies: FixtureDependencies) {
  const { clustererInstance, constructors, customOverlayInstance, eventApi, mapInstance } =
    dependencies;
  const kakaoApi = createKakaoApi(eventApi, constructors);
  return {
    ...constructors,
    clustererInstance,
    container: document.createElement("div"),
    customOverlayInstance,
    eventApi,
    kakaoApi,
    mapInstance,
  };
}

function attachFixtureActions(
  fixture: ReturnType<typeof createFixtureObject>,
  listeners: Listener[],
) {
  const dispatch = createEventDispatcher(listeners);
  return {
    ...fixture,
    dispatchClusterClick: (cluster: object) =>
      dispatch(fixture.clustererInstance, "clusterclick", cluster),
    dispatchLatestMarkerClick: () => dispatch(fixture.markerInstances.at(-1)!, "click"),
    dispatchMapIdle: () => dispatch(fixture.mapInstance, "idle"),
    dispatchMapTilesLoaded: () => dispatch(fixture.mapInstance, "tilesloaded"),
    visibleLongitudeMaximum: 180,
  };
}

function createEventDispatcher(listeners: Listener[]) {
  return (target: object, type: string, ...arguments_: readonly unknown[]) => {
    listeners
      .filter(matchesEvent(target, type))
      .forEach((listener) => listener.handler(...arguments_));
  };
}

function matchesEvent(target: object, type: string) {
  return (listener: Listener) => listener.target === target && listener.type === type;
}

function createEventApi(listeners: Listener[]) {
  return {
    addListener: vi.fn((target: object, type: string, handler: EventHandler) => {
      listeners.push({ handler, target, type });
    }),
    removeListener: vi.fn((target: object, type: string, handler: EventHandler) => {
      const index = listeners.findIndex(matchesListener(target, type, handler));
      if (index >= 0) listeners.splice(index, 1);
    }),
  };
}

function matchesListener(target: object, type: string, handler: EventHandler) {
  return (listener: Listener) =>
    listener.target === target && listener.type === type && listener.handler === handler;
}

function createConstructors(instances: FixtureInstances) {
  const { clustererInstance, customOverlayInstance, mapInstance, markerInstances } = instances;
  return {
    clustererConstructor: createOptionsConstructor(clustererInstance),
    customOverlayConstructor: createOptionsConstructor(customOverlayInstance),
    mapConstructor: createMapConstructor(mapInstance),
    markerConstructor: createMarkerConstructor(markerInstances),
    markerInstances,
  };
}

function createOptionsConstructor<Instance>(instance: Instance) {
  return vi.fn(function Value(options: object) {
    void options;
    return instance;
  });
}

function createMapConstructor(mapInstance: ReturnType<typeof createFakeMap>) {
  return vi.fn(function Map() {
    return mapInstance;
  });
}

function createMarkerConstructor(markerInstances: FakeMarker[]) {
  return vi.fn(function Marker(options: object) {
    const marker = createFakeMarker(options);
    markerInstances.push(marker);
    return marker;
  });
}

function createKakaoApi(
  eventApi: ReturnType<typeof createEventApi>,
  constructors: ReturnType<typeof createConstructors>,
) {
  return { maps: createMapsApi(eventApi, constructors) };
}

function createMapsApi(
  eventApi: ReturnType<typeof createEventApi>,
  constructors: ReturnType<typeof createConstructors>,
) {
  const values = createMapsValueConstructors();
  return {
    ...values,
    CustomOverlay: constructors.customOverlayConstructor,
    event: eventApi,
    load: (callback: () => void) => callback(),
    Map: constructors.mapConstructor,
    MarkerClusterer: constructors.clustererConstructor,
    Marker: constructors.markerConstructor,
  };
}

function createMapsValueConstructors() {
  return {
    LatLng: createLatLngConstructor(),
    LatLngBounds: createBoundsConstructor(),
    MarkerImage: createValueConstructor("source"),
    Point: createPointConstructor(),
    Size: createSizeConstructor(),
  };
}

function createLatLngConstructor() {
  return vi.fn(function LatLng(latitude: number, longitude: number) {
    return { getLat: () => latitude, getLng: () => longitude, latitude, longitude };
  });
}

function createBoundsConstructor() {
  return vi.fn(function LatLngBounds() {
    const points: object[] = [];
    return {
      contain: (position: { longitude: number }) => position.longitude <= 127.2,
      extend: (position: object) => points.push(position),
      get pointCount() {
        return points.length;
      },
    };
  });
}

function createValueConstructor(valueName: string) {
  return vi.fn(function Value(source: string, size: object, options: object) {
    return { options, size, [valueName]: source };
  });
}

function createPointConstructor() {
  return vi.fn(function Point(x: number, y: number) {
    return { x, y };
  });
}

function createSizeConstructor() {
  return vi.fn(function Size(width: number, height: number) {
    return { height, width };
  });
}

function createFakeMap() {
  const levelControls = createFakeMapLevelControls();
  return {
    getBounds: vi.fn(() => ({
      contain: (position: { longitude: number }) => position.longitude <= 127.2,
    })),
    ...levelControls,
    panBy: vi.fn(),
    panTo: vi.fn(),
    relayout: vi.fn(),
    setCenter: vi.fn(),
    setBounds: vi.fn(),
  };
}

function createFakeMapLevelControls() {
  const levelState = { value: 8 };
  return {
    getLevel: vi.fn(() => levelState.value),
    setLevel: vi.fn((nextLevel: number) => {
      levelState.value = nextLevel;
    }),
  };
}

function createFakeClusterer() {
  return {
    addMarkers: vi.fn(),
    clear: vi.fn(),
  };
}

function createFakeCustomOverlay() {
  return {
    setContent: vi.fn(),
    setMap: vi.fn(),
    setPosition: vi.fn(),
  };
}

function createFakeMarker(options: object) {
  return {
    getPosition: vi.fn(() => Reflect.get(options, "position")),
    options,
    setImage: vi.fn(),
    setMap: vi.fn(),
    setZIndex: vi.fn(),
  };
}

async function waitForMapListener() {
  await Promise.resolve();
  await Promise.resolve();
}
