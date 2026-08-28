import { timingSafeEqual } from "node:crypto";

import { HISTORICAL_LOCATION_DETAIL_DATASET_ID } from "@/domain/announcement-analytics";
import {
  clearAnalyticsDashboardDemo,
  initializeAnalyticsStorage,
  readLocationDetailViewSummary,
  seedHistoricalLocationDetailViews,
} from "@/infrastructure/analytics";
import { seedHistoricalManualRecruitmentNotices } from "@/infrastructure/manual-recruitment";

const HISTORICAL_RANGE = { from: "2026-08-11", to: "2026-08-14" } as const;

export async function POST(request: Request) {
  if (!isAuthorized(request)) return createErrorResponse("인증이 필요합니다.", 401);
  if (!hasSameOrigin(request)) return createErrorResponse("요청 출처가 올바르지 않습니다.", 403);
  return seedHistoricalAnalyticsSafely();
}

async function seedHistoricalAnalyticsSafely() {
  try {
    const report = await seedHistoricalAnalytics();
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return createErrorResponse("분석 데이터 준비에 실패했습니다.", 503);
  }
}

async function seedHistoricalAnalytics() {
  await initializeAnalyticsStorage();
  await seedHistoricalManualRecruitmentNotices();
  await seedHistoricalLocationDetailViews();
  await clearAnalyticsDashboardDemo();
  const summary = await readLocationDetailViewSummary(
    HISTORICAL_LOCATION_DETAIL_DATASET_ID,
    HISTORICAL_RANGE,
  );
  return createSeedReport(summary.openNoticeLocationDetailViewCount, summary.noOpenNoticeLocationDetailViewCount);
}

function createSeedReport(openCount: number, noOpenCount: number) {
  const totalCount = openCount + noOpenCount;
  return {
    datasetId: HISTORICAL_LOCATION_DETAIL_DATASET_ID,
    noOpenNoticeLocationDetailViewCount: noOpenCount,
    noOpenNoticeLocationDetailViewRate: roundToOneDecimal((noOpenCount / totalCount) * 100),
    openNoticeLocationDetailViewCount: openCount,
    totalLocationDetailViewCount: totalCount,
  };
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function isAuthorized(request: Request) {
  const expectedToken = process.env.ANALYTICS_MIGRATION_TOKEN?.trim();
  const providedToken = readBearerToken(request.headers.get("authorization"));
  if (!expectedToken || !providedToken) return false;
  if (expectedToken.length !== providedToken.length) return false;
  return timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken));
}

function readBearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  if (token) return token;
  return undefined;
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function createErrorResponse(message: string, status: number) {
  return Response.json({ message }, { headers: { "Cache-Control": "no-store" }, status });
}
