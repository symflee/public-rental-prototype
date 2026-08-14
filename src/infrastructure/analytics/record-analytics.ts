export async function recordAnalyticsQuietly(record: () => Promise<void>) {
  try {
    await record();
  } catch {
    return;
  }
}

export async function recordAnalyticsSafely(record: () => Promise<void>) {
  try {
    await record();
    return true;
  } catch {
    console.error("분석 이벤트 기록에 실패했습니다.");
    return false;
  }
}
