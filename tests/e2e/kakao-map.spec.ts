import { expect, test, type Locator, type Page } from "@playwright/test";

const TOTAL_LOCATION_COUNT = 269;
const SEONGNAM_LOCATION_COUNT = 87;
const YONGIN_LOCATION_COUNT = 182;
const CLUSTER_SELECTOR = [
  'div[style*="background: rgb(23, 37, 84)"]',
  'div[style*="background: #172554"]',
].join(", ");

test.describe("데스크톱 성남·용인 LH 임대주택 지도", () => {
  test.use({ viewport: { height: 900, width: 1280 } });

  test("269개 위치와 두 도시를 맞춘 지도 및 클러스터를 표시한다", async ({ page }) => {
    await openReadyMap(page);

    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
    await expectKakaoMapSurface(page);
    await expectClusterVisible(page);
    await expectDesktopRegionsDoNotOverlap(page);
  });

  test("도시와 공급유형 필터를 목록과 지도에 함께 적용한다", async ({ page }) => {
    await openReadyMap(page);

    await page.getByRole("radio", { name: "성남" }).click();
    await expectLocationCount(page, SEONGNAM_LOCATION_COUNT);
    await page.getByRole("radio", { name: "용인" }).click();
    await expectLocationCount(page, YONGIN_LOCATION_COUNT);
    await selectCategory(page, "행복주택");
    await expectLocationCount(page, 1);
    await expect(page.getByRole("button", { name: "용인김량장(행복) 선택" })).toBeVisible();
  });

  test("단일 행복주택 핀과 목록이 같은 상세 위치를 선택한다", async ({ page }) => {
    await openReadyMap(page);
    await searchFor(page, "용인김량장(행복)");
    await expectLocationCount(page, 1);

    await clickVisibleMarker(page, "용인김량장(행복)");
    await expectSelectedListItem(page, "용인김량장(행복)");
    await expectSingleLocationDetail(page);
  });

  test("복합 위치에서 두 공급유형 행과 세대·면적 범위를 표시한다", async ({ page }) => {
    await openReadyMap(page);
    await searchFor(page, "성남고등 A-1 행복주택리츠");
    await page.getByRole("button", { name: "성남고등 A-1 행복주택리츠 선택" }).click();

    await expectMixedLocationDetail(page);
  });

  test("지도 이동 결과는 사용자가 적용할 때만 목록을 좁힌다", async ({ page }) => {
    await openReadyMap(page);
    await dragMapHorizontally(page);

    const applyButton = page.getByRole("button", {
      name: /이 지도 영역에서 보기 · \d+곳/,
    });
    await expect(applyButton).toBeVisible({ timeout: 10_000 });
    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
    const visibleCount = await readViewportButtonCount(applyButton);
    expect(visibleCount).toBeGreaterThan(0);
    expect(visibleCount).toBeLessThan(TOTAL_LOCATION_COUNT);
    await applyButton.click();
    await expectLocationCount(page, visibleCount);
    await page.getByRole("button", { name: "전체 위치 보기" }).click();
    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
  });

  test("결과가 없는 검색을 안내하고 필터 초기화로 전체를 복원한다", async ({ page }) => {
    await openReadyMap(page);
    await searchFor(page, "존재하지않는임대주택주소");

    await expectLocationCount(page, 0);
    await expect(page.getByText("조건에 맞는 임대주택이 없습니다.")).toBeVisible();
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
    await expect(page.getByRole("searchbox", { name: "단지명 또는 주소 검색" })).toHaveValue("");
  });
});

test.describe("모바일 성남·용인 LH 임대주택 지도", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("초기 120px 시트 위로 269개 위치 지도와 클러스터를 표시한다", async ({ page }) => {
    await openReadyMap(page);

    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
    await expectClusterVisible(page);
    await expectCollapsedMobileSheet(page);
    await expect(page.getByRole("button", { name: "목록 펼치기" })).toBeVisible();
  });

  test("펼친 시트가 56dvh를 넘지 않고 모바일 상세를 탐색할 수 있다", async ({ page }) => {
    await openReadyMap(page);
    await page.getByRole("button", { name: "목록 펼치기" }).click();

    await expectExpandedMobileSheet(page);
    await page.getByRole("radio", { name: "용인" }).click();
    await expectLocationCount(page, YONGIN_LOCATION_COUNT);
    await selectCategory(page, "행복주택");
    await expectLocationCount(page, 1);
    await page.getByRole("button", { name: "용인김량장(행복) 선택" }).click();
    await expectSingleLocationDetail(page);
  });

  test("복합 상세를 표시하고 0건 검색을 전체 결과로 초기화한다", async ({ page }) => {
    await openReadyMap(page);
    await page.getByRole("button", { name: "목록 펼치기" }).click();
    await searchFor(page, "성남고등 A-1 행복주택리츠");
    await page.getByRole("button", { name: "성남고등 A-1 행복주택리츠 선택" }).click();
    await expectMixedLocationDetail(page);

    await searchFor(page, "모바일에도존재하지않는주소");
    await expectLocationCount(page, 0);
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
  });

  test("지도 이동 결과를 명시적으로 적용하고 전체 위치로 돌아온다", async ({ page }) => {
    await openReadyMap(page);
    await dragMapHorizontally(page);

    const applyButton = page.getByRole("button", {
      name: /이 지도 영역에서 보기 · \d+곳/,
    });
    await expect(applyButton).toBeVisible({ timeout: 10_000 });
    const visibleCount = await readViewportButtonCount(applyButton);
    expect(visibleCount).toBeLessThan(TOTAL_LOCATION_COUNT);
    await applyButton.click();
    await expectLocationCount(page, visibleCount);
    await page.getByRole("button", { name: "전체 위치 보기" }).click();
    await expectLocationCount(page, TOTAL_LOCATION_COUNT);
  });
});

