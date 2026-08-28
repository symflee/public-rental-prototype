import {
  clearAnalyticsDashboardDemo,
  seedHistoricalLocationDetailViews,
} from "@/infrastructure/analytics";
import { seedHistoricalManualRecruitmentNotices } from "@/infrastructure/manual-recruitment";

void seedHistoricalAnalytics().then(reportSeeded).catch(reportFailure);

async function seedHistoricalAnalytics() {
  await seedHistoricalManualRecruitmentNotices();
  await seedHistoricalLocationDetailViews();
  await clearAnalyticsDashboardDemo();
}

function reportSeeded() {
  console.log("2026년 8월 11~14일 주택 상세 조회 132건을 저장했습니다.");
}

function reportFailure(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
