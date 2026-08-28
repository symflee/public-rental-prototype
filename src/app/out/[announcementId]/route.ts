import {
  findOfficialRecruitmentNotice,
  readRecruitmentStateAt,
  type PublicRentalLocation,
} from "@/domain/public-rental";
import {
  isExperimentAnalyticsEnabled,
  recordAnalyticsQuietly,
  recordAnnouncementOpen,
  recordOpenAnnouncementViewed,
  resolveExperimentVisitorIdentity,
} from "@/infrastructure/analytics";
import { readLocationsWithManualRecruitmentNotices } from "@/infrastructure/manual-recruitment";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

type AnnouncementRouteContext = Readonly<{
  params: Promise<Readonly<{ announcementId: string }>>;
}>;

export async function GET(request: Request, context: AnnouncementRouteContext) {
  const locationId = new URL(request.url).searchParams.get("locationId");
  const { announcementId } = await context.params;
  const locations = await readLocationsWithManualRecruitmentNotices(publicRentalSnapshot.locations);
  const notice = readNotice(locations, locationId, announcementId);
  if (!notice || !locationId) return new Response("모집공고를 찾을 수 없습니다.", { status: 404 });
  await recordAnalyticsQuietly(() => recordAnnouncementOpen(announcementId));
  const location = locations.find((value) => value.id === locationId);
  const cookie = await recordExperimentOpen(request, location);
  return createRedirectResponse(notice.url, cookie);
}

function createRedirectResponse(url: string, setCookieHeader: string | undefined) {
  const headers = new Headers({ "Cache-Control": "no-store", Location: url });
  if (setCookieHeader) headers.set("Set-Cookie", setCookieHeader);
  return new Response(null, {
    headers,
    status: 307,
  });
}

async function recordExperimentOpen(request: Request, location: PublicRentalLocation | undefined) {
  if (!location || readRecruitmentStateAt(location, new Date()).status !== "OPEN") return undefined;
  if (!isExperimentAnalyticsEnabled()) return undefined;
  const identity = resolveExperimentVisitorIdentity(request);
  if (!identity) return undefined;
  await recordAnalyticsQuietly(() =>
    recordOpenAnnouncementViewed(location.id, identity.visitorHash),
  );
  return identity.setCookieHeader;
}

function readNotice(
  locations: readonly PublicRentalLocation[],
  locationId: string | null,
  announcementId: string,
) {
  if (!locationId) return undefined;
  return findOfficialRecruitmentNotice(locations, locationId, announcementId);
}
