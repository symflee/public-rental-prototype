import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { RecruitmentInterestButton } from "./recruitment-interest-button";

afterEach(() => vi.unstubAllGlobals());

test("미연결 단지의 공고 확인 의향을 한 번만 기록하고 안내한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  render(<RecruitmentInterestButton locationId="31191377" />);
  fireEvent.click(screen.getByRole("button", { name: "공고 확인해보기" }));

  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("등록된 모집 공고가 없습니다"),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/analytics/announcement-interest",
    expect.objectContaining({ body: JSON.stringify({ locationId: "31191377" }), method: "POST" }),
  );
  expect(screen.getByRole("button", { name: "확인 의향 기록됨" })).toBeDisabled();
});
