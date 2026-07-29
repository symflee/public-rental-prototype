import { recordAnalyticsQuietly, recordAnnouncementInterest } from "@/infrastructure/analytics";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const locationId = await readLocationId(request);
  if (!locationId) return createInvalidRequestResponse();
  if (!isUnlinkedLocation(locationId)) return createUnknownLocationResponse();
  await recordAnalyticsQuietly(() => recordAnnouncementInterest(locationId));
  return Response.json({ recorded: true }, { headers: { "Cache-Control": "no-store" } });
}

async function readLocationId(request: Request) {
  try {
    return readLocationIdFromBody(await request.json());
  } catch {
    return undefined;
  }
}

function readLocationIdFromBody(value: unknown) {
  if (!isRecord(value)) return undefined;
  if (typeof value.locationId !== "string") return undefined;
  if (value.locationId.trim().length === 0) return undefined;
  return value.locationId;
}

function isUnlinkedLocation(locationId: string) {
  const location = publicRentalSnapshot.locations.find((candidate) => candidate.id === locationId);
  if (!location) return false;
  return !location.recruitmentNotices || location.recruitmentNotices.length === 0;
}

function createInvalidRequestResponse() {
  return Response.json({ message: "단지 식별자가 올바르지 않습니다." }, { status: 400 });
}

function createUnknownLocationResponse() {
  return Response.json({ message: "공고 의향을 기록할 수 없는 단지입니다." }, { status: 404 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
