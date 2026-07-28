import { expect, test } from "@playwright/test";

test("성남시청 인근 카카오맵을 표시한다", async ({ page }) => {
  await page.goto("/");

  const map = page.getByRole("region", { name: "성남시청 인근 카카오맵" });
  await expect(map).toHaveAttribute("data-map-state", "ready", { timeout: 25_000 });
  await expect(map.getByRole("link", { name: /Kakao 맵으로 이동/ })).toBeVisible();
  await expect(
    page.getByText("카카오맵을 불러오지 못했습니다. 등록 도메인과 API 사용 설정을 확인해 주세요."),
  ).toHaveCount(0);
});
