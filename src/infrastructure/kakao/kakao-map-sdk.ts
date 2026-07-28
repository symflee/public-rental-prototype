const KAKAO_MAP_SDK_SOURCE = "https://dapi.kakao.com/v2/maps/sdk.js";
const KAKAO_MAP_SDK_TIMEOUT_MILLISECONDS = 10_000;
const KAKAO_MAP_READY_TIMEOUT_MILLISECONDS = 10_000;
const KAKAO_MAP_SDK_ERROR = "카카오맵 SDK를 불러오지 못했습니다.";
const KAKAO_MAP_READY_ERROR = "카카오맵 타일을 불러오지 못했습니다.";

export type KakaoMapConfiguration = Readonly<{
  latitude: number;
  longitude: number;
  level: number;
}>;

type KakaoMapInstance = object;
type KakaoLatLngInstance = object;
type KakaoEventHandler = () => void;
type KakaoMapConstructor = new (
  container: HTMLElement,
  options: KakaoMapConstructorOptions,
) => KakaoMapInstance;
type KakaoLatLngConstructor = new (latitude: number, longitude: number) => KakaoLatLngInstance;

type KakaoMapConstructorOptions = Readonly<{
  center: KakaoLatLngInstance;
  draggable: boolean;
  level: number;
  scrollwheel: boolean;
}>;

type KakaoEventApi = Readonly<{
  addListener: (target: KakaoMapInstance, type: string, handler: KakaoEventHandler) => void;
  removeListener: (target: KakaoMapInstance, type: string, handler: KakaoEventHandler) => void;
}>;

type KakaoMapsApi = Readonly<{
  event: KakaoEventApi;
  LatLng: KakaoLatLngConstructor;
  load: (callback: KakaoEventHandler) => void;
  Map: KakaoMapConstructor;
}>;

type KakaoNamespace = Readonly<{
  maps: KakaoMapsApi;
}>;

type KakaoWindow = Window &
  typeof globalThis & {
    kakao?: KakaoNamespace;
  };

let sdkLoading: Promise<KakaoNamespace> | undefined;
const mapRenderings = new WeakMap<HTMLElement, Promise<void>>();

export function createKakaoMapSdkSource(javascriptKey: string) {
  const source = new URL(KAKAO_MAP_SDK_SOURCE);
  source.searchParams.set("appkey", javascriptKey);
  source.searchParams.set("autoload", "false");
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
) {
  const existingRendering = mapRenderings.get(container);
  if (existingRendering) return existingRendering;

  const rendering = createMapRendering(container, javascriptKey, configuration);
  mapRenderings.set(container, rendering);
  return rendering;
}

function createMapRendering(
  container: HTMLElement,
  javascriptKey: string,
  configuration: KakaoMapConfiguration,
) {
  const rendering = loadKakaoMapSdk(javascriptKey).then((kakao) =>
    createReadyMap(kakao, container, configuration),
  );
  return rendering.catch((error: unknown) => forgetMapRendering(container, error));
}

function createReadyMap(
  kakao: KakaoNamespace,
  container: HTMLElement,
  configuration: KakaoMapConfiguration,
) {
  const center = new kakao.maps.LatLng(configuration.latitude, configuration.longitude);
  const map = new kakao.maps.Map(container, createMapOptions(center, configuration.level));
  return waitForMapTiles(kakao.maps.event, map);
}

function createMapOptions(center: KakaoLatLngInstance, level: number) {
  return {
    center,
    draggable: true,
    level,
    scrollwheel: true,
  };
}

function forgetMapRendering(container: HTMLElement, error: unknown): never {
  mapRenderings.delete(container);
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
  const onTilesLoaded = () => resolveMapTiles(eventApi, map, onTilesLoaded, timeout, resolve);
  const timeout = window.setTimeout(
    () => rejectMapTiles(eventApi, map, onTilesLoaded, reject),
    KAKAO_MAP_READY_TIMEOUT_MILLISECONDS,
  );
  eventApi.addListener(map, "tilesloaded", onTilesLoaded);
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
