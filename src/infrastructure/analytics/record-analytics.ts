export async function recordAnalyticsQuietly(record: () => Promise<void>) {
  try {
    await record();
  } catch {
    return;
  }
}
