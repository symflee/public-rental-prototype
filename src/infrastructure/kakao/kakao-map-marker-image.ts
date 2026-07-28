export type MapMarkerCategory =
  | "NATIONAL_RENTAL"
  | "PERMANENT_RENTAL"
  | "HAPPY_HOUSING"
  | "INTEGRATED_PUBLIC_RENTAL"
  | "PUBLIC_RENTAL"
  | "PURCHASE_RENTAL";

export type MapMarkerImage = Readonly<{
  height: number;
  source: string;
  width: number;
}>;

type CategoryStyle = Readonly<{
  color: string;
  label: string;
}>;

const CATEGORY_ORDER: readonly MapMarkerCategory[] = [
  "NATIONAL_RENTAL",
  "PERMANENT_RENTAL",
  "HAPPY_HOUSING",
  "INTEGRATED_PUBLIC_RENTAL",
  "PUBLIC_RENTAL",
  "PURCHASE_RENTAL",
];

const CATEGORY_STYLES: Readonly<Record<MapMarkerCategory, CategoryStyle>> = {
  NATIONAL_RENTAL: { color: "#0F766E", label: "국" },
  PERMANENT_RENTAL: { color: "#1D4ED8", label: "영" },
  HAPPY_HOUSING: { color: "#6D28D9", label: "행" },
  INTEGRATED_PUBLIC_RENTAL: { color: "#4338CA", label: "통" },
  PUBLIC_RENTAL: { color: "#C2410C", label: "공" },
  PURCHASE_RENTAL: { color: "#475569", label: "매" },
};

const MARKER_PATH = "M22 48C19 43 5 32 5 21C5 11.6 12.6 4 22 4S39 11.6 39 21C39 32 25 43 22 48Z";

export function createMapMarkerImage(
  categories: readonly MapMarkerCategory[],
  selected: boolean,
): MapMarkerImage {
  const normalizedCategories = normalizeCategories(categories);
  const dimensions = readImageDimensions(selected);
  const svg = createMarkerSvg(normalizedCategories, selected, dimensions);
  return { ...dimensions, source: createSvgDataSource(svg) };
}

function normalizeCategories(categories: readonly MapMarkerCategory[]) {
  const uniqueCategories = new Set(categories);
  if (uniqueCategories.size === 0) uniqueCategories.add("PUBLIC_RENTAL");
  return CATEGORY_ORDER.filter((category) => uniqueCategories.has(category));
}

function createMarkerSvg(
  categories: readonly MapMarkerCategory[],
  selected: boolean,
  dimensions: Readonly<{ height: number; width: number }>,
) {
  const firstStyle = CATEGORY_STYLES[categories[0] ?? "PUBLIC_RENTAL"];
  const segments = categories.map(createSegment).join("");
  const labels = categories
    .map((category, index) => createLabel(category, index, categories))
    .join("");
  const content = createMarkerSvgContent(firstStyle, selected, segments, labels);
  const transform = createMarkerTransform(selected);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}"><g${transform}>${content}</g></svg>`;
}

function createMarkerSvgContent(
  firstStyle: CategoryStyle,
  selected: boolean,
  segments: string,
  labels: string,
) {
  const selectionMarker = createSelectionMarker(selected);
  return `${selectionMarker}<path d="${MARKER_PATH}" fill="${firstStyle.color}" stroke="#fff" stroke-width="3"/><clipPath id="head"><circle cx="22" cy="21" r="15.5"/></clipPath><g clip-path="url(#head)">${segments}</g>${labels}`;
}

function createMarkerTransform(selected: boolean) {
  if (!selected) return "";
  return ' transform="translate(0.2 0) scale(1.15)"';
}

function createSelectionMarker(selected: boolean) {
  if (!selected) return "";
  return `<g id="selected-marker"><path d="${MARKER_PATH}" fill="none" stroke="#FACC15" stroke-width="7"/><path d="${MARKER_PATH}" fill="none" stroke="#fff" stroke-width="3"/></g>`;
}

function createSegment(category: MapMarkerCategory, index: number, categories: readonly unknown[]) {
  const width = 31 / categories.length;
  const x = 6.5 + width * index;
  return `<rect x="${x}" y="5.5" width="${width}" height="31" fill="${CATEGORY_STYLES[category].color}"/>`;
}

function createLabel(category: MapMarkerCategory, index: number, categories: readonly unknown[]) {
  const width = 31 / categories.length;
  const x = 6.5 + width * index + width / 2;
  return `<text x="${x}" y="25.5" fill="#fff" font-family="system-ui,sans-serif" font-size="12" font-weight="800" text-anchor="middle">${CATEGORY_STYLES[category].label}</text>`;
}

function readImageDimensions(selected: boolean) {
  if (selected) return { height: 60, width: 51 };
  return { height: 52, width: 44 };
}

function createSvgDataSource(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
