import {
  purgeExpiredAnalyticsCounters,
  purgeExpiredExperimentEvents,
} from "@/infrastructure/analytics";
import { purgeRecruitmentAlertSubscriptions } from "@/infrastructure/recruitment-alert";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasCronAuthorization(request)) return new Response("Unauthorized", { status: 401 });
  await Promise.all([
    purgeExpiredAnalyticsCounters(),
    purgeExpiredExperimentEvents(),
    purgeRecruitmentAlertSubscriptions(),
  ]);
  return Response.json({ purged: true }, { headers: { "Cache-Control": "no-store" } });
}

function hasCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
