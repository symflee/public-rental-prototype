import { CATEGORY_PRESENTATIONS } from "./map-labels";

export type MapControlsProperties = Readonly<{
  expanded: boolean;
  onApplyViewport: () => void;
  onFitAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  pendingLocationCount: number | undefined;
  ready: boolean;
}>;

export function MapControls(properties: MapControlsProperties) {
  return (
    <>
      <ViewportSearchButton {...properties} />
      <ZoomControls {...properties} />
      <MapLegend expanded={properties.expanded} />
    </>
  );
}

function ViewportSearchButton(properties: MapControlsProperties) {
  if (properties.pendingLocationCount === undefined) return null;
  return (
    <button
      className="absolute left-1/2 top-4 z-10 min-h-11 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-5 text-sm font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      onClick={properties.onApplyViewport}
      type="button"
    >
      이 지도 영역에서 보기 · {properties.pendingLocationCount}곳
    </button>
  );
}

function ZoomControls(properties: MapControlsProperties) {
  return (
    <div
      aria-label="지도 조작"
      className="absolute right-3 top-3 z-10 flex flex-col gap-2 md:right-4 md:top-4"
      role="group"
    >
      <MapControlButton
        disabled={!properties.ready}
        label="지도 확대"
        onClick={properties.onZoomIn}
        symbol="+"
      />
      <MapControlButton
        disabled={!properties.ready}
        label="지도 축소"
        onClick={properties.onZoomOut}
        symbol="−"
      />
      <FitAllButton {...properties} />
    </div>
  );
}

function MapControlButton(properties: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  symbol: string;
}) {
  return (
    <button
      aria-label={properties.label}
      className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-800 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      disabled={properties.disabled}
      onClick={properties.onClick}
      type="button"
    >
      {properties.symbol}
    </button>
  );
}

function FitAllButton(properties: MapControlsProperties) {
  return (
    <button
      aria-label="전체 위치 보기"
      className="min-h-11 w-11 rounded-xl border border-slate-200 bg-white px-1 text-[10px] font-bold leading-3 text-slate-700 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      disabled={!properties.ready}
      onClick={properties.onFitAll}
      type="button"
    >
      전체
      <br />
      보기
    </button>
  );
}

function MapLegend({ expanded }: Readonly<{ expanded: boolean }>) {
  return (
    <section aria-label="공급유형 안내" className={createLegendClass(expanded)}>
      <h2 className="text-[11px] font-bold text-slate-700">핀 색상</h2>
      <ul aria-label="공급유형 범례" className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {CATEGORY_PRESENTATIONS.map(LegendItem)}
      </ul>
    </section>
  );
}

function LegendItem(presentation: (typeof CATEGORY_PRESENTATIONS)[number]) {
  return (
    <li
      className="flex items-center gap-1.5 text-[11px] text-slate-700"
      key={presentation.category}
    >
      <span
        aria-hidden="true"
        className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: presentation.color }}
      >
        {presentation.abbreviation}
      </span>
      <span>{presentation.label}</span>
    </li>
  );
}

function createLegendClass(expanded: boolean) {
  const base =
    "absolute bottom-[136px] left-3 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur md:bottom-4 md:left-4 md:block";
  if (expanded) return `${base} hidden`;
  return base;
}
