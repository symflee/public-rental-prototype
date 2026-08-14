import {
  isPublicRentalSnapshotFresh,
  MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH,
} from "@/domain/public-rental";
import {
  isAnalyticsStorageEnabled,
  recordAnalyticsSafely,
  recordLocationDetailView,
} from "@/infrastructure/analytics";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const locationId = await readLocationId(request);
  if (!locationId) return createErrorResponse("단지 식별자가 올바르지 않습니다.", 400);
  const location = findLocation(locationId);
  if (!location) return createErrorResponse("임대주택 위치를 찾을 수 없습니다.", 404);
  if (!isPublicRentalSnapshotFresh(publicRentalSnapshot.generatedAt)) return createResult(false);
  if (!isAnalyticsStorageEnabled()) return createRecordResponse(false);
  const recorded = await recordAnalyticsSafely(() =>
    recordLocationDetailView(location.id, hasOpenNotice(location)),
  );
  return createRecordResponse(recorded);
}

async function readLocationId(request: Request) {
  try {
    return readLocationIdFromBody(await request.json());
  } catch {
    return undefined;
  }
}

function readLocationIdFromBody(value: unknown) {
  if (!isRecord(value) || typeof value.locationId !== "string") return undefined;
  const locationId = value.locationId.trim();
  if (!locationId || locationId.length > MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH)
    return undefined;
  return locationId;
}

function findLocation(locationId: string) {
  return publicRentalSnapshot.locations.find((location) => location.id === locationId);
}

function hasOpenNotice(location: (typeof publicRentalSnapshot.locations)[number]) {
  return Boolean(location.recruitmentNotices?.length);
}

function createRecordResponse(recorded: boolean) {
  if (recorded) return createResult(true);
  return createResult(false, 503);
}

function createResult(recorded: boolean, status = 200) {
  return Response.json({ recorded }, { headers: { "Cache-Control": "no-store" }, status });
}

function createErrorResponse(message: string, status: number) {
  return Response.json({ message }, { headers: { "Cache-Control": "no-store" }, status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
