"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type {
  PublicRentalLocation,
  PublicRentalMapCluster,
  PublicRentalMapFilter,
  PublicRentalMapRequest,
  PublicRentalMapViewport,
} from "@/domain/public-rental";
import {
  fetchPublicRentalMap,
  type PublicRentalMapApiResponse,
} from "@/infrastructure/public-data/public-rental-map-client";

const REQUEST_DELAY_MILLISECONDS = 250;
const COORDINATE_PRECISION = 10_000;
const VIEWPORT_BUFFER_RATIO = 0.12;
const MAXIMUM_CACHED_VIEWPORTS = 24;

export type PublicRentalMapData = Readonly<{
  clusters: readonly PublicRentalMapCluster[];
  error: boolean;
  generatedAt: string | undefined;
  locations: readonly PublicRentalLocation[];
  loading: boolean;
  mode: "clusters" | "locations";
  status: "partial" | "verified" | undefined;
  totalLocationCount: number;
}>;

const EMPTY_MAP_DATA: PublicRentalMapData = {
  clusters: [],
  error: false,
  generatedAt: undefined,
  loading: false,
  locations: [],
  mode: "clusters",
  status: undefined,
  totalLocationCount: 0,
};

export function usePublicRentalMapData(
  staticLocations: readonly PublicRentalLocation[] | undefined,
  viewport: PublicRentalMapViewport | undefined,
  filter: PublicRentalMapFilter,
) {
  const [data, setData] = useState<PublicRentalMapData>(EMPTY_MAP_DATA);
  const cacheReference = useRef(new Map<string, PublicRentalMapData>());
  const request = useMemo(() => createMapRequest(viewport, filter), [filter, viewport]);
  useEffect(
    () => loadMapData(staticLocations, request, cacheReference, setData),
    [request, staticLocations],
  );
  return readStaticMapData(staticLocations) ?? data;
}

function createMapRequest(
  viewport: PublicRentalMapViewport | undefined,
  filter: PublicRentalMapFilter,
) {
  if (!viewport) return undefined;
  return { filter, viewport: canonicalizeViewport(expandViewport(viewport)) };
}

function expandViewport(viewport: PublicRentalMapViewport): PublicRentalMapViewport {
  const latitudePadding = (viewport.north - viewport.south) * VIEWPORT_BUFFER_RATIO;
  const longitudePadding = (viewport.east - viewport.west) * VIEWPORT_BUFFER_RATIO;
  return {
    ...viewport,
    east: viewport.east + longitudePadding,
    north: viewport.north + latitudePadding,
    south: viewport.south - latitudePadding,
    west: viewport.west - longitudePadding,
  };
}

function canonicalizeViewport(viewport: PublicRentalMapViewport): PublicRentalMapViewport {
  return {
    east: roundCoordinate(viewport.east),
    height: viewport.height,
    level: viewport.level,
    north: roundCoordinate(viewport.north),
    south: roundCoordinate(viewport.south),
    west: roundCoordinate(viewport.west),
    width: viewport.width,
  };
}

function roundCoordinate(value: number) {
  return Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;
}

function loadMapData(
  staticLocations: readonly PublicRentalLocation[] | undefined,
  request: PublicRentalMapRequest | undefined,
  cacheReference: RefObject<Map<string, PublicRentalMapData>>,
  setData: Dispatch<SetStateAction<PublicRentalMapData>>,
) {
  if (staticLocations || !request) return;
  const key = JSON.stringify(request);
  const cached = cacheReference.current.get(key);
  if (cached) return setData(cached);
  return requestMapData(request, key, cacheReference, setData);
}

function requestMapData(
  request: PublicRentalMapRequest,
  key: string,
  cacheReference: RefObject<Map<string, PublicRentalMapData>>,
  setData: Dispatch<SetStateAction<PublicRentalMapData>>,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => void fetchMapData(request, key, controller, cacheReference, setData),
    REQUEST_DELAY_MILLISECONDS,
  );
  setData((data) => ({ ...data, error: false, loading: true }));
  return () => cancelMapRequest(controller, timer);
}

function cancelMapRequest(controller: AbortController, timer: number) {
  window.clearTimeout(timer);
  controller.abort();
}

async function fetchMapData(
  request: PublicRentalMapRequest,
  key: string,
  controller: AbortController,
  cacheReference: RefObject<Map<string, PublicRentalMapData>>,
  setData: Dispatch<SetStateAction<PublicRentalMapData>>,
) {
  try {
    const response = await fetchPublicRentalMap(request, controller.signal);
    storeMapData(response, key, cacheReference, setData);
  } catch (error) {
    reportMapDataFailure(error, controller.signal, setData);
  }
}

function storeMapData(
  response: PublicRentalMapApiResponse,
  key: string,
  cacheReference: RefObject<Map<string, PublicRentalMapData>>,
  setData: Dispatch<SetStateAction<PublicRentalMapData>>,
) {
  const data = createMapData(response);
  rememberMapData(cacheReference.current, key, data);
  setData(data);
}

function rememberMapData(
  cache: Map<string, PublicRentalMapData>,
  key: string,
  data: PublicRentalMapData,
) {
  cache.set(key, data);
  if (cache.size <= MAXIMUM_CACHED_VIEWPORTS) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
}

function createMapData(response: PublicRentalMapApiResponse): PublicRentalMapData {
  return {
    ...response.map,
    error: false,
    generatedAt: response.generatedAt,
    loading: false,
    status: response.status,
  };
}

function reportMapDataFailure(
  error: unknown,
  signal: AbortSignal,
  setData: Dispatch<SetStateAction<PublicRentalMapData>>,
) {
  if (signal.aborted) return;
  if (isAbortError(error)) return;
  setData((data) => ({ ...data, error: true, loading: false }));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function readStaticMapData(locations: readonly PublicRentalLocation[] | undefined) {
  if (!locations) return undefined;
  return {
    ...EMPTY_MAP_DATA,
    locations,
    mode: "locations" as const,
    totalLocationCount: locations.length,
  };
}
