import type { PublicRentalLocation, PublicRentalRecruitmentNotice } from "./public-rental-location";

const KOREA_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/u;
const OFFSET_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:\d{2})$/u;

export type PublicRentalRecruitmentStatus = "OPEN" | "NO_OPEN" | "UNKNOWN";

export type PublicRentalRecruitmentState = Readonly<{
  openNotices: readonly PublicRentalRecruitmentNotice[];
  status: PublicRentalRecruitmentStatus;
}>;

type RecruitmentLocation = Pick<PublicRentalLocation, "recruitmentNotices">;
export type PublicRentalRecruitmentNoticePeriodState = "CLOSED" | "OPEN" | "UNKNOWN" | "UPCOMING";

export function readRecruitmentStateAt(
  location: RecruitmentLocation,
  referenceTime: Date | string,
): PublicRentalRecruitmentState {
  const referenceMilliseconds = readReferenceMilliseconds(referenceTime);
  if (referenceMilliseconds === undefined) return createState("UNKNOWN", []);
  return readNoticeStates(location.recruitmentNotices ?? [], referenceMilliseconds);
}

export function hasManualRecruitmentStatusEvidenceAt(
  location: RecruitmentLocation,
  referenceTime: Date | string,
) {
  const referenceMilliseconds = readReferenceMilliseconds(referenceTime);
  if (referenceMilliseconds === undefined) return false;
  return (location.recruitmentNotices ?? []).some(
    (notice) =>
      notice.sourceKind === "MANUAL_REVIEW" &&
      readNoticePeriodState(notice, referenceMilliseconds) !== "UNKNOWN",
  );
}

function readNoticeStates(
  notices: readonly PublicRentalRecruitmentNotice[],
  referenceMilliseconds: number,
) {
  const openNotices = notices.filter(isNoticeOpenAt(referenceMilliseconds));
  if (openNotices.length > 0) return createState("OPEN", openNotices);
  if (notices.some(isNoticePeriodUnknown)) return createState("UNKNOWN", []);
  return createState("NO_OPEN", []);
}

function createState(
  status: PublicRentalRecruitmentStatus,
  openNotices: readonly PublicRentalRecruitmentNotice[],
) {
  return { openNotices: Object.freeze([...openNotices]), status };
}

function isNoticeOpenAt(referenceMilliseconds: number) {
  return (notice: PublicRentalRecruitmentNotice) =>
    readNoticePeriodState(notice, referenceMilliseconds) === "OPEN";
}

function isNoticePeriodUnknown(notice: PublicRentalRecruitmentNotice) {
  return readNoticePeriod(notice) === undefined;
}

function readNoticePeriodState(
  notice: PublicRentalRecruitmentNotice,
  referenceMilliseconds: number,
): PublicRentalRecruitmentNoticePeriodState {
  const period = readNoticePeriod(notice);
  if (!period) return "UNKNOWN";
  if (referenceMilliseconds < period.startsAt) return "UPCOMING";
  if (referenceMilliseconds > period.endsAt) return "CLOSED";
  return "OPEN";
}

export function readRecruitmentNoticePeriodStateAt(
  notice: PublicRentalRecruitmentNotice,
  referenceTime: Date | string,
): PublicRentalRecruitmentNoticePeriodState {
  const referenceMilliseconds = readReferenceMilliseconds(referenceTime);
  if (referenceMilliseconds === undefined) return "UNKNOWN";
  return readNoticePeriodState(notice, referenceMilliseconds);
}

function readNoticePeriod(notice: PublicRentalRecruitmentNotice) {
  const startsAt = readBoundaryMilliseconds(notice.applicationStartsAt, false);
  const endsAt = readBoundaryMilliseconds(notice.applicationEndsAt, true);
  if (startsAt === undefined || endsAt === undefined) return undefined;
  if (startsAt > endsAt) return undefined;
  return { endsAt, startsAt };
}

function readReferenceMilliseconds(referenceTime: Date | string) {
  if (referenceTime instanceof Date) return readDateMilliseconds(referenceTime);
  return readBoundaryMilliseconds(referenceTime, false);
}

function readDateMilliseconds(value: Date) {
  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds)) return undefined;
  return milliseconds;
}

function readBoundaryMilliseconds(value: string | null | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  const dateParts = DATE_PATTERN.exec(value);
  if (dateParts) return readKoreaDateMilliseconds(dateParts, endOfDay);
  const localParts = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (localParts) return readKoreaLocalMilliseconds(localParts);
  return readOffsetMilliseconds(value);
}

function readKoreaDateMilliseconds(parts: RegExpExecArray, endOfDay: boolean) {
  if (endOfDay) return readKoreaMilliseconds(parts, 23, 59, 59, 999);
  return readKoreaMilliseconds(parts, 0, 0, 0, 0);
}

function readKoreaLocalMilliseconds(parts: RegExpExecArray) {
  const milliseconds = Number((parts[7] ?? "0").padEnd(3, "0"));
  return readKoreaMilliseconds(
    parts,
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6] ?? 0),
    milliseconds,
  );
}

function readKoreaMilliseconds(
  parts: RegExpExecArray,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) {
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (!isValidCalendarTime(year, month, day, hour, minute, second, millisecond)) return undefined;
  const utcMilliseconds = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  return utcMilliseconds - KOREA_OFFSET_MILLISECONDS;
}

function isValidCalendarTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) {
  if (![year, month, day, hour, minute, second, millisecond].every(Number.isInteger)) return false;
  if (!isValidClockTime(hour, minute, second, millisecond)) return false;
  return readDaysInMonth(year, month) >= day && day >= 1;
}

function isValidClockTime(hour: number, minute: number, second: number, millisecond: number) {
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;
  return millisecond >= 0 && millisecond <= 999;
}

function readDaysInMonth(year: number, month: number) {
  if (month < 1 || month > 12) return 0;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function readOffsetMilliseconds(value: string) {
  const parts = OFFSET_DATE_TIME_PATTERN.exec(value);
  if (!parts || !hasValidDateTimeParts(parts)) return undefined;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  return milliseconds;
}

function hasValidDateTimeParts(parts: RegExpExecArray) {
  const millisecond = Number((parts[7] ?? "0").padEnd(3, "0"));
  return isValidCalendarTime(
    Number(parts[1]),
    Number(parts[2]),
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6] ?? 0),
    millisecond,
  );
}
