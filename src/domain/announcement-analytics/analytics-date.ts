import type { AnalyticsDateRange } from "./analytics-counter";

const KOREAN_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Seoul",
  year: "numeric",
});

export function readKoreanDate(now = new Date()) {
  const parts = KOREAN_DATE_FORMATTER.formatToParts(now);
  return `${readDatePart(parts, "year")}-${readDatePart(parts, "month")}-${readDatePart(parts, "day")}`;
}

export function createRecentDateRange(today: string, dayCount: number): AnalyticsDateRange {
  return { from: subtractDays(today, dayCount - 1), to: today };
}

export function createCurrentMonthDateRange(today: string): AnalyticsDateRange {
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export function readAnalyticsDateRange(
  from: string | undefined,
  to: string | undefined,
  today = readKoreanDate(),
): AnalyticsDateRange {
  const range = readCustomDateRange(from, to, today);
  if (range) return range;
  return createRecentDateRange(today, 30);
}

export function subtractDays(date: string, dayCount: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - dayCount);
  return value.toISOString().slice(0, 10);
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const part = parts.find((value) => value.type === type);
  if (!part) throw new Error("한국 날짜를 만들 수 없습니다.");
  return part.value;
}

function readCustomDateRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
): AnalyticsDateRange | undefined {
  if (!isIsoDate(from) || !isIsoDate(to)) return undefined;
  if (!isValidRange(from, to, today)) return undefined;
  return { from, to };
}

function isValidRange(from: string, to: string, today: string) {
  if (from > to) return false;
  if (to > today) return false;
  return subtractDays(to, 365) <= from;
}

function isIsoDate(value: string | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}
