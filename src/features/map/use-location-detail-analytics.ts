import { useEffect } from "react";

import type { PublicRentalLocation } from "@/domain/public-rental";

import { recordNoOpenNoticeLocationViewed } from "./experiment-event-client";

export function useLocationDetailAnalytics(location: PublicRentalLocation | undefined) {
  const locationId = location?.id;
  const hasOpenNotice = Boolean(location?.recruitmentNotices?.length);
  useEffect(() => recordLocationView(locationId, hasOpenNotice), [hasOpenNotice, locationId]);
}

function recordLocationView(locationId: string | undefined, hasOpenNotice: boolean) {
  if (!locationId || hasOpenNotice) return;
  void recordNoOpenNoticeLocationViewed(locationId);
}
