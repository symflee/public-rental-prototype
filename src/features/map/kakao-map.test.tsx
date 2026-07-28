import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { renderKakaoMap } from "@/infrastructure/kakao/kakao-map-sdk";

import { KakaoMap } from "./kakao-map";

vi.mock("@/infrastructure/kakao/kakao-map-sdk", () => ({
  renderKakaoMap: vi.fn(),
}));

const renderKakaoMapMock = vi.mocked(renderKakaoMap);

afterEach(() => {
  vi.clearAllMocks();
});

test("JavaScript 키가 없으면 설정 안내를 표시한다", () => {
  render(<KakaoMap />);

  expect(screen.getByRole("alert")).toHaveTextContent("카카오맵 키가 설정되지 않았습니다.");
  expect(renderKakaoMapMock).not.toHaveBeenCalled();
});

test("타일이 준비될 때까지 로딩 상태를 표시한다", () => {
  renderKakaoMapMock.mockReturnValue(new Promise(() => undefined));

  render(<KakaoMap javascriptKey=" javascript-key " />);

  expect(screen.getByRole("status")).toHaveTextContent("지도를 불러오는 중");
  expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("region")).toHaveAttribute("data-map-state", "loading");
  expect(renderKakaoMapMock).toHaveBeenCalledWith(expect.any(HTMLDivElement), "javascript-key", {
    latitude: 37.420035,
    level: 5,
    longitude: 127.127243,
  });
});

test("타일 로드가 끝나면 준비 상태가 된다", async () => {
  renderKakaoMapMock.mockResolvedValue();

  render(<KakaoMap javascriptKey="javascript-key" />);

  await waitForMapState("ready");
  expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "false");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("SDK 로드에 실패하면 확인 사항을 표시한다", async () => {
  renderKakaoMapMock.mockRejectedValue(new Error("SDK load failed"));

  render(<KakaoMap javascriptKey="javascript-key" />);

  await waitForMapState("error");
  expect(screen.getByRole("alert")).toHaveTextContent("도메인과 API 사용 설정");
});

async function waitForMapState(state: string) {
  await waitFor(() => {
    expect(screen.getByRole("region")).toHaveAttribute("data-map-state", state);
  });
}
