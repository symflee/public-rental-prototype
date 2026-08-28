import { beforeEach, expect, test, vi } from "vitest";

import type { PublicRentalLocation, PublicRentalRecruitmentNotice } from "@/domain/public-rental";

import {
  RecruitmentAlertConflictError,
  RecruitmentAlertLocationNotFoundError,
  RecruitmentAlertValidationError,
  initializeRecruitmentAlertStorage,
  purgeRecruitmentAlertSubscriptions,
  subscribeRecruitmentAlert,
  type RecruitmentAlertServiceDependencies,
} from "./recruitment-alert-service";

const NOW = new Date("2026-08-28T00:00:00.000Z");
const append = vi.fn(async () => undefined);
const initialize = vi.fn(async () => undefined);
const purge = vi.fn(async () => undefined);
const readLocations = vi.fn(async (locations: readonly PublicRentalLocation[]) => locations);

beforeEach(() => {
  vi.clearAllMocks();
  readLocations.mockImplementation(async (locations) => locations);
});

test("검증된 비모집 단지의 이메일과 단지명 스냅샷을 저장한다", async () => {
  const dependencies = createDependencies([createLocation()]);

  await subscribeRecruitmentAlert(createInput({ email: " User@Example.com " }), NOW, dependencies);

  expect(append).toHaveBeenCalledWith({
    consentVersion: "recruitment-alert-v1",
    consentedAt: "2026-08-28T00:00:00.000Z",
    email: "User@Example.com",
    emailNormalized: "user@example.com",
    expiresAt: "2027-08-28T00:00:00.000Z",
    locationId: "31297390",
    locationNameSnapshot: "미사13단지",
  });
});

test("같은 단지와 이메일 재신청도 저장소의 멱등 삽입에 맡긴다", async () => {
  const dependencies = createDependencies([createLocation()]);

  await subscribeRecruitmentAlert(createInput(), NOW, dependencies);
  await subscribeRecruitmentAlert(createInput(), NOW, dependencies);

  expect(append).toHaveBeenCalledTimes(2);
});

test("이메일, 단지 식별자, 개인정보 동의를 검증한다", async () => {
  const dependencies = createDependencies([createLocation()]);

  await expectInvalid(createInput({ email: "invalid" }), dependencies);
  await expectInvalid(createInput({ locationId: " " }), dependencies);
  await expectInvalid(createInput({ privacyConsent: false }), dependencies);
  expect(append).not.toHaveBeenCalled();
});

test("숨김 필드가 채워진 봇 요청은 개인정보를 저장하지 않고 종료한다", async () => {
  const dependencies = createDependencies([createLocation()]);

  await subscribeRecruitmentAlert(createInput({ website: "bot" }), NOW, dependencies);

  expect(readLocations).not.toHaveBeenCalled();
  expect(append).not.toHaveBeenCalled();
});

test("현재 스냅샷에 없는 단지는 거절한다", async () => {
  const dependencies = createDependencies([createLocation()]);

  await expect(
    subscribeRecruitmentAlert(createInput({ locationId: "unknown" }), NOW, dependencies),
  ).rejects.toBeInstanceOf(RecruitmentAlertLocationNotFoundError);
});

test("현재 모집 중인 단지에는 다음 공고 알림을 신청하지 않는다", async () => {
  const notice = createNotice("2026-08-01", "2026-09-01");
  const dependencies = createDependencies([createLocation([notice])]);

  await expect(subscribeRecruitmentAlert(createInput(), NOW, dependencies)).rejects.toBeInstanceOf(
    RecruitmentAlertConflictError,
  );
  expect(append).not.toHaveBeenCalled();
});

