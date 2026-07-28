const KAKAO_ADDRESS_ENDPOINT = "https://dapi.kakao.com/v2/local/search/address.json";
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_RETRY_COUNT = 3;

export type RentalCoordinate = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type CoordinateResolutionRequest = Readonly<{
  addressAliases?: readonly string[];
  district: string;
  locationId: string;
  municipality: string;
  roadAddress: string;
}>;

export type RentalCoordinateCacheEntry = Readonly<{
  coordinate: RentalCoordinate;
  district: string;
  municipality: string;
  resolvedAddress: string;
}>;

export type RentalCoordinateCache = Readonly<{
  entries: Readonly<Record<string, RentalCoordinateCacheEntry>>;
  schemaVersion: 1;
}>;

export type CoordinateResolutionFailureKind =
  "address-mismatch" | "http-error" | "malformed-response" | "network-error" | "not-found";

export type CoordinateResolutionFailure = Readonly<{
  address: string;
  kind: CoordinateResolutionFailureKind;
  locationId: string;
  message: string;
  status?: number;
}>;

export type CoordinateResolutionResult = Readonly<{
  cache: RentalCoordinateCache;
  coordinates: Readonly<Record<string, RentalCoordinate>>;
  failures: readonly CoordinateResolutionFailure[];
}>;

export type KakaoGeocodingHttpResponse = Readonly<{
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
}>;

type KakaoGeocodingFetch = (
  input: string | URL,
  request?: RequestInit,
) => Promise<KakaoGeocodingHttpResponse>;

type ResolverConfiguration = Readonly<{
  concurrency?: number;
  fetchFunction: KakaoGeocodingFetch;
  restApiKey: string;
  retryCount?: number;
  wait?: (milliseconds: number) => Promise<void>;
}>;

type ResolutionState = {
  cacheEntries: Record<string, RentalCoordinateCacheEntry>;
  coordinates: Record<string, RentalCoordinate>;
  failures: CoordinateResolutionFailure[];
};

type RequestResolution =
  | Readonly<{
      cacheEntry: RentalCoordinateCacheEntry;
      coordinate: RentalCoordinate;
      request: CoordinateResolutionRequest;
      success: true;
    }>
  | Readonly<{
      failure: CoordinateResolutionFailure;
      request: CoordinateResolutionRequest;
      success: false;
    }>;

type ResponseResult =
  | Readonly<{ response: KakaoGeocodingHttpResponse; success: true }>
  | Readonly<{ failure: CoordinateResolutionFailure; success: false }>;

type UnknownRecord = Record<string, unknown>;

export function createEmptyCoordinateCache(): RentalCoordinateCache {
  return { entries: {}, schemaVersion: 1 };
}

export function parseRentalCoordinateCache(value: unknown): RentalCoordinateCache {
  if (!isUnknownRecord(value) || value.schemaVersion !== 1) throw invalidCacheError();
  if (!isUnknownRecord(value.entries)) throw invalidCacheError();
  return { entries: parseCacheEntries(value.entries), schemaVersion: 1 };
}

export function mergeLegacySnapshotCoordinates(
  requests: readonly CoordinateResolutionRequest[],
  cache: RentalCoordinateCache,
  snapshot: unknown,
): RentalCoordinateCache {
  const locations = readLegacyLocations(snapshot);
  const entries = { ...cache.entries };
  requests.forEach((request) => migrateLegacyCoordinate(request, locations, entries));
  return { entries, schemaVersion: 1 };
}

export function findUncachedCoordinateRequests(
  requests: readonly CoordinateResolutionRequest[],
  cache: RentalCoordinateCache,
) {
  return requests.filter((request) => {
    return !isMatchingCacheEntry(request, cache.entries[request.roadAddress]);
  });
}

export async function resolveKakaoCoordinates(
  requests: readonly CoordinateResolutionRequest[],
  cache: RentalCoordinateCache,
  configuration: ResolverConfiguration,
): Promise<CoordinateResolutionResult> {
  const state = createResolutionState(cache);
  const unresolved = applyCachedCoordinates(requests, cache, state);
  await resolveUncachedCoordinates(unresolved, configuration, state);
  return createResolutionResult(state);
}

