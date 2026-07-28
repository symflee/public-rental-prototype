import {
  PublicRentalLocations,
  type PublicRentalLocation,
  type PublicRentalProperty,
  type PublicRentalSourceRecord,
  type RentalOffering,
} from "./public-rental-location";

const SEONGNAM_DEVELOPMENT_SOURCE_URL = "https://www.isdc.co.kr/operBusiness/dandaedong.asp";
const SEONGNAM_PUBLIC_WIFI_SOURCE_URL = "https://www.seongnam.go.kr/contents/down/10458_1.pdf";
const MY_HOME_SOURCE_URL = "https://www.data.go.kr/data/15110581/openapi.do";
const MANAGED_SEED_REFERENCE_DATE = "2026-07-28";
const DANDAE_EXCLUSIVE_AREAS = Object.freeze([16, 26, 44]);

export function createDandaeHappyHousingLocation(): PublicRentalLocation {
  const offerings = Object.freeze(DANDAE_EXCLUSIVE_AREAS.map(createDandaeOffering));
  const sourceRecords = createDandaeSourceRecords();
  return {
    ...createDandaeIdentity(),
    ...createDandaeHousingDetails(),
    coordinate: createDandaeCoordinate(),
    properties: Object.freeze([createDandaeProperty(offerings, sourceRecords)]),
    offerings,
    sourceRecords,
  };
}

export function createSeongnamCityPublicRentalLocations() {
  return new PublicRentalLocations([createDandaeHappyHousingLocation()]);
}

function createDandaeIdentity() {
  return {
    id: "seongnam:dandae-happy-housing",
    provider: "SEONGNAM_CITY" as const,
    kind: "CONSTRUCTION_RENTAL_COMPLEX" as const,
    legalCategories: Object.freeze(["HAPPY_HOUSING"] as const),
    municipality: "SEONGNAM" as const,
    district: "수정구" as const,
    name: "단대동 행복주택",
  };
}

function createDandaeHousingDetails() {
  return {
    roadAddress: "경기도 성남시 수정구 단대로23번길 36",
    addressAliases: Object.freeze(["경기도 성남시 수정구 단대로23번길 36"]),
    parcelNumber: "4113110400101300000",
    householdCount: 60,
    completionDate: "2021-03-10",
  };
}

function createDandaeCoordinate() {
  return {
    latitude: 37.450084696315,
    longitude: 127.155841734816,
    source: "SEONGNAM_PUBLIC_WIFI" as const,
  };
}

function createDandaeOffering(exclusiveAreaSquareMeters: number): RentalOffering {
  return {
    sourceId: `seongnam:dandae-happy-housing:${exclusiveAreaSquareMeters}`,
    legalCategory: "HAPPY_HOUSING",
    supplyTypeName: "행복주택",
    styleName: null,
    supplyAreaSquareMeters: exclusiveAreaSquareMeters,
    householdCount: null,
    exclusiveAreaSquareMeters,
    commonAreaSquareMeters: null,
    depositWon: null,
    monthlyRentWon: null,
  };
}

function createDandaeProperty(
  offerings: readonly RentalOffering[],
  sourceRecords: readonly PublicRentalSourceRecord[],
): PublicRentalProperty {
  return {
    sourceId: "seongnam:dandae-happy-housing",
    name: "단대동 행복주택",
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    parcelNumber: "4113110400101300000",
    householdCount: 60,
    completionDate: "2021-03-10",
    offerings,
    sourceRecords,
  };
}

function createDandaeSourceRecords(): readonly PublicRentalSourceRecord[] {
  return Object.freeze([
    createDevelopmentSourceRecord(),
    createPublicWifiSourceRecord(),
    createMyHomeSourceRecord(),
  ]);
}

function createDevelopmentSourceRecord(): PublicRentalSourceRecord {
  return {
    source: "SEONGNAM_URBAN_DEVELOPMENT_CORPORATION",
    sourceId: "seongnam:dandae-happy-housing",
    sourceUrl: SEONGNAM_DEVELOPMENT_SOURCE_URL,
    referenceDate: MANAGED_SEED_REFERENCE_DATE,
  };
}

function createPublicWifiSourceRecord(): PublicRentalSourceRecord {
  return {
    source: "SEONGNAM_PUBLIC_WIFI",
    sourceId: "단대동 행복주택 주민공동시설",
    sourceUrl: SEONGNAM_PUBLIC_WIFI_SOURCE_URL,
    referenceDate: MANAGED_SEED_REFERENCE_DATE,
  };
}

function createMyHomeSourceRecord(): PublicRentalSourceRecord {
  return {
    source: "MY_HOME_PUBLIC_RENTAL_API",
    sourceId: "31369110",
    sourceUrl: MY_HOME_SOURCE_URL,
    referenceDate: MANAGED_SEED_REFERENCE_DATE,
  };
}
