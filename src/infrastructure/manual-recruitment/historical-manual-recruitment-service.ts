import { HISTORICAL_MANUAL_RECRUITMENT_NOTICES } from "./historical-manual-recruitment-notices";
import { replaceHistoricalManualRecruitmentNotice } from "./manual-recruitment-service";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

type ReplaceNotice = (notice: ManualRecruitmentNoticeInput) => Promise<unknown>;

export async function seedHistoricalManualRecruitmentNotices(
  replace: ReplaceNotice = replaceHistoricalManualRecruitmentNotice,
) {
  for (const notice of HISTORICAL_MANUAL_RECRUITMENT_NOTICES) {
    await replace(notice);
  }
}
