import { recordAnalyticsQuietly, recordPageView } from "@/infrastructure/analytics";

export const dynamic = "force-dynamic";

export async function POST() {
  await recordAnalyticsQuietly(recordPageView);
  return new Response(null, { headers: { "Cache-Control": "no-store" }, status: 204 });
}
