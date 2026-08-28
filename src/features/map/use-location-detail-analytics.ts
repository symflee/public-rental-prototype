import { useEffect } from "react";

import {
  hasManualRecruitmentStatusEvidenceAt,
  readRecruitmentStateAt,
  type PublicRentalLocation,
} from "@/domain/public-rental";

import { recordNoOpenNoticeLocationViewed } from "./experiment-event-client";
import { recordLocationDetailView } from "./location-detail-view-client";

export function useLocationDetailAnalytics(
  location: PublicRentalLocation | undefined,
  recruitmentAbsenceReliable = true,
) {
  const locationId = location?.id;
  const noticeState = readNoticeState(location);
  const hasManualEvidence = readManualEvidence(location);
  useEffect(
    () => recordLocationView(locationId, noticeState, recruitmentAbsenceReliable, hasManualEvidence),
    [locationId, noticeState, recruitmentAbsenceReliable, hasManualEvidence],
  );
}

function readNoticeState(location: PublicRentalLocation | undefined) {
  if (!location) return "UNKNOWN";
  return readRecruitmentStateAt(location, new Date()).status;
}

function readManualEvidence(location: PublicRentalLocation | undefined) {
  if (!location) return false;
  return hasManualRecruitmentStatusEvidenceAt(location, new Date());
}

function recordLocationView(
  locationId: string | undefined,
  noticeState: "NO_OPEN" | "OPEN" | "UNKNOWN",
  recruitmentAbsenceReliable: boolean,
  hasManualEvidence: boolean,
) {
  if (!locationId) return;
  if (noticeState === "UNKNOWN") return;
  if (noticeState === "NO_OPEN" && !recruitmentAbsenceReliable && !hasManualEvidence) return;
  void recordLocationDetailView(locationId);
  if (noticeState !== "NO_OPEN") return;
  void recordNoOpenNoticeLocationViewed(locationId);
}