function createResolutionState(cache: RentalCoordinateCache): ResolutionState {
  return {
    cacheEntries: { ...cache.entries },
    coordinates: {},
    failures: [],
  };
}

function parseCacheEntries(values: UnknownRecord) {
  const entries: Record<string, RentalCoordinateCacheEntry> = {};
  Object.entries(values).forEach(([address, value]) => {
    entries[address] = parseCacheEntry(value);
  });
  return entries;
}

function parseCacheEntry(value: unknown): RentalCoordinateCacheEntry {
  if (!isUnknownRecord(value) || !isUnknownRecord(value.coordinate)) throw invalidCacheError();
  const coordinate = readStoredCoordinate(value.coordinate);
  if (!coordinate || !hasCacheStrings(value)) throw invalidCacheError();
  return {
    coordinate,
    district: value.district,
    municipality: value.municipality,
    resolvedAddress: value.resolvedAddress,
  };
}

function readStoredCoordinate(value: UnknownRecord): RentalCoordinate | undefined {
  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude };
}

function hasCacheStrings(
  value: UnknownRecord,
): value is UnknownRecord & Record<"district" | "municipality" | "resolvedAddress", string> {
  if (typeof value.district !== "string") return false;
  if (typeof value.municipality !== "string") return false;
  return typeof value.resolvedAddress === "string";
}

function invalidCacheError() {
  return new Error("좌표 캐시 형식이 올바르지 않습니다.");
}

function applyCachedCoordinates(
  requests: readonly CoordinateResolutionRequest[],
  cache: RentalCoordinateCache,
  state: ResolutionState,
) {
  return requests.filter((request) => !applyCachedCoordinate(request, cache, state));
}

function applyCachedCoordinate(
  request: CoordinateResolutionRequest,
  cache: RentalCoordinateCache,
  state: ResolutionState,
) {
  const entry = cache.entries[request.roadAddress];
  if (!isMatchingCacheEntry(request, entry)) return false;
  state.coordinates[request.locationId] = entry.coordinate;
  return true;
}

function isMatchingCacheEntry(
  request: CoordinateResolutionRequest,
  entry: RentalCoordinateCacheEntry | undefined,
): entry is RentalCoordinateCacheEntry {
  if (!entry) return false;
  if (entry.municipality !== request.municipality) return false;
  return entry.district === request.district;
}

function readLegacyLocations(snapshot: unknown): readonly UnknownRecord[] {
  if (!isUnknownRecord(snapshot) || !Array.isArray(snapshot.locations)) return [];
  return snapshot.locations.filter(isUnknownRecord);
}

function migrateLegacyCoordinate(
  request: CoordinateResolutionRequest,
  locations: readonly UnknownRecord[],
  entries: Record<string, RentalCoordinateCacheEntry>,
) {
  if (entries[request.roadAddress]) return;
  const location = locations.find((candidate) => matchesLegacyAddress(request, candidate));
  const coordinate = readLegacyCoordinate(location);
  if (!coordinate) return;
  entries[request.roadAddress] = createLegacyCacheEntry(request, coordinate);
}

function matchesLegacyAddress(request: CoordinateResolutionRequest, location: UnknownRecord) {
  if (typeof location.roadAddress !== "string") return false;
  return readRequestAddresses(request).includes(normalizeAddress(location.roadAddress));
}

function readRequestAddresses(request: CoordinateResolutionRequest) {
  const addresses = [request.roadAddress, ...(request.addressAliases ?? [])];
  return addresses.map(normalizeAddress);
}

