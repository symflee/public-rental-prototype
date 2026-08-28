import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

const HANAM_NOTICE_URL =
  "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020409&ccrCnntSysDsCd=03&uppAisTpCd=06&aisTpCd=09&mi=1026";
const OSAN_NOTICE_URL =
  "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020387&ccrCnntSysDsCd=03&uppAisTpCd=06&aisTpCd=10&mi=1026";
const UIJEONGBU_NOTICE_URL =
  "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=0000061130&ccrCnntSysDsCd=02&uppAisTpCd=06&aisTpCd=08&mi=1026";

export const HISTORICAL_MANUAL_RECRUITMENT_NOTICES = [
  {
    announcedAt: "2026-07-20",
    applicationEndsAt: "2026-08-14",
    applicationStartsAt: "2026-07-27",
    evidenceUrl: HANAM_NOTICE_URL,
    id: "20853",
    locationIds: ["30855346", "31297390"],
    sourceKind: "MANUAL_REVIEW",
    title: "하남감일8단지. 미사13단지 영구임대주택 예비입주자 모집공고",
    url: HANAM_NOTICE_URL,
  },
  {
    announcedAt: "2026-07-27",
    applicationEndsAt: "2026-08-13",
    applicationStartsAt: "2026-08-11",
    evidenceUrl: OSAN_NOTICE_URL,
    id: "20894",
    locationIds: ["31110418", "31191160", "31205874", "31206494", "31467977"],
    sourceKind: "MANUAL_REVIEW",
    title: "오산시 행복주택 입주자격완화 예비입주자 모집(2026.07.27)",
    url: OSAN_NOTICE_URL,
  },
  {
    announcedAt: "2026-07-29",
    applicationEndsAt: "2026-08-12T16:00",
    applicationStartsAt: "2026-08-11T10:00",
    evidenceUrl: UIJEONGBU_NOTICE_URL,
    id: "20917",
    locationIds: ["31157400", "31191377", "31274353", "31276982", "31299124"],
    sourceKind: "MANUAL_REVIEW",
    title: "의정부지역 10년 공공임대주택 예비입주자모집 공고(무순위)",
    url: UIJEONGBU_NOTICE_URL,
  },
] as const satisfies readonly ManualRecruitmentNoticeInput[];
