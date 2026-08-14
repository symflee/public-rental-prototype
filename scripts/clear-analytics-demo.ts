import { clearAnalyticsDashboardDemo } from "@/infrastructure/analytics";

void clearAnalyticsDashboardDemo().then(reportCleared).catch(reportFailure);

function reportCleared() {
  console.log("분석 대시보드 데모 데이터를 정리했습니다.");
}

function reportFailure(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
