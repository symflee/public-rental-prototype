export type PublicRentalProvider = "LH" | "SEONGNAM_CITY";

export type PublicRentalLocationKind = "CONSTRUCTION_RENTAL_COMPLEX" | "PURCHASE_RENTAL_BUILDING";

export type PublicRentalMunicipality = "SEONGNAM" | "YONGIN";

export type PublicRentalDistrict = "수정구" | "중원구" | "분당구" | "처인구" | "기흥구" | "수지구";

export type PublicRentalLegalCategory =
  | "NATIONAL_RENTAL"
  | "PERMANENT_RENTAL"
  | "HAPPY_HOUSING"
  | "INTEGRATED_PUBLIC_RENTAL"
  | "PUBLIC_RENTAL"
  | "PURCHASE_RENTAL";

export type PublicRentalCoordinateSource =
  "KAKAO_ADDRESS_SEARCH" | "MY_HOME_PUBLIC_RENTAL_API" | "SEONGNAM_PUBLIC_WIFI";

export type PublicRentalCoordinate = Readonly<{
  latitude: number;
  longitude: number;
  source: PublicRentalCoordinateSource;
}>;

export type PublicRentalSource =
  | "MY_HOME_PUBLIC_RENTAL_API"
  | "LH_CONSTRUCTION_RENTAL_CSV"
  | "LH_PURCHASE_RENTAL_CSV"
  | "SEONGNAM_URBAN_DEVELOPMENT_CORPORATION"
  | "SEONGNAM_PUBLIC_WIFI";

export type PublicRentalSourceRecord = Readonly<{
  source: PublicRentalSource;
  sourceId: string;
  sourceUrl: string;
  referenceDate: string | null;
}>;

export type RentalOffering = Readonly<{
  sourceId: string;
  legalCategory: PublicRentalLegalCategory;
  supplyTypeName: string;
  styleName: string | null;
  supplyAreaSquareMeters: number | null;
  householdCount: number | null;
  exclusiveAreaSquareMeters: number | null;
  commonAreaSquareMeters: number | null;
  depositWon: number | null;
  monthlyRentWon: number | null;
}>;

export type PublicRentalProperty = Readonly<{
  sourceId: string;
  name: string;
  kind: PublicRentalLocationKind;
  parcelNumber: string | null;
  householdCount: number | null;
  completionDate: string | null;
  offerings: readonly RentalOffering[];
  sourceRecords: readonly PublicRentalSourceRecord[];
}>;

export type PublicRentalLocation = Readonly<{
  id: string;
  provider: PublicRentalProvider;
  kind: PublicRentalLocationKind;
  municipality: PublicRentalMunicipality;
  district: PublicRentalDistrict;
  legalCategories: readonly PublicRentalLegalCategory[];
  name: string;
  roadAddress: string;
  addressAliases: readonly string[];
  parcelNumber: string | null;
  coordinate: PublicRentalCoordinate | null;
  householdCount: number | null;
  completionDate: string | null;
  properties: readonly PublicRentalProperty[];
  offerings: readonly RentalOffering[];
  sourceRecords: readonly PublicRentalSourceRecord[];
}>;

export class PublicRentalLocations {
  readonly values: readonly PublicRentalLocation[];

  constructor(values: readonly PublicRentalLocation[]) {
    this.values = Object.freeze([...values]);
  }
}
