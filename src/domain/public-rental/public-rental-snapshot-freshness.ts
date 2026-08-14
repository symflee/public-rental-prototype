export const PUBLIC_RENTAL_SNAPSHOT_MAXIMUM_AGE_HOURS = 72;

const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const MAXIMUM_AGE_MILLISECONDS = PUBLIC_RENTAL_SNAPSHOT_MAXIMUM_AGE_HOURS * HOUR_MILLISECONDS;

export function isPublicRentalSnapshotFresh(generatedAt: string, now = new Date()) {
  const generatedTime = Date.parse(generatedAt);
  if (!Number.isFinite(generatedTime)) return false;
  const age = now.getTime() - generatedTime;
  if (age < 0) return false;
  return age <= MAXIMUM_AGE_MILLISECONDS;
}
