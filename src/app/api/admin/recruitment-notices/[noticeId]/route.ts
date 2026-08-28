import { isAnalyticsAdministrator } from "@/infrastructure/analytics";
import {
  ManualRecruitmentNotFoundError,
  ManualRecruitmentValidationError,
  revokeManualRecruitmentNotice,
} from "@/infrastructure/manual-recruitment";

type RouteContext = Readonly<{ params: Promise<Readonly<{ noticeId: string }>> }>;

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = createUnauthorizedResponse(request);
  if (unauthorized) return unauthorized;
  if (!hasSameOrigin(request)) return createErrorResponse("요청 출처가 올바르지 않습니다.", 403);
  const parameters = await context.params;
  const noticeId = readNoticeIdentifier(parameters.noticeId);
  if (!noticeId) return createErrorResponse("공고 식별자가 올바르지 않습니다.", 400);
  try {
    await revokeManualRecruitmentNotice(noticeId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return createRevokeErrorResponse(error);
  }
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function readNoticeIdentifier(value: string) {
  const noticeId = value.trim();
  if (noticeId.length > 0) return noticeId;
  return undefined;
}

function createUnauthorizedResponse(request: Request) {
  if (isAnalyticsAdministrator(request.headers.get("authorization"))) return undefined;
  return createErrorResponse("관리자 인증이 필요합니다.", 401, {
    "WWW-Authenticate": 'Basic realm="recruitment-notices"',
  });
}

function createRevokeErrorResponse(error: unknown) {
  if (error instanceof ManualRecruitmentValidationError) {
    return createErrorResponse(error.message, 400);
  }
  if (error instanceof ManualRecruitmentNotFoundError) {
    return createErrorResponse(error.message, 404);
  }
  return createErrorResponse("수기 모집공고 저장소를 사용할 수 없습니다.", 503);
}

function createErrorResponse(message: string, status: number, headers: HeadersInit = {}) {
  return Response.json(
    { message },
    { headers: { "Cache-Control": "no-store", ...headers }, status },
  );
}
