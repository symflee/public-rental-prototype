import { expect, test } from "@playwright/test";

test("프로젝트 준비 화면을 연다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "프로젝트 준비 완료" })).toBeVisible();
});
