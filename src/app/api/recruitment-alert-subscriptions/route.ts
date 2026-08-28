import {
  RecruitmentAlertConflictError,
  RecruitmentAlertLocationNotFoundError,
  RecruitmentAlertStatusUnavailableError,
  RecruitmentAlertValidationError,
  subscribeRecruitmentAlert,
} from "@/infrastructure/recruitment-alert";

export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BODY_BYTES = 4_096;

export async function POST(request: Request) {
  const body = await readBody(request);
  if (body.kind === "TOO_LARGE") return createErrorResponse("요청 본문이 너무 큽니다.", 413);
  if (body.kind === "INVALID")
    return createErrorResponse("JSON 요청 본문이 올바르지 않습니다.", 400);
  try {
    await subscribeRecruitmentAlert(body.value);
    return createJsonResponse({ accepted: true });
  } catch (error) {
    return createSubscriptionErrorResponse(error);
  }
}

async function readBody(request: Request) {
  if (!isJsonRequest(request)) return { kind: "INVALID" } as const;
  if (isAdvertisedBodyTooLarge(request)) return { kind: "TOO_LARGE" } as const;
  try {
    return parseBody(await request.text());
  } catch {
    return { kind: "INVALID" } as const;
  }
}

function isJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function isAdvertisedBodyTooLarge(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(contentLength)) return false;
  return contentLength > MAXIMUM_REQUEST_BODY_BYTES;
}

function parseBody(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAXIMUM_REQUEST_BODY_BYTES) {
    return { kind: "TOO_LARGE" } as const;
  }
  return { kind: "VALID", value: JSON.parse(text) as unknown } as const;
}

function createSubscriptionErrorResponse(error: unknown) {
  if (error instanceof RecruitmentAlertValidationError) {
    return createErrorResponse(error.message, 400);
  }
  if (error instanceof RecruitmentAlertLocationNotFoundError) {
    return createErrorResponse("단지를 찾을 수 없습니다.", 404);
  }
  if (error instanceof RecruitmentAlertConflictError) {
    return createErrorResponse("현재 모집 중인 단지입니다.", 409);
  }
  if (error instanceof RecruitmentAlertStatusUnavailableError) return createUnavailableResponse();
  return createUnavailableResponse();
}

function createUnavailableResponse() {
  return createErrorResponse("모집공고 알림 저장소를 사용할 수 없습니다.", 503);
}

function createJsonResponse(body: object, status = 200) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" }, status });
}

function createErrorResponse(message: string, status: number) {
  return createJsonResponse({ message }, status);
}
