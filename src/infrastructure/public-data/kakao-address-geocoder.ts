import type { PublicDataFetch, PublicDataHttpResponse } from "./public-data-http";

export type { PublicDataHttpResponse } from "./public-data-http";

const KAKAO_ADDRESS_ENDPOINT = "https://dapi.kakao.com/v2/local/search/address.json";

export type Wgs84Coordinate = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type KakaoAddressGeocodeFailureKind =
  "http-error" | "invalid-address" | "malformed-response" | "network-error" | "not-found";

export type KakaoAddressGeocodeFailure = Readonly<{
  kind: KakaoAddressGeocodeFailureKind;
  message: string;
  status?: number;
}>;

export type KakaoAddressGeocodeResult =
  | Readonly<{ coordinate: Wgs84Coordinate; success: true }>
  | Readonly<{ failure: KakaoAddressGeocodeFailure; success: false }>;

export type KakaoAddressGeocoderConfiguration = Readonly<{
  fetchFunction: PublicDataFetch;
  restApiKey: string;
}>;

type UnknownRecord = Record<string, unknown>;

type TransportResult<T> =
  | Readonly<{ success: true; value: T }>
  | Readonly<{ failure: KakaoAddressGeocodeFailure; success: false }>;

export async function geocodeKakaoAddress(
  address: string,
  configuration: KakaoAddressGeocoderConfiguration,
): Promise<KakaoAddressGeocodeResult> {
  if (address.trim().length === 0) return invalidAddress();
  const url = createKakaoAddressUrl(address);
  const response = await requestResponse(url, configuration);
  if (!response.success) return response;
  const validResponse = validateResponse(response.value);
  if (!validResponse.success) return validResponse;
  const payload = await readResponsePayload(response.value);
  if (!payload.success) return payload;
  return parseCoordinate(payload.value);
}

function createKakaoAddressUrl(address: string) {
  const url = new URL(KAKAO_ADDRESS_ENDPOINT);
  url.searchParams.set("query", address);
  return url;
}

async function requestResponse(
  url: URL,
  configuration: KakaoAddressGeocoderConfiguration,
): Promise<TransportResult<PublicDataHttpResponse>> {
  try {
    return succeedTransport(
      await configuration.fetchFunction(url, createRequest(configuration.restApiKey)),
    );
  } catch {
    return fail("network-error", "Kakao 주소 검색 요청에 실패했습니다.");
  }
}

function createRequest(restApiKey: string): RequestInit {
  return { headers: { Authorization: `KakaoAK ${restApiKey}` } };
}

function validateResponse(
  response: PublicDataHttpResponse,
): TransportResult<PublicDataHttpResponse> {
  if (response.ok) return succeedTransport(response);
  return fail("http-error", "Kakao 주소 검색이 오류 상태를 반환했습니다.", response.status);
}

async function readResponsePayload(
  response: PublicDataHttpResponse,
): Promise<TransportResult<unknown>> {
  try {
    return succeedTransport(await response.json());
  } catch {
    return fail("malformed-response", "Kakao 주소 검색 응답을 해석할 수 없습니다.");
  }
}

function parseCoordinate(payload: unknown): KakaoAddressGeocodeResult {
  if (!isUnknownRecord(payload)) return malformedResponse();
  if (!Array.isArray(payload.documents)) return malformedResponse();
  if (payload.documents.length === 0) return notFound();
  const firstDocument = payload.documents[0];
  if (!isUnknownRecord(firstDocument)) return malformedResponse();
  const coordinate = readCoordinate(firstDocument);
  if (!coordinate) return malformedResponse();
  return { coordinate, success: true };
}

function readCoordinate(document: UnknownRecord): Wgs84Coordinate | undefined {
  const latitude = readFiniteNumber(document.y);
  const longitude = readFiniteNumber(document.x);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude };
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return number;
}

function invalidAddress(): KakaoAddressGeocodeResult {
  return fail("invalid-address", "주소가 비어 있습니다.");
}

function notFound(): KakaoAddressGeocodeResult {
  return fail("not-found", "주소 검색 결과가 없습니다.");
}

function malformedResponse(): KakaoAddressGeocodeResult {
  return fail("malformed-response", "Kakao 주소 검색 응답 형식이 올바르지 않습니다.");
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function succeedTransport<T>(value: T): Readonly<{ success: true; value: T }> {
  return { success: true, value };
}

function fail(
  kind: KakaoAddressGeocodeFailureKind,
  message: string,
  status?: number,
): Readonly<{ failure: KakaoAddressGeocodeFailure; success: false }> {
  return { failure: { kind, message, status }, success: false };
}
