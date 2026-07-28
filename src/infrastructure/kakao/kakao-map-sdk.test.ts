import { afterEach, describe, expect, test, vi } from "vitest";

const JAVASCRIPT_KEY = "key with symbols+/=";
const MAP_CONFIGURATION = {
  latitude: 37.420035,
  longitude: 127.127243,
  level: 5,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.head.querySelector("[data-kakao-map-sdk]")?.remove();
  Reflect.deleteProperty(window, "kakao");
});

describe("createKakaoMapSdkSource", () => {
  test("키를 인코딩하고 자동 로드를 끈 SDK 주소를 만든다", async () => {
    const { createKakaoMapSdkSource } = await import("./kakao-map-sdk");
    const source = new URL(createKakaoMapSdkSource(JAVASCRIPT_KEY));

    expect(source.origin).toBe("https://dapi.kakao.com");
    expect(source.searchParams.get("appkey")).toBe(JAVASCRIPT_KEY);
    expect(source.searchParams.get("autoload")).toBe("false");
    expect(source.searchParams.has("libraries")).toBe(false);
  });
});

describe("loadKakaoMapSdk", () => {
  test("동시에 요청해도 SDK 스크립트를 한 번만 추가한다", async () => {
    const { loadKakaoMapSdk } = await importFreshSdkModule();
    const firstLoading = loadKakaoMapSdk(JAVASCRIPT_KEY);
    const secondLoading = loadKakaoMapSdk(JAVASCRIPT_KEY);

    installKakaoApi(createKakaoApi());
    dispatchSdkEvent("load");

    await expect(firstLoading).resolves.toBeDefined();
    await expect(secondLoading).resolves.toBeDefined();
    expect(document.head.querySelectorAll("[data-kakao-map-sdk]")).toHaveLength(1);
  });

  test("이미 존재하는 SDK를 다시 사용한다", async () => {
    const kakaoApi = createKakaoApi();
    installKakaoApi(kakaoApi);
    const { loadKakaoMapSdk } = await importFreshSdkModule();

    await expect(loadKakaoMapSdk(JAVASCRIPT_KEY)).resolves.toBe(kakaoApi);
    expect(document.head.querySelector("[data-kakao-map-sdk]")).toBeNull();
  });

  test("이미 삽입된 SDK 스크립트를 다시 사용한다", async () => {
    appendExistingSdkScript();
    const { loadKakaoMapSdk } = await importFreshSdkModule();
    const loading = loadKakaoMapSdk(JAVASCRIPT_KEY);

    installKakaoApi(createKakaoApi());
    dispatchSdkEvent("load");

    await expect(loading).resolves.toBeDefined();
    expect(document.head.querySelectorAll("[data-kakao-map-sdk]")).toHaveLength(1);
  });

  test("스크립트 로드 실패를 키 없는 오류로 반환한다", async () => {
    const { loadKakaoMapSdk } = await importFreshSdkModule();
    const loading = loadKakaoMapSdk(JAVASCRIPT_KEY);

    dispatchSdkEvent("error");

    await expect(loading).rejects.toThrow("카카오맵 SDK를 불러오지 못했습니다.");
    await expect(loading).rejects.not.toThrow(JAVASCRIPT_KEY);
  });

  test("SDK 로드가 제한 시간을 넘으면 실패한다", async () => {
    vi.useFakeTimers();
    const { loadKakaoMapSdk } = await importFreshSdkModule();
    const loading = loadKakaoMapSdk(JAVASCRIPT_KEY);
    const rejection = expect(loading).rejects.toThrow("카카오맵 SDK를 불러오지 못했습니다.");

    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
  });
});

