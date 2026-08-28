import {
  isPublicRentalSnapshotFresh,
  readRecruitmentNoticePeriodStateAt,
  readRecruitmentStateAt,
  type PublicRentalLocation,
  type PublicRentalRecruitmentState,
} from "@/domain/public-rental";

export type ManualRecruitmentTiming = "CLOSED" | "UPCOMING";

export function readMapRecruitmentState(
  location: PublicRentalLocation,
  absenceReliable: boolean,
  now = new Date(),
): PublicRentalRecruitmentState {
  const state = readRecruitmentStateAt(location, now);
  if (state.status === "OPEN" || absenceReliable) return state;
  if (readManualRecruitmentTiming(location, now)) return state;
  return { openNotices: [], status: "UNKNOWN" };
}

export function readManualRecruitmentTiming(
  location: PublicRentalLocation,
  now = new Date(),
): ManualRecruitmentTiming | undefined {
  const states = (location.recruitmentNotices ?? [])
    .filter(isManualNotice)
    .map((notice) => readRecruitmentNoticePeriodStateAt(notice, now));
  if (states.includes("UPCOMING")) return "UPCOMING";
  if (states.includes("CLOSED")) return "CLOSED";
  return undefined;
}

export function isRecruitmentAbsenceReliable(
  generatedAt: string | undefined,
  status: "partial" | "verified" | undefined,
  now = new Date(),
) {
  if (!generatedAt || !status) return true;
  if (status !== "verified") return false;
  return isPublicRentalSnapshotFresh(generatedAt, now);
}

function isManualNotice(notice: NonNullable<PublicRentalLocation["recruitmentNotices"]>[number]) {
  return notice.sourceKind === "MANUAL_REVIEW";
}
