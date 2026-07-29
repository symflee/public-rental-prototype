import {
  readGyeonggiMunicipalityLabel,
  type PublicRentalLegalCategory,
  type PublicRentalMunicipality,
  type PublicRentalProvider,
} from "@/domain/public-rental";

export type CategoryPresentation = Readonly<{
  abbreviation: string;
  category: PublicRentalLegalCategory;
  color: string;
  label: string;
}>;

export const CATEGORY_PRESENTATIONS: readonly CategoryPresentation[] = [
  createCategory("NATIONAL_RENTAL", "국민임대", "국", "#0F766E"),
  createCategory("PERMANENT_RENTAL", "영구임대", "영", "#1D4ED8"),
  createCategory("HAPPY_HOUSING", "행복주택", "행", "#6D28D9"),
  createCategory("INTEGRATED_PUBLIC_RENTAL", "통합공공임대", "통", "#4338CA"),
  createCategory("PUBLIC_RENTAL", "공공임대", "공", "#C2410C"),
  createCategory("PURCHASE_RENTAL", "매입임대", "매", "#475569"),
];

const CATEGORY_LABELS = createCategoryLabels();

const PROVIDER_LABELS: Readonly<Record<PublicRentalProvider, string>> = {
  LH: "LH",
  SEONGNAM_CITY: "성남시",
};

export function createLegalCategoryText(categories: readonly PublicRentalLegalCategory[]) {
  if (categories.length === 0) return "유형 정보 없음";
  return categories.map(readCategoryLabel).join(", ");
}

export function readCategoryLabel(category: PublicRentalLegalCategory) {
  return CATEGORY_LABELS[category];
}

export function readProviderLabel(provider: PublicRentalProvider) {
  return PROVIDER_LABELS[provider];
}

export function readMunicipalityLabel(municipality: "ALL" | PublicRentalMunicipality) {
  if (municipality === "ALL") return "전체";
  return readGyeonggiMunicipalityLabel(municipality);
}

function createCategory(
  category: PublicRentalLegalCategory,
  label: string,
  abbreviation: string,
  color: string,
) {
  return { abbreviation, category, color, label };
}

function createCategoryLabels() {
  return Object.fromEntries(CATEGORY_PRESENTATIONS.map(createCategoryLabelEntry)) as Record<
    PublicRentalLegalCategory,
    string
  >;
}

function createCategoryLabelEntry(presentation: CategoryPresentation) {
  return [presentation.category, presentation.label];
}
