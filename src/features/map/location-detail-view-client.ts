export async function recordLocationDetailView(locationId: string) {
  try {
    await fetch("/api/analytics/location-detail-view", createRequest(locationId));
  } catch {
    return;
  }
}

function createRequest(locationId: string): RequestInit {
  return {
    body: JSON.stringify({ locationId }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  };
}
