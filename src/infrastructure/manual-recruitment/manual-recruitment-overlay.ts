import type { PublicRentalLocation, PublicRentalRecruitmentNotice } from "@/domain/public-rental";

import { readActiveManualRecruitmentNotices } from "./manual-recruitment-service";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

export function mergeManualRecruitmentNotices(
  locations: readonly PublicRentalLocation[],
  manualNotices: readonly ManualRecruitmentNoticeInput[],
) {
  const noticesByLocation = createNoticesByLocation(manualNotices);
  return locations.map((location) => mergeLocationNotices(location, noticesByLocation));
}

export async function readLocationsWithManualRecruitmentNotices(
  locations: readonly PublicRentalLocation[],
) {
  try {
    const notices = await readActiveManualRecruitmentNotices();
    return mergeManualRecruitmentNotices(locations, notices);
  } catch {
    return locations;
  }
}

export async function readLocationsWithManualRecruitmentNoticesStrict(
  locations: readonly PublicRentalLocation[],
) {
  const notices = await readActiveManualRecruitmentNotices();
  return mergeManualRecruitmentNotices(locations, notices);
}

function createNoticesByLocation(notices: readonly ManualRecruitmentNoticeInput[]) {
  const values = new Map<string, PublicRentalRecruitmentNotice[]>();
  notices.forEach((notice) => addNoticeLocations(values, notice));
  return values;
}

function addNoticeLocations(
  values: Map<string, PublicRentalRecruitmentNotice[]>,
  notice: ManualRecruitmentNoticeInput,
) {
  notice.locationIds.forEach((locationId) => addLocationNotice(values, locationId, notice));
}

function addLocationNotice(
  values: Map<string, PublicRentalRecruitmentNotice[]>,
  locationId: string,
  notice: ManualRecruitmentNoticeInput,
) {
  const current = values.get(locationId) ?? [];
  current.push(createDomainNotice(notice));
  values.set(locationId, current);
}

function createDomainNotice(notice: ManualRecruitmentNoticeInput) {
  return {
    announcedAt: notice.announcedAt,
    applicationEndsAt: notice.applicationEndsAt,
    applicationStartsAt: notice.applicationStartsAt,
    evidenceUrl: notice.evidenceUrl,
    id: notice.id,
    sourceKind: notice.sourceKind,
    title: notice.title,
    url: notice.url,
  } satisfies PublicRentalRecruitmentNotice;
}

function mergeLocationNotices(
  location: PublicRentalLocation,
  noticesByLocation: ReadonlyMap<string, readonly PublicRentalRecruitmentNotice[]>,
) {
  const manualNotices = noticesByLocation.get(location.id) ?? [];
  const manualIdentifiers = new Set(manualNotices.map((notice) => notice.id));
  const importedNotices = (location.recruitmentNotices ?? []).filter(
    (notice) => !manualIdentifiers.has(notice.id),
  );
  return { ...location, recruitmentNotices: [...importedNotices, ...manualNotices] };
}
