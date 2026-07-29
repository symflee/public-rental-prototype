import { expect, test, type Page } from "@playwright/test";

const CLUSTER_SELECTOR = [
  'div[style*="background: rgb(23, 37, 84)"]',
  'div[style*="background: #172554"]',
].join(", ");

test.describe("데스크톱 경기도 LH 임대주택 지도", () => {
  test.use({ viewport: { height: 900, width: 1280 } });

  test("검증된 위치, 카카오 지도와 클러스터를 표시한다", async ({ page }) => {
    await openReadyMap(page);

    expect(await readLocationCount(page)).toBeGreaterThan(0);
    await expectKakaoMapSurface(page);
    await expectClusterVisible(page);
    await expectDesktopRegionsDoNotOverlap(page);
  });

  test("시군과 공급유형 필터를 목록과 지도에 함께 적용한다", async ({ page }) => {
    await openReadyMap(page);
    const initialCount = await readLocationCount(page);

    await selectFirstMunicipality(page);
    await expectPositiveFilteredCount(page, initialCount);
    await resetFilters(page);
    await selectFirstCategory(page);
    await expectPositiveFilteredCount(page, initialCount);
  });

  test("목록 선택이 같은 상세 위치를 표시한다", async ({ page }) => {
    await openReadyMap(page);
    const locationName = await selectFirstListLocation(page);

    await expectSelectedListItem(page, locationName);
    await expect(
      readLocationDetail(page).getByRole("heading", { name: locationName }),
    ).toBeVisible();
  });

  test("지도 이동 결과는 사용자가 적용할 때만 목록을 좁힌다", async ({ page }) => {
    await openReadyMap(page);
    const initialCount = await readLocationCount(page);

    await dragMapHorizontally(page);
    const applyButton = page.getByRole("button", { name: /이 지도 영역에서 보기 · \d+곳/ });
    await expect(applyButton).toBeVisible({ timeout: 10_000 });
    expect(await readLocationCount(page)).toBe(initialCount);
    await applyButton.click();
    expect(await readLocationCount(page)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "전체 위치 보기" }).click();
    await expectLocationCount(page, initialCount);
  });

  test("0건 검색은 필터 초기화로 전체 결과를 복원한다", async ({ page }) => {
    await openReadyMap(page);
    const initialCount = await readLocationCount(page);

    await searchFor(page, "존재하지않는임대주택주소");
    await expectLocationCount(page, 0);
    await expect(page.getByText("조건에 맞는 임대주택이 없습니다.")).toBeVisible();
    await resetFilters(page);
    await expectLocationCount(page, initialCount);
  });
});

test.describe("모바일 경기도 LH 임대주택 지도", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("초기 시트와 경기도 지도 위치를 표시한다", async ({ page }) => {
    await openReadyMap(page);

    expect(await readLocationCount(page)).toBeGreaterThan(0);
    await expectClusterVisible(page);
    await expectCollapsedMobileSheet(page);
  });

  test("펼친 시트에서 시군 필터와 상세를 탐색한다", async ({ page }) => {
    await openReadyMap(page);
    await page.getByRole("button", { name: "목록 펼치기" }).click();
    await expectExpandedMobileSheet(page);

    await selectFirstMunicipality(page);
    const locationName = await selectFirstListLocation(page);
    await expect(
      readLocationDetail(page).getByRole("heading", { name: locationName }),
    ).toBeVisible();
  });

  test("모바일 검색 결과도 전체 결과로 초기화한다", async ({ page }) => {
    await openReadyMap(page);
    const initialCount = await readLocationCount(page);

    await page.getByRole("button", { name: "목록 펼치기" }).click();
    await searchFor(page, "모바일에도존재하지않는주소");
    await expectLocationCount(page, 0);
    await resetFilters(page);
    await expectLocationCount(page, initialCount);
  });
});

async function openReadyMap(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(readMapRegion(page)).toHaveAttribute("data-map-state", "ready", { timeout: 25_000 });
}

async function expectKakaoMapSurface(page: Page) {
  const map = readMapRegion(page);
  await expect(map.getByRole("link", { name: /Kakao 맵으로 이동/ })).toBeVisible();
  await expect(page.getByText(/카카오맵을 불러오지 못했습니다/)).toHaveCount(0);
}

