import {
  MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH,
  readRecruitmentStateAt,
  type PublicRentalLocation,
} from "@/domain/public-rental";
import { readLocationsWithManualRecruitmentNoticesStrict } from "@/infrastructure/manual-recruitment/manual-recruitment-overlay";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

import {
  createRecruitmentAlertRepository,
  type RecruitmentAlertRepository,
} from "./recruitment-alert-repository";

const CONSENT_VERSION = "recruitment-alert-v1";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MAXIMUM_EMAIL_LENGTH = 254;
const ONE_YEAR_MILLISECONDS = 365 * 24 * 60 * 60 * 1_000;
const repository = createRecruitmentAlertRepository();

type RecruitmentAlertSnapshot = Readonly<{
  generatedAt: string;
  locations: readonly PublicRentalLocation[];
  status: "partial" | "verified";
}>;

export type RecruitmentAlertServiceDependencies = Readonly<{
  readLocations: (
    locations: readonly PublicRentalLocation[],
  ) => Promise<readonly PublicRentalLocation[]>;
  repository: RecruitmentAlertRepository;
  snapshot: RecruitmentAlertSnapshot;
}>;

const defaultDependencies: RecruitmentAlertServiceDependencies = {
  readLocations: readLocationsWithManualRecruitmentNoticesStrict,
  repository,
  snapshot: publicRentalSnapshot,
};

export class RecruitmentAlertValidationError extends Error {}
export class RecruitmentAlertLocationNotFoundError extends Error {}
export class RecruitmentAlertConflictError extends Error {}
export class RecruitmentAlertStatusUnavailableError extends Error {}

export async function subscribeRecruitmentAlert(
  value: unknown,
  now = new Date(),
  dependencies = defaultDependencies,
) {
  const input = parseSubscriptionInput(value);
  if (input.website) return;
  const location = await readEligibleLocation(input.locationId, now, dependencies);
  await dependencies.repository.append(createSubscription(input, location, now));
}

export function initializeRecruitmentAlertStorage(dependencies = defaultDependencies) {
  return dependencies.repository.initialize();
}

export function purgeRecruitmentAlertSubscriptions(
  now = new Date(),
  dependencies = defaultDependencies,
) {
  return dependencies.repository.purge(now.toISOString());
}

function parseSubscriptionInput(value: unknown) {
  if (!isRecord(value)) throw new RecruitmentAlertValidationError("신청 정보가 필요합니다.");
  return {
    email: readEmail(value.email),
    locationId: readLocationId(value.locationId),
    website: readWebsite(value.website),
    privacyConsent: readConsent(value.privacyConsent),
  };
}

function readEmail(value: unknown) {
  if (typeof value !== "string") throw new RecruitmentAlertValidationError("이메일이 필요합니다.");
  const email = value.trim();
  if (email.length > MAXIMUM_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new RecruitmentAlertValidationError("이메일 형식이 올바르지 않습니다.");
  }
  return email;
}

function readLocationId(value: unknown) {
  if (typeof value !== "string") return rejectLocationId();
  const locationId = value.trim();
  if (!locationId || locationId.length > MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH) {
    return rejectLocationId();
  }
  return locationId;
}

function rejectLocationId(): never {
  throw new RecruitmentAlertValidationError("단지 식별자가 올바르지 않습니다.");
}

function readWebsite(value: unknown) {
  if (value === undefined) return "";
  if (typeof value === "string") return value.trim();
  throw new RecruitmentAlertValidationError("요청 형식이 올바르지 않습니다.");
}

function readConsent(value: unknown) {
  if (value === true) return true;
  throw new RecruitmentAlertValidationError("개인정보 수집 동의가 필요합니다.");
}

async function readEligibleLocation(
  locationId: string,
  now: Date,
  dependencies: RecruitmentAlertServiceDependencies,
) {
  const locations = await dependencies.readLocations(dependencies.snapshot.locations);
  const location = locations.find((candidate) => candidate.id === locationId);
  if (!location) throw new RecruitmentAlertLocationNotFoundError("단지를 찾을 수 없습니다.");
  assertNoOpenRecruitment(location, now);
  return location;
}

function assertNoOpenRecruitment(location: PublicRentalLocation, now: Date) {
  const state = readRecruitmentStateAt(location, now);
  if (state.status === "OPEN") throw new RecruitmentAlertConflictError("이미 모집 중입니다.");
}

function createSubscription(
  input: { email: string; locationId: string },
  location: PublicRentalLocation,
  now: Date,
) {
  return {
    consentVersion: CONSENT_VERSION,
    consentedAt: now.toISOString(),
    email: input.email,
    emailNormalized: input.email.toLowerCase(),
    expiresAt: new Date(now.getTime() + ONE_YEAR_MILLISECONDS).toISOString(),
    locationId: location.id,
    locationNameSnapshot: location.name,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