describe("renderKakaoMap", () => {
  test("고정 좌표로 지도를 만들고 타일 로드 후 완료한다", async () => {
    const fixture = createMapFixture();
    installKakaoApi(fixture.kakaoApi);
    const { renderKakaoMap } = await importFreshSdkModule();
    const container = document.createElement("div");

    const rendering = renderKakaoMap(container, JAVASCRIPT_KEY, MAP_CONFIGURATION);
    await waitForMapListener();
    fixture.dispatchTilesLoaded();

    await expect(rendering).resolves.toBeUndefined();
    expectMapCreation(fixture, container);
    expect(fixture.eventApi.removeListener).toHaveBeenCalledOnce();
  });

  test("같은 컨테이너를 한 번만 초기화한다", async () => {
    const fixture = createMapFixture();
    installKakaoApi(fixture.kakaoApi);
    const { renderKakaoMap } = await importFreshSdkModule();
    const container = document.createElement("div");

    const firstRendering = renderKakaoMap(container, JAVASCRIPT_KEY, MAP_CONFIGURATION);
    const secondRendering = renderKakaoMap(container, JAVASCRIPT_KEY, MAP_CONFIGURATION);
    await waitForMapListener();
    fixture.dispatchTilesLoaded();

    await Promise.all([firstRendering, secondRendering]);
    expect(fixture.mapConstructor).toHaveBeenCalledTimes(1);
  });

  test("타일 로드가 제한 시간을 넘으면 실패하고 다시 초기화할 수 있다", async () => {
    vi.useFakeTimers();
    const fixture = createMapFixture();
    installKakaoApi(fixture.kakaoApi);
    const { renderKakaoMap } = await importFreshSdkModule();
    const container = document.createElement("div");
    const firstRendering = renderKakaoMap(container, JAVASCRIPT_KEY, MAP_CONFIGURATION);

    await expectTileTimeout(firstRendering);
    await completeRetryRendering(fixture, renderKakaoMap, container);

    expect(fixture.mapConstructor).toHaveBeenCalledTimes(2);
    expect(fixture.eventApi.removeListener).toHaveBeenCalled();
  });
});

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

function dispatchSdkEvent(eventName: "load" | "error") {
  const script = document.head.querySelector("[data-kakao-map-sdk]");
  script?.dispatchEvent(new Event(eventName));
}

function appendExistingSdkScript() {
  const script = document.createElement("script");
  script.dataset.kakaoMapSdk = "true";
  document.head.append(script);
}

function createKakaoApi() {
  return {
    maps: {
      Map: class {},
      LatLng: class {},
      event: createEventApi(),
      load: (callback: () => void) => callback(),
    },
  };
}

function createEventApi() {
  return {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
}

function createMapFixture() {
  const listeners = new Map<string, () => void>();
  const mapConstructor = createMapConstructor();
  const eventApi = createFixtureEventApi(listeners);
  const kakaoApi = createFixtureApi(mapConstructor, eventApi);
  const dispatchTilesLoaded = () => listeners.get("tilesloaded")?.();
  return { dispatchTilesLoaded, eventApi, kakaoApi, mapConstructor };
}

function createMapConstructor() {
  return vi.fn(function KakaoMap() {
    return {};
  });
}

function createFixtureApi(
  mapConstructor: ReturnType<typeof createMapConstructor>,
  eventApi: ReturnType<typeof createFixtureEventApi>,
) {
  return {
    maps: {
      Map: mapConstructor,
      LatLng: createLatLngConstructor(),
      event: eventApi,
      load: (callback: () => void) => callback(),
    },
  };
}

function createLatLngConstructor() {
  return vi.fn(function KakaoLatLng(latitude: number, longitude: number) {
    return { latitude, longitude };
  });
}

function createFixtureEventApi(listeners: Map<string, () => void>) {
  return {
    addListener: vi.fn((_target: object, type: string, handler: () => void) => {
      listeners.set(type, handler);
    }),
    removeListener: vi.fn(),
  };
}

async function waitForMapListener() {
  await Promise.resolve();
  await Promise.resolve();
}

async function completeRetryRendering(
  fixture: ReturnType<typeof createMapFixture>,
  renderMap: typeof import("./kakao-map-sdk").renderKakaoMap,
  container: HTMLElement,
) {
  const retryRendering = renderMap(container, JAVASCRIPT_KEY, MAP_CONFIGURATION);
  await waitForMapListener();
  fixture.dispatchTilesLoaded();
  await retryRendering;
}

function expectMapCreation(fixture: ReturnType<typeof createMapFixture>, container: HTMLElement) {
  expect(fixture.mapConstructor).toHaveBeenCalledWith(container, {
    center: { latitude: 37.420035, longitude: 127.127243 },
    draggable: true,
    level: 5,
    scrollwheel: true,
  });
}

async function expectTileTimeout(rendering: Promise<void>) {
  const rejection = expect(rendering).rejects.toThrow("카카오맵 타일을 불러오지 못했습니다.");
  await waitForMapListener();
  await vi.advanceTimersByTimeAsync(10_000);
  await rejection;
}
