import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { usePageViewAnalytics } from "./use-page-view-analytics";

afterEach(() => vi.unstubAllGlobals());

test("지도가 준비된 뒤에만 비식별 조회 카운터를 한 번 요청한다", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  render(<ReadyMapAnalytics />);

  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/analytics/page-view",
    expect.objectContaining({ method: "POST" }),
  );
});

function ReadyMapAnalytics() {
  usePageViewAnalytics("ready");
  return null;
}