function normalizeAddress(address: string) {
  return address.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function readLegacyCoordinate(location: UnknownRecord | undefined) {
  if (!location || !isUnknownRecord(location.coordinate)) return undefined;
  const latitude = readFiniteNumber(location.coordinate.latitude);
  const longitude = readFiniteNumber(location.coordinate.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude };
}

function createLegacyCacheEntry(
  request: CoordinateResolutionRequest,
  coordinate: RentalCoordinate,
): RentalCoordinateCacheEntry {
  return {
    coordinate,
    district: request.district,
    municipality: request.municipality,
    resolvedAddress: request.roadAddress,
  };
}

async function resolveUncachedCoordinates(
  requests: readonly CoordinateResolutionRequest[],
  configuration: ResolverConfiguration,
  state: ResolutionState,
) {
  const batches = createBatches(requests, configuration.concurrency ?? DEFAULT_CONCURRENCY);
  for (const batch of batches) {
    await resolveBatch(batch, configuration, state);
  }
}

function createBatches<T>(values: readonly T[], size: number) {
  if (!Number.isInteger(size) || size < 1) throw new Error("동시 요청 수는 1 이상이어야 합니다.");
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

async function resolveBatch(
  requests: readonly CoordinateResolutionRequest[],
  configuration: ResolverConfiguration,
  state: ResolutionState,
) {
  const resolutions = await Promise.all(
    requests.map((request) => resolveRequest(request, configuration)),
  );
  resolutions.forEach((resolution) => applyResolution(resolution, state));
}

async function resolveRequest(
  request: CoordinateResolutionRequest,
  configuration: ResolverConfiguration,
): Promise<RequestResolution> {
  const retryCount = configuration.retryCount ?? DEFAULT_RETRY_COUNT;
  const response = await requestWithRetries(request, configuration, retryCount);
  if (!response.success) return { ...response, request };
  return parseResponse(request, response.response);
}

async function requestWithRetries(
  request: CoordinateResolutionRequest,
  configuration: ResolverConfiguration,
  retriesRemaining: number,
): Promise<ResponseResult> {
  const result = await requestKakao(request, configuration);
  if (!shouldRetry(result, retriesRemaining)) return result;
  await waitBeforeRetry(configuration, retriesRemaining);
  return requestWithRetries(request, configuration, retriesRemaining - 1);
}

function shouldRetry(result: ResponseResult, retriesRemaining: number) {
  if (result.success || retriesRemaining < 1) return false;
  if (result.failure.status === 429) return true;
  return (result.failure.status ?? 0) >= 500;
}

async function waitBeforeRetry(configuration: ResolverConfiguration, retriesRemaining: number) {
  const wait = configuration.wait ?? defaultWait;
  const retryIndex = DEFAULT_RETRY_COUNT - retriesRemaining;
  await wait(250 * 2 ** Math.max(retryIndex, 0));
}

async function defaultWait(milliseconds: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function requestKakao(
  request: CoordinateResolutionRequest,
  configuration: ResolverConfiguration,
): Promise<ResponseResult> {
  try {
    const response = await configuration.fetchFunction(
      createAddressUrl(request.roadAddress),
      createRequest(configuration.restApiKey),
    );
    if (response.ok) return { response, success: true };
    return createHttpFailure(request, response.status);
  } catch {
    return createNetworkFailure(request);
  }
}

function createAddressUrl(address: string) {
  const url = new URL(KAKAO_ADDRESS_ENDPOINT);
  url.searchParams.set("query", address);
  return url;
}

function createRequest(restApiKey: string): RequestInit {
  return { headers: { Authorization: `KakaoAK ${restApiKey}` } };
}

function createHttpFailure(request: CoordinateResolutionRequest, status: number): ResponseResult {
  return {
    failure: createFailure(request, "http-error", `Kakao HTTP ${status}`, status),
    success: false,
  };
}

function createNetworkFailure(request: CoordinateResolutionRequest): ResponseResult {
  return {
    failure: createFailure(request, "network-error", "Kakao 주소 검색 요청에 실패했습니다."),
    success: false,
  };
}

async function parseResponse(
  request: CoordinateResolutionRequest,
  response: KakaoGeocodingHttpResponse,
): Promise<RequestResolution> {
  const payload = await readPayload(request, response);
  if (!payload.success) return { ...payload, request };
  return parsePayload(request, payload.value);
}

async function readPayload(
  request: CoordinateResolutionRequest,
  response: KakaoGeocodingHttpResponse,
) {
  try {
    return { success: true as const, value: await response.json() };
  } catch {
    return createMalformedPayloadFailure(request);
  }
}

function parsePayload(request: CoordinateResolutionRequest, payload: unknown): RequestResolution {
  const documents = readDocuments(payload);
  if (!documents) return createMalformedResolution(request);
  if (documents.length === 0) return createNotFoundResolution(request);
  const matchingDocument = documents.find((document) => matchesRequest(document, request));
  if (!matchingDocument) return createMismatchResolution(request);
  return createSuccessfulResolution(request, matchingDocument);
}

function readDocuments(payload: unknown): readonly UnknownRecord[] | undefined {
  if (!isUnknownRecord(payload) || !Array.isArray(payload.documents)) return undefined;
  if (!payload.documents.every(isUnknownRecord)) return undefined;
  return payload.documents;
}

function matchesRequest(document: UnknownRecord, request: CoordinateResolutionRequest) {
  const address = readResolvedAddress(document);
  if (!address.includes(request.municipality)) return false;
  return address.includes(request.district);
}

function readResolvedAddress(document: UnknownRecord) {
  const roadAddress = readNestedAddress(document.road_address);
  if (roadAddress.length > 0) return roadAddress;
  return readNestedAddress(document.address);
}

function readNestedAddress(value: unknown) {
  if (!isUnknownRecord(value)) return "";
  if (typeof value.address_name !== "string") return "";
  return value.address_name.normalize("NFC");
}

function createSuccessfulResolution(
  request: CoordinateResolutionRequest,
  document: UnknownRecord,
): RequestResolution {
  const coordinate = readCoordinate(document);
  if (!coordinate) return createMalformedResolution(request);
  const cacheEntry = createCacheEntry(request, document, coordinate);
  return { cacheEntry, coordinate, request, success: true };
}

function readCoordinate(document: UnknownRecord): RentalCoordinate | undefined {
  const latitude = readFiniteNumber(document.y);
  const longitude = readFiniteNumber(document.x);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude };
}

function readFiniteNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return number;
}

function createCacheEntry(
  request: CoordinateResolutionRequest,
  document: UnknownRecord,
  coordinate: RentalCoordinate,
): RentalCoordinateCacheEntry {
  return {
    coordinate,
    district: request.district,
    municipality: request.municipality,
    resolvedAddress: readResolvedAddress(document),
  };
}

function createMalformedPayloadFailure(request: CoordinateResolutionRequest) {
  return {
    failure: createFailure(
      request,
      "malformed-response" as const,
      "Kakao 주소 검색 응답을 해석할 수 없습니다.",
    ),
    success: false as const,
  };
}

function createMalformedResolution(request: CoordinateResolutionRequest): RequestResolution {
  return {
    failure: createFailure(request, "malformed-response", "Kakao 응답 형식이 올바르지 않습니다."),
    request,
    success: false,
  };
}

function createNotFoundResolution(request: CoordinateResolutionRequest): RequestResolution {
  return {
    failure: createFailure(request, "not-found", "주소 검색 결과가 없습니다."),
    request,
    success: false,
  };
}

function createMismatchResolution(request: CoordinateResolutionRequest): RequestResolution {
  return {
    failure: createFailure(request, "address-mismatch", "응답 주소의 시·구가 일치하지 않습니다."),
    request,
    success: false,
  };
}

function createFailure(
  request: CoordinateResolutionRequest,
  kind: CoordinateResolutionFailureKind,
  message: string,
  status?: number,
): CoordinateResolutionFailure {
  return { address: request.roadAddress, kind, locationId: request.locationId, message, status };
}

function applyResolution(resolution: RequestResolution, state: ResolutionState) {
  if (!resolution.success) {
    state.failures.push(resolution.failure);
    return;
  }
  state.coordinates[resolution.request.locationId] = resolution.coordinate;
  state.cacheEntries[resolution.request.roadAddress] = resolution.cacheEntry;
}

function createResolutionResult(state: ResolutionState): CoordinateResolutionResult {
  return {
    cache: { entries: state.cacheEntries, schemaVersion: 1 },
    coordinates: state.coordinates,
    failures: state.failures,
  };
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
