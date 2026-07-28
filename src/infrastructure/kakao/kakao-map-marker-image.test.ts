import { expect, test } from "vitest";

import { createMapMarkerImage, type MapMarkerCategory } from "./kakao-map-marker-image";

test("국민임대 핀을 색상과 한글 약자로 만든다", () => {
  const image = createMapMarkerImage(["NATIONAL_RENTAL"], false);
  const svg = decodeImageSource(image.source);

  expect(image).toMatchObject({ height: 52, width: 44 });
  expect(svg).toContain("#0F766E");
  expect(svg).toContain(">국<");
});

test("복합 유형 핀은 각 공급유형 색상과 약자를 함께 표시한다", () => {
  const categories: readonly MapMarkerCategory[] = ["HAPPY_HOUSING", "PERMANENT_RENTAL"];
  const svg = decodeImageSource(createMapMarkerImage(categories, false).source);

  expect(svg).toContain("#6D28D9");
  expect(svg).toContain("#1D4ED8");
  expect(svg).toContain(">행<");
  expect(svg).toContain(">영<");
  expect(svg).not.toContain(">복<");
});

test("선택한 핀은 크기와 노란 외곽선으로 구별한다", () => {
  const image = createMapMarkerImage(["PURCHASE_RENTAL"], true);
  const svg = decodeImageSource(image.source);

  expect(image).toMatchObject({ height: 60, width: 51 });
  expect(svg).toContain("#FACC15");
  expect(svg).toContain("selected-marker");
  expect(svg).toContain('viewBox="0 0 51 60"');
  expect(svg).toContain("scale(1.15)");
});

test("중복 유형은 한 번만 그리고 순서는 항상 일정하다", () => {
  const first = createMapMarkerImage(["HAPPY_HOUSING", "NATIONAL_RENTAL", "HAPPY_HOUSING"], false);
  const second = createMapMarkerImage(["NATIONAL_RENTAL", "HAPPY_HOUSING"], false);

  expect(first.source).toBe(second.source);
});

test("유형이 비어 있으면 공공임대 기본 핀을 만든다", () => {
  const svg = decodeImageSource(createMapMarkerImage([], false).source);

  expect(svg).toContain("#C2410C");
  expect(svg).toContain(">공<");
});

function decodeImageSource(source: string) {
  const encodedSvg = source.replace("data:image/svg+xml;charset=UTF-8,", "");
  return decodeURIComponent(encodedSvg);
}