test("기간을 알 수 없는 공고와 오래된 스냅샷도 이메일 알림 대상으로 받는다", async () => {
  const unknownNotice = {
    announcedAt: null,
    id: "unknown",
    title: "공고",
    url: "https://example.com",
  };
  const unknown = createDependencies([createLocation([unknownNotice])]);
  const stale = createDependencies([createLocation()], "2026-01-01T00:00:00.000Z");

  await subscribeRecruitmentAlert(createInput(), NOW, unknown);
  await subscribeRecruitmentAlert(createInput(), NOW, stale);

  expect(append).toHaveBeenCalledTimes(2);
});

test("검증되지 않은 부분 스냅샷의 공고 없음도 이메일 알림 대상으로 받는다", async () => {
  const dependencies = createDependencies([createLocation()], NOW.toISOString(), "partial");

  await subscribeRecruitmentAlert(createInput(), NOW, dependencies);

  expect(append).toHaveBeenCalledTimes(1);
});

test("기간을 검토한 종료 수기 공고는 오래된 스냅샷에서도 비모집 근거가 된다", async () => {
  const notice = createNotice("2026-07-01", "2026-07-31", "MANUAL_REVIEW");
  const dependencies = createDependencies([createLocation([notice])], "2026-01-01T00:00:00.000Z");

  await subscribeRecruitmentAlert(createInput(), NOW, dependencies);

  expect(append).toHaveBeenCalledTimes(1);
});

test("스키마 초기화와 개인정보 정리를 저장소에 위임한다", async () => {
  const dependencies = createDependencies([createLocation()]);

  await initializeRecruitmentAlertStorage(dependencies);
  await purgeRecruitmentAlertSubscriptions(NOW, dependencies);

  expect(initialize).toHaveBeenCalledTimes(1);
  expect(purge).toHaveBeenCalledWith("2026-08-28T00:00:00.000Z");
});

test("수기 공고 저장소 조회 실패 시 정적 스냅샷으로 대체하지 않는다", async () => {
  const base = createDependencies([createLocation()]);
  const dependencies = {
    ...base,
    readLocations: vi.fn(async () => Promise.reject(new Error("database secret"))),
  };

  await expect(subscribeRecruitmentAlert(createInput(), NOW, dependencies)).rejects.toThrow(
    "database secret",
  );
  expect(append).not.toHaveBeenCalled();
});

async function expectInvalid(input: object, dependencies: RecruitmentAlertServiceDependencies) {
  await expect(subscribeRecruitmentAlert(input, NOW, dependencies)).rejects.toBeInstanceOf(
    RecruitmentAlertValidationError,
  );
}

function createDependencies(
  locations: readonly PublicRentalLocation[],
  generatedAt = NOW.toISOString(),
  status: "partial" | "verified" = "verified",
): RecruitmentAlertServiceDependencies {
  return {
    readLocations,
    repository: { append, initialize, isEnabled: () => true, purge },
    snapshot: { generatedAt, locations, status },
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    email: "user@example.com",
    locationId: "31297390",
    privacyConsent: true,
    website: "",
    ...overrides,
  };
}

function createNotice(
  applicationStartsAt: string,
  applicationEndsAt: string,
  sourceKind?: "MANUAL_REVIEW",
): PublicRentalRecruitmentNotice {
  return {
    announcedAt: applicationStartsAt,
    applicationEndsAt,
    applicationStartsAt,
    id: "notice-one",
    sourceKind,
    title: "모집공고",
    url: "https://example.com/notice",
  };
}

function createLocation(
  recruitmentNotices: readonly PublicRentalRecruitmentNotice[] = [],
): PublicRentalLocation {
  return {
    addressAliases: [],
    completionDate: null,
    coordinate: null,
    district: "하남시",
    householdCount: null,
    id: "31297390",
    kind: "CONSTRUCTION_RENTAL_COMPLEX",
    legalCategories: ["PERMANENT_RENTAL"],
    municipality: "HANAM",
    name: "미사13단지",
    offerings: [],
    parcelNumber: null,
    properties: [],
    provider: "LH",
    recruitmentNotices,
    roadAddress: "경기도 하남시 미사대로 1",
    sourceRecords: [],
  };
}
