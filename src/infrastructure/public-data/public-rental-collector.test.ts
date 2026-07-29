import { expect, test, vi } from "vitest";

import type { MyHomeRawRecord, PublicRentalLocation } from "@/domain/public-rental";

import {
  collectPublicRentalArtifacts,
  type PublicRentalCollectionServices,
} from "./public-rental-collector";

const CONFIGURATION = {
  generatedAt: "2026-07-28T00:00:00.000Z",
  kakaoRestApiKey: "kakao-rest-key",
  publicDataPortalServiceKey: "public-data-key",
} as const;

const DEFAULT_MY_HOME_RECORD = {
  bassMtRntchrg: "200000",
  bassRentGtn: "10000000",
  competDe: "2020-01-01",
  hsmpNm: "판교 국민임대",
  hsmpSn: "lh-1",
  hshldCo: "100",
  insttNm: "LH경기남부지역본부",
  rnAdres: "경기도 성남시 분당구 판교로 1",
  styleNm: "36형",
  suplyPrvuseAr: "36",
  suplyTyNm: "국민임대",
} satisfies MyHomeRawRecord;

test("LH 위치를 정규화하고 단대동 시드와 함께 검증된 산출물을 만든다", async () => {
  const services = createServices([
    createMyHomeRecord(),
    createMyHomeRecord({ styleNm: "46형", suplyPrvuseAr: "46" }),
    createMyHomeRecord({ hsmpSn: "gh", insttNm: "경기주택도시공사" }),
  ]);

  const artifacts = await collectPublicRentalArtifacts(CONFIGURATION, services);

  expect(artifacts.snapshot.locations).toHaveLength(2);
  expect(readLhLocation(artifacts).offerings).toHaveLength(2);
  expect(readLhLocation(artifacts).coordinate?.source).toBe("KAKAO_ADDRESS_SEARCH");
  expect(artifacts.snapshot.locations.every(hasCompletePublicationSources)).toBe(true);
  expect(artifacts.report.counts.excludedRecords).toBe(1);
  expect(artifacts.report.counts.groupedOfferingRows).toBe(1);
  expect(artifacts.report.status).toBe("verified");
});

test("보강 원천의 충돌은 공개 위치를 덮어쓰지 않고 검수 대상으로 보낸다", async () => {
  const services = createServices([createMyHomeRecord()], "999");

  const artifacts = await collectPublicRentalArtifacts(CONFIGURATION, services);

  expect(readLhLocation(artifacts).householdCount).toBe(100);
  expect(artifacts.report.status).toBe("review-required");
  expect(artifacts.report.reviewIssues[0]?.code).toBe("HOUSEHOLD_COUNT_CONFLICT");
});

test("같은 마이홈 ID의 주소 충돌은 첫 위치를 유지하고 검수 대상으로 보낸다", async () => {
  const conflict = createMyHomeRecord({ rnAdres: "경기도 성남시 분당구 다른로 2" });
  const services = createServices([createMyHomeRecord(), conflict]);

  const artifacts = await collectPublicRentalArtifacts(CONFIGURATION, services);

  expect(readLhLocation(artifacts).roadAddress).toBe("경기도 성남시 분당구 판교로 1");
  expect(artifacts.report.status).toBe("review-required");
  expect(artifacts.report.collectionIssues[0]?.code).toBe("address-conflict");
});

test("마이홈의 어느 구라도 수집에 실패하면 스냅샷 생성을 중단한다", async () => {
  const services = createServices([createMyHomeRecord()]);
  services.collectMyHomeRecords = vi.fn(createFailedMyHomeCollection);

  await expect(collectPublicRentalArtifacts(CONFIGURATION, services)).rejects.toThrow(
    "마이홈 API 수집 문제",
  );
});

function createServices(
  records: readonly MyHomeRawRecord[],
  verificationHouseholdCount = "100",
): PublicRentalCollectionServices {
  return {
    collectLhLeaseRecords: createLhLeaseCollector(verificationHouseholdCount),
    collectMyHomeRecords: vi.fn(async () => ({ collectionIssues: [], records })),
    geocodeAddress: createGeocoder(),
  };
}

function createMyHomeRecord(overrides: Partial<MyHomeRawRecord> = {}): MyHomeRawRecord {
  return { ...DEFAULT_MY_HOME_RECORD, ...overrides };
}

function createLhLeaseCollector(householdCount: string) {
  return vi.fn(async () => ({
    collectionIssues: [],
    records: [createLhLeaseRecord(householdCount)],
  }));
}

function createGeocoder() {
  return vi.fn(async () => ({
    coordinate: { latitude: 37.4, longitude: 127.1 },
    success: true as const,
  }));
}

async function createFailedMyHomeCollection() {
  return {
    collectionIssues: [
      {
        areaCode: "133",
        kind: "http-error" as const,
        message: "수집 실패",
        pageNumber: 1,
      },
    ],
    records: [],
  };
}

function createLhLeaseRecord(householdCount: string) {
  return {
    ARA_NM: "경기도 성남시 분당구",
    SBD_LGO_NM: "판교 국민임대",
    SUM_HSH_CNT: householdCount,
    reviewOnly: true as const,
    source: "lh-lease-api" as const,
  };
}

function readLhLocation(artifacts: Awaited<ReturnType<typeof collectPublicRentalArtifacts>>) {
  const location = artifacts.snapshot.locations.find((candidate) => candidate.provider === "LH");
  if (!location) throw new Error("LH 위치가 없습니다.");
  return location;
}

function hasCompletePublicationSources(location: PublicRentalLocation) {
  return location.sourceRecords.every(
    (source) => Boolean(source.sourceUrl) && Boolean(source.referenceDate),
  );
}
