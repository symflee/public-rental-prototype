import { initializeAnalyticsStorage } from "@/infrastructure/analytics";

void initializeAnalyticsStorage().then(reportInitialized).catch(reportFailure);

function reportInitialized() {
  console.log("Neon 서비스 저장 스키마를 준비했습니다.");
}

function reportFailure(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
