export const GYEONGGI_COLLECTION_AREAS = [
  createArea("111", "SUWON", "수원", "장안구"),
  createArea("113", "SUWON", "수원", "권선구"),
  createArea("115", "SUWON", "수원", "팔달구"),
  createArea("117", "SUWON", "수원", "영통구"),
  createArea("131", "SEONGNAM", "성남", "수정구"),
  createArea("133", "SEONGNAM", "성남", "중원구"),
  createArea("135", "SEONGNAM", "성남", "분당구"),
  createArea("150", "UIJEONGBU", "의정부", "의정부시"),
  createArea("171", "ANYANG", "안양", "만안구"),
  createArea("173", "ANYANG", "안양", "동안구"),
  createArea("190", "BUCHEON", "부천", "부천시"),
  createArea("210", "GWANGMYEONG", "광명", "광명시"),
  createArea("220", "PYEONGTAEK", "평택", "평택시"),
  createArea("250", "DONGDUCHEON", "동두천", "동두천시"),
  createArea("271", "ANSAN", "안산", "상록구"),
  createArea("273", "ANSAN", "안산", "단원구"),
  createArea("281", "GOYANG", "고양", "덕양구"),
  createArea("285", "GOYANG", "고양", "일산동구"),
  createArea("287", "GOYANG", "고양", "일산서구"),
  createArea("290", "GWACHEON", "과천", "과천시"),
  createArea("310", "GURI", "구리", "구리시"),
  createArea("360", "NAMYANGJU", "남양주", "남양주시"),
  createArea("370", "OSAN", "오산", "오산시"),
  createArea("390", "SIHEUNG", "시흥", "시흥시"),
  createArea("410", "GUNPO", "군포", "군포시"),
  createArea("430", "UIWANG", "의왕", "의왕시"),
  createArea("450", "HANAM", "하남", "하남시"),
  createArea("461", "YONGIN", "용인", "처인구"),
  createArea("463", "YONGIN", "용인", "기흥구"),
  createArea("465", "YONGIN", "용인", "수지구"),
  createArea("480", "PAJU", "파주", "파주시"),
  createArea("500", "ICHEON", "이천", "이천시"),
  createArea("550", "ANSEONG", "안성", "안성시"),
  createArea("570", "GIMPO", "김포", "김포시"),
  createArea("590", "HWASEONG", "화성", "화성시"),
  createArea("610", "GWANGJU", "광주", "광주시"),
  createArea("630", "YANGJU", "양주", "양주시"),
  createArea("650", "POCHEON", "포천", "포천시"),
  createArea("670", "YEOJU", "여주", "여주시"),
  createArea("800", "YEONCHEON", "연천", "연천군"),
  createArea("820", "GAPYEONG", "가평", "가평군"),
  createArea("830", "YANGPYEONG", "양평", "양평군"),
] as const;

export type GyeonggiCollectionArea = (typeof GYEONGGI_COLLECTION_AREAS)[number];
export type GyeonggiMunicipality = GyeonggiCollectionArea["municipality"];
export type GyeonggiDistrict = GyeonggiCollectionArea["district"];

const MUNICIPALITY_LABELS = new Map<GyeonggiMunicipality, string>(
  GYEONGGI_COLLECTION_AREAS.map(createMunicipalityLabelEntry),
);

export function findGyeonggiAddressArea(address: string) {
  const normalizedAddress = normalizeAddress(address);
  return GYEONGGI_COLLECTION_AREAS.find((area) => matchesArea(normalizedAddress, area));
}

export function readGyeonggiMunicipalityLabel(municipality: GyeonggiMunicipality) {
  return MUNICIPALITY_LABELS.get(municipality) ?? municipality;
}

export function readGyeonggiMunicipalityAddressName(municipality: GyeonggiMunicipality) {
  const area = GYEONGGI_COLLECTION_AREAS.find(
    (candidate) => candidate.municipality === municipality,
  );
  if (!area) return municipality;
  return readMunicipalityAddressName(area);
}

export function createGyeonggiMunicipalities() {
  return [...new Set(GYEONGGI_COLLECTION_AREAS.map(readMunicipality))];
}

function createArea<Code extends string, Municipality extends string, District extends string>(
  code: Code,
  municipality: Municipality,
  municipalityLabel: string,
  district: District,
) {
  return { code, district, municipality, municipalityLabel };
}

function createMunicipalityLabelEntry(area: GyeonggiCollectionArea) {
  return [area.municipality, area.municipalityLabel] as const;
}

function normalizeAddress(address: string) {
  return address.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function matchesArea(address: string, area: GyeonggiCollectionArea) {
  if (!address.includes(readMunicipalityAddressName(area))) return false;
  if (area.district.endsWith("시") || area.district.endsWith("군")) return true;
  return address.includes(area.district);
}

function readMunicipalityAddressName(area: GyeonggiCollectionArea) {
  if (area.district.endsWith("군")) return `${area.municipalityLabel}군`;
  return `${area.municipalityLabel}시`;
}

function readMunicipality(area: GyeonggiCollectionArea) {
  return area.municipality;
}
