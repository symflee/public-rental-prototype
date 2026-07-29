import type { PublicRentalMapRequest, PublicRentalMapResult } from "@/domain/public-rental";

export type PublicRentalMapApiResponse = Readonly<{
  generatedAt: string;
  map: PublicRentalMapResult;
  status: "partial" | "verified";
}>;

export async function fetchPublicRentalMap(
  request: PublicRentalMapRequest,
  signal?: AbortSignal,
): Promise<PublicRentalMapApiResponse> {
  const response = await fetch(createPublicRentalMapRequestUrl(request), { signal });
  if (!response.ok) throw new Error("지도 데이터를 불러오지 못했습니다.");
  return (await response.json()) as PublicRentalMapApiResponse;
}

export function createPublicRentalMapRequestUrl(request: PublicRentalMapRequest) {
  const parameters = createRequestParameters(request);
  return `/api/public-rentals?${parameters.toString()}`;
}

function createRequestParameters(request: PublicRentalMapRequest) {
  const parameters = new URLSearchParams();
  appendViewport(parameters, request);
  appendFilter(parameters, request);
  return parameters;
}

function appendViewport(parameters: URLSearchParams, request: PublicRentalMapRequest) {
  const { viewport } = request;
  parameters.set("east", String(viewport.east));
  parameters.set("height", String(viewport.height));
  parameters.set("level", String(viewport.level));
  parameters.set("north", String(viewport.north));
  parameters.set("south", String(viewport.south));
  parameters.set("west", String(viewport.west));
  parameters.set("width", String(viewport.width));
}

function appendFilter(parameters: URLSearchParams, request: PublicRentalMapRequest) {
  const { filter } = request;
  if (filter.categories.length > 0) parameters.set("categories", filter.categories.join(","));
  if (filter.municipality !== "ALL") parameters.set("municipality", filter.municipality);
  if (filter.query) parameters.set("query", filter.query);
}
