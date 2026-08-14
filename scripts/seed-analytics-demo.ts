import { seedAnalyticsDashboardDemo } from "@/infrastructure/analytics";

void seedAnalyticsDashboardDemo().then(reportSeeded).catch(reportFailure);

function reportSeeded() {
  console.log("최근 4일 분석 대시보드 데모 데이터를 저장했습니다.");
}

function reportFailure(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
