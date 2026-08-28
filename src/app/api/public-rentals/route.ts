import { NextResponse } from "next/server";

import { createPublicRentalMapResult } from "@/domain/public-rental";
import {
  isManualRecruitmentStorageEnabled,
  readLocationsWithManualRecruitmentNoticesStrict,
} from "@/infrastructure/manual-recruitment";
import { readPublicRentalMapRequest } from "@/infrastructure/public-data/public-rental-map-request";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "no-store";

export async function GET(request: Request) {
  try {
    return await createMapResponse(request);
  } catch {
    return NextResponse.json({ message: "지도 요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
}

async function createMapResponse(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const mapRequest = readPublicRentalMapRequest(parameters);
  const locations = await readMapLocations();
  if (!locations) return createStorageUnavailableResponse();
  const map = createPublicRentalMapResult(locations, mapRequest);
  const body = {
    generatedAt: publicRentalSnapshot.generatedAt,
    map,
    status: publicRentalSnapshot.status,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
}

async function readMapLocations() {
  if (!isManualRecruitmentStorageEnabled()) return publicRentalSnapshot.locations;
  try {
    return await readLocationsWithManualRecruitmentNoticesStrict(publicRentalSnapshot.locations);
  } catch {
    return undefined;
  }
}

function createStorageUnavailableResponse() {
  return NextResponse.json(
    { message: "모집공고 상태를 불러오지 못했습니다." },
    { headers: { "Cache-Control": "no-store" }, status: 503 },
  );
}
