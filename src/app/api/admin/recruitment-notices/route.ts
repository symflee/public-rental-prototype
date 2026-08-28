import { isAnalyticsAdministrator } from "@/infrastructure/analytics";
import {
  appendManualRecruitmentNotice,
  ManualRecruitmentConflictError,
  ManualRecruitmentValidationError,
  readActiveManualRecruitmentNotices,
} from "@/infrastructure/manual-recruitment";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = createUnauthorizedResponse(request);
  if (unauthorized) return unauthorized;
  try {
    const notices = await readActiveManualRecruitmentNotices();
    return createJsonResponse({ notices });
  } catch {
    return createUnavailableResponse();
  }
}

export async function POST(request: Request) {
  const unauthorized = createUnauthorizedResponse(request);
  if (unauthorized) return unauthorized;
  if (!hasSameOrigin(request)) return createErrorResponse("요청 출처가 올바르지 않습니다.", 403);
  const body = await readJson(request);
  if (!body) return createErrorResponse("JSON 요청 본문이 올바르지 않습니다.", 400);
  try {
    const notice = await appendManualRecruitmentNotice(body);
    return createJsonResponse({ notice }, 201);
  } catch (error) {
    return createAppendErrorResponse(error);
  }
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function createUnauthorizedResponse(request: Request) {
  if (isAnalyticsAdministrator(request.headers.get("authorization"))) return undefined;
  return createErrorResponse("관리자 인증이 필요합니다.", 401, {
    "WWW-Authenticate": 'Basic realm="recruitment-notices"',
  });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function createAppendErrorResponse(error: unknown) {
  if (error instanceof ManualRecruitmentValidationError) {
    return createErrorResponse(error.message, 400);
  }
  if (error instanceof ManualRecruitmentConflictError) {
    return createErrorResponse(error.message, 409);
  }
  return createUnavailableResponse();
}

function createUnavailableResponse() {
  return createErrorResponse("수기 모집공고 저장소를 사용할 수 없습니다.", 503);
}

function createJsonResponse(body: object, status = 200) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" }, status });
}

function createErrorResponse(message: string, status: number, headers: HeadersInit = {}) {
  return Response.json(
    { message },
    { headers: { "Cache-Control": "no-store", ...headers }, status },
  );
}
