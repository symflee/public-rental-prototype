import {
  isExperimentEventKind,
  isExperimentVariant,
  PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY,
  type ExperimentEventKind,
} from "@/domain/announcement-analytics";
import { readRecruitmentStateAt } from "@/domain/public-rental";
import {
  isExperimentAnalyticsEnabled,
  recordAnalyticsSafely,
  recordExperimentEvent,
  resolveExperimentVisitorIdentity,
  type ExperimentEventInput,
} from "@/infrastructure/analytics";
import { readLocationsWithManualRecruitmentNotices } from "@/infrastructure/manual-recruitment/manual-recruitment-overlay";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export const dynamic = "force-dynamic";

const EVENT_IDENTIFIER_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function POST(request: Request) {
  const input = await readExperimentEventInput(request);
  if (!input) return createInvalidRequestResponse();
  if (!(await hasValidSubject(input))) return createInvalidSubjectResponse();
  if (!isExperimentAnalyticsEnabled()) return createRecordedResponse();
  const identity = resolveExperimentVisitorIdentity(request);
  if (!identity) return createRecordedResponse();
  if (identity.setCookieHeader) return createRecordedResponse(false, identity.setCookieHeader);
  const recorded = await recordAnalyticsSafely(() =>
    recordExperimentEvent(input, identity.visitorHash),
  );
  return createRecordedResponse(recorded, undefined, readResponseStatus(recorded));
}

async function readExperimentEventInput(request: Request) {
  try {
    return parseExperimentEventInput(await request.json());
  } catch {
    return undefined;
  }
}

function parseExperimentEventInput(value: unknown): ExperimentEventInput | undefined {
  if (!isRecord(value)) return undefined;
  const eventId = readEventIdentifier(value.eventId);
  const eventKind = value.eventKind;
  const variant = value.variant;
  if (!eventId || !isExperimentEventKind(eventKind)) return undefined;
  if (!isExperimentVariant(variant) || !hasExperimentKey(value.experimentKey)) return undefined;
  return createExperimentEventInput(value, eventId, eventKind, variant);
}

function createExperimentEventInput(
  value: Record<string, unknown>,
  eventId: string,
  eventKind: ExperimentEventKind,
  variant: ExperimentEventInput["variant"],
): ExperimentEventInput | undefined {
  const base = { eventId, eventKind, experimentKey: value.experimentKey as string, variant };
  if (eventKind === "EXPERIMENT_ELIGIBLE") return createEligibleInput(base, value.locationId);
  const locationId = readText(value.locationId);
  if (!locationId) return undefined;
  return { ...base, locationId };
}

function createEligibleInput(input: ExperimentEventInput, locationId: unknown) {
  if (locationId !== undefined) return undefined;
  return input;
}

async function hasValidSubject(input: ExperimentEventInput) {
  if (input.eventKind === "EXPERIMENT_ELIGIBLE") return true;
  const location = await findLocation(input.locationId);
  if (!location) return false;
  if (input.eventKind === "BOOKMARK_REMOVED") return true;
  const status = readRecruitmentStateAt(location, new Date()).status;
  if (input.eventKind === "OPEN_ANNOUNCEMENT_VIEWED") return status === "OPEN";
  return status === "NO_OPEN";
}

async function findLocation(locationId: string | undefined) {
  if (!locationId) return undefined;
  const locations = await readLocationsWithManualRecruitmentNotices(publicRentalSnapshot.locations);
  return locations.find((location) => location.id === locationId);
}

function createRecordedResponse(recorded = true, setCookieHeader?: string, status = 200) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (setCookieHeader) headers.set("Set-Cookie", setCookieHeader);
  return Response.json({ recorded }, { headers, status });
}

function readResponseStatus(recorded: boolean) {
  if (recorded) return 200;
  return 503;
}

function createInvalidRequestResponse() {
  return Response.json({ message: "실험 이벤트 형식이 올바르지 않습니다." }, { status: 400 });
}

function createInvalidSubjectResponse() {
  return Response.json(
    { message: "이 위치에는 해당 이벤트를 기록할 수 없습니다." },
    { status: 404 },
  );
}

function readEventIdentifier(value: unknown) {
  if (typeof value !== "string" || !EVENT_IDENTIFIER_PATTERN.test(value)) return undefined;
  return value.toLowerCase();
}

function hasExperimentKey(value: unknown): value is string {
  return value === PUBLIC_RENTAL_EXPLORATION_EXPERIMENT_KEY;
}

function readText(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
