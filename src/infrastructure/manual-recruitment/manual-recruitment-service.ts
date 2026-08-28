import { readRecruitmentStateAt } from "@/domain/public-rental";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

import {
  createManualRecruitmentRepository,
  type ManualRecruitmentRepository,
} from "./manual-recruitment-repository";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/u;
const NOTICE_IDENTIFIER_PATTERN = /^\d{1,64}$/u;
const MAXIMUM_LOCATION_COUNT = 100;
const MAXIMUM_TITLE_LENGTH = 300;

const repository = createManualRecruitmentRepository();
const locationIds = new Set(publicRentalSnapshot.locations.map((location) => location.id));

export type ManualRecruitmentServiceDependencies = Readonly<{
  locationIds: ReadonlySet<string>;
  repository: ManualRecruitmentRepository;
}>;

const defaultDependencies: ManualRecruitmentServiceDependencies = { locationIds, repository };

export class ManualRecruitmentValidationError extends Error {}

export class ManualRecruitmentConflictError extends Error {
  constructor() {
    super("같은 식별자의 수기 모집공고가 이미 존재합니다.");
  }
}

export class ManualRecruitmentNotFoundError extends Error {
  constructor() {
    super("활성 수기 모집공고를 찾을 수 없습니다.");
  }
}

export async function appendManualRecruitmentNotice(
  value: unknown,
  dependencies = defaultDependencies,
) {
  const notice = parseManualRecruitmentNotice(value, dependencies.locationIds);
  const inserted = await dependencies.repository.append(notice);
  if (!inserted) throw new ManualRecruitmentConflictError();
  return notice;
}

export function readActiveManualRecruitmentNotices(dependencies = defaultDependencies) {
  return dependencies.repository.readActive();
}

export function replaceHistoricalManualRecruitmentNotice(
  value: unknown,
  dependencies = defaultDependencies,
) {
  const notice = parseManualRecruitmentNotice(value, dependencies.locationIds);
  return dependencies.repository.replaceHistorical(notice);
}

export async function revokeManualRecruitmentNotice(
  noticeId: string,
  dependencies = defaultDependencies,
) {
  const revoked = await dependencies.repository.revoke(readNoticeIdentifier(noticeId));
  if (!revoked) throw new ManualRecruitmentNotFoundError();
}

export function initializeManualRecruitmentStorage(dependencies = defaultDependencies) {
  return dependencies.repository.initialize();
}

export function isManualRecruitmentStorageEnabled(dependencies = defaultDependencies) {
  return dependencies.repository.isEnabled();
}

function parseManualRecruitmentNotice(
  value: unknown,
  knownLocationIds: ReadonlySet<string>,
): ManualRecruitmentNoticeInput {
  if (!isRecord(value)) throw new ManualRecruitmentValidationError("공고 입력이 필요합니다.");
  const notice = createNotice(value, knownLocationIds);
  assertValidPeriod(notice);
  return normalizeNoticePeriod(notice);
}

function createNotice(
  value: Record<string, unknown>,
  knownLocationIds: ReadonlySet<string>,
): ManualRecruitmentNoticeInput {
  return {
    announcedAt: readAnnouncedAt(value.announcedAt),
    applicationEndsAt: readText(value.applicationEndsAt, "모집 종료 시각"),
    applicationStartsAt: readText(value.applicationStartsAt, "모집 시작 시각"),
    evidenceUrl: readOfficialUrl(value.evidenceUrl, "근거 URL"),
    id: readNoticeIdentifier(value.id),
    locationIds: readLocationIds(value.locationIds, knownLocationIds),
    sourceKind: readManualSourceKind(value.sourceKind),
    title: readTitle(value.title),
    url: readOfficialUrl(value.url, "공고 URL"),
  };
}

function readNoticeIdentifier(value: unknown) {
  if (typeof value === "string" && NOTICE_IDENTIFIER_PATTERN.test(value)) return value;
  throw new ManualRecruitmentValidationError("공고 식별자가 올바르지 않습니다.");
}

function readTitle(value: unknown) {
  const title = readText(value, "공고 제목");
  if (title.length <= MAXIMUM_TITLE_LENGTH) return title;
  throw new ManualRecruitmentValidationError("공고 제목이 너무 깁니다.");
}

function readAnnouncedAt(value: unknown) {
  const announcedAt = readText(value, "공고일");
  if (isValidDate(announcedAt)) return announcedAt;
  throw new ManualRecruitmentValidationError("공고일이 올바르지 않습니다.");
}

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value);
}

function readOfficialUrl(value: unknown, label: string) {
  const url = readUrl(readText(value, label));
  if (isOfficialLhUrl(url)) return url.href;
  throw new ManualRecruitmentValidationError(`${label}은 공식 LH HTTPS 주소여야 합니다.`);
}

function readUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    throw new ManualRecruitmentValidationError("URL 형식이 올바르지 않습니다.");
  }
}

function isOfficialLhUrl(url: URL) {
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "apply.lh.or.kr") return false;
  if (url.port || url.username || url.password) return false;
  return true;
}

function readManualSourceKind(value: unknown): "MANUAL_REVIEW" {
  if (value === "MANUAL_REVIEW") return value;
  throw new ManualRecruitmentValidationError("관리자 공고는 수기 검토 출처여야 합니다.");
}

function readLocationIds(value: unknown, knownLocationIds: ReadonlySet<string>) {
  if (!Array.isArray(value)) throw new ManualRecruitmentValidationError("단지 목록이 필요합니다.");
  const values = [...new Set(value.map(readLocationIdentifier))];
  if (values.length === 0 || values.length > MAXIMUM_LOCATION_COUNT) {
    throw new ManualRecruitmentValidationError("단지 목록 개수가 올바르지 않습니다.");
  }
  if (!values.every((locationId) => knownLocationIds.has(locationId))) {
    throw new ManualRecruitmentValidationError("현재 스냅샷에 없는 단지가 포함되어 있습니다.");
  }
  return values;
}

function readLocationIdentifier(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new ManualRecruitmentValidationError("단지 식별자가 올바르지 않습니다.");
}

function readText(value: unknown, label: string) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new ManualRecruitmentValidationError(`${label}이 필요합니다.`);
}

function assertValidPeriod(notice: ManualRecruitmentNoticeInput) {
  const state = readRecruitmentStateAt(
    { recruitmentNotices: [notice] },
    notice.applicationStartsAt,
  );
  if (state.status === "OPEN") return;
  throw new ManualRecruitmentValidationError("모집 기간이 올바르지 않습니다.");
}

function normalizeNoticePeriod(notice: ManualRecruitmentNoticeInput) {
  return {
    ...notice,
    applicationEndsAt: normalizeBoundary(notice.applicationEndsAt, true),
    applicationStartsAt: normalizeBoundary(notice.applicationStartsAt, false),
  };
}

function normalizeBoundary(value: string, endOfDay: boolean) {
  if (DATE_PATTERN.test(value)) return normalizeDateBoundary(value, endOfDay);
  if (LOCAL_DATE_TIME_PATTERN.test(value)) return new Date(`${value}+09:00`).toISOString();
  return new Date(value).toISOString();
}

function normalizeDateBoundary(value: string, endOfDay: boolean) {
  if (endOfDay) return new Date(`${value}T23:59:59.999+09:00`).toISOString();
  return new Date(`${value}T00:00:00.000+09:00`).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