async function expectClusterVisible(page: Page) {
  const clusters = readMapRegion(page).locator(CLUSTER_SELECTOR);
  await expect(clusters.first()).toBeVisible({ timeout: 10_000 });
  await expect(clusters.first()).toHaveText(/^\d+$/);
}

async function expectDesktopRegionsDoNotOverlap(page: Page) {
  const panelBox = await readExplorerPanel(page).boundingBox();
  const mapBox = await readMapRegion(page).boundingBox();
  if (!panelBox || !mapBox) throw new Error("지도 또는 목록 패널 크기를 읽지 못했습니다.");
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(mapBox.x);
}

async function selectFirstMunicipality(page: Page) {
  const municipality = page.getByRole("radio").nth(1);
  await municipality.click();
}

async function selectFirstCategory(page: Page) {
  const category = page.getByRole("checkbox").first();
  await category.check({ force: true });
}

async function expectPositiveFilteredCount(page: Page, initialCount: number) {
  const filteredCount = await readLocationCount(page);
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThanOrEqual(initialCount);
}

async function resetFilters(page: Page) {
  await page.getByRole("button", { name: "필터 초기화" }).click();
}

async function searchFor(page: Page, query: string) {
  await page.getByRole("searchbox", { name: "단지명 또는 주소 검색" }).fill(query);
}

async function readFirstLocationName(page: Page) {
  const button = readExplorerPanel(page)
    .getByRole("button", { name: / 선택$/ })
    .first();
  const label = await button.getAttribute("aria-label");
  if (!label) throw new Error("첫 번째 위치 이름을 읽지 못했습니다.");
  return label.replace(/ 선택$/u, "");
}

async function selectFirstListLocation(page: Page) {
  const name = await readFirstLocationName(page);
  await readExplorerPanel(page)
    .getByRole("button", { name: `${name} 선택` })
    .click();
  return name;
}

async function expectSelectedListItem(page: Page, name: string) {
  await expect(page.getByRole("button", { name: `${name} 선택` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

async function dragMapHorizontally(page: Page) {
  const mapBox = await readMapRegion(page).boundingBox();
  if (!mapBox) throw new Error("지도 영역 크기를 읽지 못했습니다.");
  const verticalCenter = mapBox.y + mapBox.height / 2;
  await page.mouse.move(mapBox.x + mapBox.width * 0.75, verticalCenter);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + mapBox.width * 0.2, verticalCenter, { steps: 12 });
  await page.mouse.up();
}

async function expectCollapsedMobileSheet(page: Page) {
  const panelBox = await readExplorerPanel(page).boundingBox();
  if (!panelBox) throw new Error("모바일 시트 크기를 읽지 못했습니다.");
  expect(panelBox.height).toBeGreaterThanOrEqual(118);
  expect(panelBox.height).toBeLessThanOrEqual(122);
}

async function expectExpandedMobileSheet(page: Page) {
  const panelBox = await readExplorerPanel(page).boundingBox();
  const viewportHeight = page.viewportSize()?.height;
  if (!panelBox || !viewportHeight) throw new Error("펼친 모바일 시트 크기를 읽지 못했습니다.");
  expect(panelBox.height).toBeLessThanOrEqual(viewportHeight * 0.57);
  expect(panelBox.y).toBeGreaterThan(viewportHeight * 0.4);
}

async function expectLocationCount(page: Page, count: number) {
  await expect(readExplorerPanel(page).getByText(`총 ${count}곳`, { exact: true })).toBeVisible();
}

async function readLocationCount(page: Page) {
  const text = await readExplorerPanel(page)
    .getByText(/^총 \d+곳$/u)
    .textContent();
  const matched = text?.match(/\d+/u);
  if (!matched) throw new Error("위치 수를 읽지 못했습니다.");
  return Number(matched[0]);
}

function readMapRegion(page: Page) {
  return page.getByRole("region", { name: "경기도 LH 임대주택 지도" });
}

function readExplorerPanel(page: Page) {
  return page.getByRole("complementary", { name: "LH 임대주택 탐색" });
}

function readLocationDetail(page: Page) {
  return page.getByRole("region", { name: "선택한 임대주택 상세" });
}
