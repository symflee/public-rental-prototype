export const LIVE_LOCATION_DETAIL_DATASET_ID = "live";
export const HISTORICAL_LOCATION_DETAIL_DATASET_ID = "historical-2026-08-11-14-v1";

export type LocationDetailNoticeState = "NO_OPEN" | "OPEN" | "UNKNOWN";

export type LocationDetailViewOrigin = "LIVE" | "RETROSPECTIVE_RECONSTRUCTION";

export type LocationDetailStatusSource =
  "AUTOMATED_IMPORT" | "MANUAL_REVIEW" | "SNAPSHOT_ABSENCE" | "UNKNOWN";

export type LocationDetailViewEvent = Readonly<{
  datasetId: string;
  eventId: string;
  locationId: string;
  matchedNoticeId: string | null;
  metricDate: string;
  noticeState: LocationDetailNoticeState;
  origin: LocationDetailViewOrigin;
  statusSource: LocationDetailStatusSource;
  viewedAt: string;
}>;

export type LocationDetailViewSummary = Readonly<{
  noOpenNoticeLocationDetailViewCount: number;
  openNoticeLocationDetailViewCount: number;
}>;

export function createLocationDetailViewSummary(
  openNoticeLocationDetailViewCount: number,
  noOpenNoticeLocationDetailViewCount: number,
): LocationDetailViewSummary {
  assertViewCount(openNoticeLocationDetailViewCount);
  assertViewCount(noOpenNoticeLocationDetailViewCount);
  return { noOpenNoticeLocationDetailViewCount, openNoticeLocationDetailViewCount };
}

function assertViewCount(value: number) {
  if (Number.isSafeInteger(value) && value >= 0) return;
  throw new Error("주택 상세 조회 수는 0 이상의 정수여야 합니다.");
}