async function openReadyMap(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(readMapRegion(page)).toHaveAttribute("data-map-state", "ready", {
    timeout: 25_000,
  });
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
  expect(panelBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  if (!panelBox || !mapBox) return;
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(mapBox.x);
}

async function searchFor(page: Page, query: string) {
  await page.getByRole("searchbox", { name: "단지명 또는 주소 검색" }).fill(query);
}

async function selectCategory(page: Page, name: string) {
  const filters = page.getByRole("region", { name: "임대주택 필터" });
  await filters.getByText(name, { exact: true }).click();
}

async function clickVisibleMarker(page: Page, title: string) {
  const marker = readMapRegion(page).locator(createMarkerSelector(title));
  await expect(marker).toBeVisible({ timeout: 10_000 });
  await marker.click({ force: true });
}

async function expectSelectedListItem(page: Page, name: string) {
  await expect(page.getByRole("button", { name: `${name} 선택` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

async function expectSingleLocationDetail(page: Page) {
  const detail = readLocationDetail(page);
  await expect(detail.getByRole("heading", { name: "용인김량장(행복)" })).toBeVisible();
  await expect(detail.getByText("70세대", { exact: true })).toBeVisible();
  await expect(detail.locator("strong").filter({ hasText: /^행복주택$/ })).toBeVisible();
  await expect(detail.getByText("70세대 · 16.39–36.32㎡", { exact: true })).toBeVisible();
}

async function expectMixedLocationDetail(page: Page) {
  const detail = readLocationDetail(page);
  await expect(detail.getByRole("heading", { name: "성남고등 A-1 행복주택리츠" })).toBeVisible();
  await expect(detail.getByText("1,520세대", { exact: true })).toBeVisible();
  await expect(detail.getByText("국민임대", { exact: true })).toBeVisible();
  await expect(detail.getByText("480세대 · 26.52–44.15㎡", { exact: true })).toBeVisible();
  await expect(detail.getByText("행복주택", { exact: true })).toBeVisible();
  await expect(detail.getByText("1,040세대 · 16.45–36.37㎡", { exact: true })).toBeVisible();
}

async function dragMapHorizontally(page: Page) {
  const mapBox = await readMapRegion(page).boundingBox();
  expect(mapBox).not.toBeNull();
  if (!mapBox) return;
  const verticalCenter = mapBox.y + mapBox.height / 2;
  await page.mouse.move(mapBox.x + mapBox.width * 0.75, verticalCenter);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + mapBox.width * 0.2, verticalCenter, { steps: 12 });
  await page.mouse.up();
}

async function readViewportButtonCount(button: Locator) {
  const label = await button.textContent();
  const countText = label?.match(/(\d+)곳/)?.[1];
  expect(countText).toBeDefined();
  return Number(countText);
}

async function expectCollapsedMobileSheet(page: Page) {
  const panelBox = await readExplorerPanel(page).boundingBox();
  expect(panelBox).not.toBeNull();
  if (!panelBox) return;
  expect(panelBox.height).toBeGreaterThanOrEqual(118);
  expect(panelBox.height).toBeLessThanOrEqual(122);
}

async function expectExpandedMobileSheet(page: Page) {
  const panelBox = await readExplorerPanel(page).boundingBox();
  const viewportHeight = page.viewportSize()?.height;
  expect(panelBox).not.toBeNull();
  expect(viewportHeight).toBeDefined();
  if (!panelBox || !viewportHeight) return;
  expect(panelBox.height).toBeLessThanOrEqual(viewportHeight * 0.57);
  expect(panelBox.y).toBeGreaterThan(viewportHeight * 0.4);
}

async function expectLocationCount(page: Page, count: number) {
  await expect(readExplorerPanel(page).getByText(`총 ${count}곳`, { exact: true })).toBeVisible();
}

function readMapRegion(page: Page) {
  return page.getByRole("region", { name: "성남시·용인시 LH 임대주택 지도" });
}

function readExplorerPanel(page: Page) {
  return page.getByRole("complementary", { name: "LH 임대주택 탐색" });
}

function readLocationDetail(page: Page) {
  return page.getByRole("region", { name: "선택한 임대주택 상세" });
}

function createMarkerSelector(title: string) {
  const escapedTitle = title.replaceAll('"', '\\"');
  return `img[title="${escapedTitle}"], img[alt="${escapedTitle}"]`;
}
