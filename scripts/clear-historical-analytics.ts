import { clearHistoricalLocationDetailViews } from "@/infrastructure/analytics";

void clearHistoricalLocationDetailViews().then(reportCleared).catch(reportFailure);

function reportCleared() {
  console.log("2026년 8월 11~14일 재구성 주택 조회 데이터만 제거했습니다.");
}

function reportFailure(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
