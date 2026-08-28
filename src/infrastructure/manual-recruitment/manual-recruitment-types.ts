import type { PublicRentalRecruitmentNoticeSourceKind } from "@/domain/public-rental";

export type ManualRecruitmentNoticeInput = Readonly<{
  announcedAt: string;
  applicationEndsAt: string;
  applicationStartsAt: string;
  evidenceUrl: string;
  id: string;
  locationIds: readonly string[];
  sourceKind: PublicRentalRecruitmentNoticeSourceKind;
  title: string;
  url: string;
}>;
