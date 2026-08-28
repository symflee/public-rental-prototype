import {
  hasManualRecruitmentStatusEvidenceAt,
  isPublicRentalSnapshotFresh,
  MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH,
  readRecruitmentStateAt,
  type PublicRentalRecruitmentState,
} from "@/domain/public-rental";
import {
  isAnalyticsStorageEnabled,
  recordAnalyticsSafely,
  recordLocationDetailView,
} from "@/infrastructure/analytics";
import { readLocationsWithManualRecruitmentNoticesStrict } from "@/infrastructure/manual-recruitment/manual-recruitment-overlay";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const locationId = await readLocationId(request);
  if (!locationId) return createErrorResponse("단지 식별자가 올바르지 않습니다.", 400);
  if (!isAnalyticsStorageEnabled()) return createRecordResponse(false);
  const lookup = await findLocationSafely(locationId);
  if (!lookup.succeeded) return createRecordResponse(false);
  const location = lookup.location;
  if (!location) return createErrorResponse("임대주택 위치를 찾을 수 없습니다.", 404);
  const now = new Date();
  const recruitmentState = readRecruitmentStateAt(location, now);
  if (!canRecordRecruitmentState(location, recruitmentState, now)) return createSkippedResponse();
  const statusSource = readStatusSource(location, recruitmentState, now);
  const recorded = await recordAnalyticsSafely(() =>
    recordLocationDetailView(location.id, recruitmentState, now, statusSource),
  );
  return createRecordResponse(recorded);
}

function canRecordRecruitmentState(
  location: Parameters<typeof hasManualRecruitmentStatusEvidenceAt>[0],
  state: PublicRentalRecruitmentState,
  now: Date,
) {
  if (state.status === "UNKNOWN") return false;
  if (state.status === "OPEN") return true;
  if (hasManualRecruitmentStatusEvidenceAt(location, now)) return true;
  if (publicRentalSnapshot.status !== "verified") return false;
  return isPublicRentalSnapshotFresh(publicRentalSnapshot.generatedAt, now);
}

function readStatusSource(
  location: Parameters<typeof hasManualRecruitmentStatusEvidenceAt>[0],
  state: PublicRentalRecruitmentState,
  now: Date,
) {
  const openNoticeSource = state.openNotices.at(0)?.sourceKind;
  if (openNoticeSource) return openNoticeSource;
  if (hasManualRecruitmentStatusEvidenceAt(location, now)) return "MANUAL_REVIEW";
  if (state.status === "NO_OPEN") return "SNAPSHOT_ABSENCE";
  return "UNKNOWN";
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

async function findLocationSafely(locationId: string) {
  try {
    return { location: await findLocation(locationId), succeeded: true } as const;
  } catch {
    return { succeeded: false } as const;
  }
}

async function findLocation(locationId: string) {
  const locations = await readLocationsWithManualRecruitmentNoticesStrict(
    publicRentalSnapshot.locations,
  );
  return locations.find((location) => location.id === locationId);
}

function createRecordResponse(recorded: boolean) {
  if (recorded) return createResult(true);
  return createResult(false, 503);
}

function createSkippedResponse() {
  return createResult(false);
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
