import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { usePageViewAnalytics } from "./use-page-view-analytics";

afterEach(() => vi.unstubAllGlobals());

test("지도가 준비되면 조회 카운터와 실험 자격을 한 번씩 요청한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  render(<ReadyMapAnalytics />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/analytics/page-view",
    expect.objectContaining({ method: "POST" }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/analytics/experiment-events",
    expect.objectContaining({ method: "POST" }),
  );
});

test("주택 데이터가 준비된 뒤에만 실험 자격을 기록한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<ReadyMapAnalytics explorationReady={false} />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock).not.toHaveBeenCalledWith(
    "/api/analytics/experiment-events",
    expect.any(Object),
  );
  view.rerender(<ReadyMapAnalytics explorationReady />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});

function ReadyMapAnalytics({ explorationReady = true }: Readonly<{ explorationReady?: boolean }>) {
  usePageViewAnalytics("ready", explorationReady);
  return null;
}
