import { NextResponse, type NextRequest } from "next/server";

import { isAnalyticsAdministrator } from "@/infrastructure/analytics";

export function proxy(request: NextRequest) {
  if (isAnalyticsAdministrator(request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("관리자 인증이 필요합니다.", createUnauthorizedResponse());
}

function createUnauthorizedResponse() {
  return { headers: { "WWW-Authenticate": 'Basic realm="analytics"' }, status: 401 };
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
