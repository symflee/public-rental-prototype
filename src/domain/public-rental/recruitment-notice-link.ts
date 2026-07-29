import type { PublicRentalLocation, PublicRentalRecruitmentNotice } from "./public-rental-location";

const OFFICIAL_RECRUITMENT_HOSTS = new Set(["apply.lh.or.kr", "www.myhome.go.kr"]);

export function findOfficialRecruitmentNotice(
  locations: readonly PublicRentalLocation[],
  locationId: string,
  announcementId: string,
): PublicRentalRecruitmentNotice | undefined {
  const location = locations.find((candidate) => candidate.id === locationId);
  if (!location) return undefined;
  const notice = location.recruitmentNotices?.find((candidate) => candidate.id === announcementId);
  if (!notice || !isOfficialRecruitmentUrl(notice.url)) return undefined;
  return notice;
}

function isOfficialRecruitmentUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return OFFICIAL_RECRUITMENT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
