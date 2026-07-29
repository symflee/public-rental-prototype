import { NextResponse } from "next/server";

import { createPublicRentalMapResult } from "@/domain/public-rental";
import { readPublicRentalMapRequest } from "@/infrastructure/public-data/public-rental-map-request";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=60, s-maxage=600, stale-while-revalidate=86400";

export function GET(request: Request) {
  try {
    return createMapResponse(request);
  } catch {
    return NextResponse.json({ message: "지도 요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
}

function createMapResponse(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const mapRequest = readPublicRentalMapRequest(parameters);
  const map = createPublicRentalMapResult(publicRentalSnapshot.locations, mapRequest);
  const body = {
    generatedAt: publicRentalSnapshot.generatedAt,
    map,
    status: publicRentalSnapshot.status,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
}
