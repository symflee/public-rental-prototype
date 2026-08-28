import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createPublicRentalMapResult: vi.fn(() => ({ clusters: [], locations: [], mode: "locations" })),
  isManualRecruitmentStorageEnabled: vi.fn(() => true),
  readLocationsWithManualRecruitmentNoticesStrict: vi.fn(),
  readPublicRentalMapRequest: vi.fn(() => ({})),
}));

vi.mock("@/domain/public-rental", () => ({
  createPublicRentalMapResult: mocks.createPublicRentalMapResult,
}));

vi.mock("@/infrastructure/manual-recruitment", () => ({
  isManualRecruitmentStorageEnabled: mocks.isManualRecruitmentStorageEnabled,
  readLocationsWithManualRecruitmentNoticesStrict:
    mocks.readLocationsWithManualRecruitmentNoticesStrict,
}));

vi.mock("@/infrastructure/public-data/public-rental-map-request", () => ({
  readPublicRentalMapRequest: mocks.readPublicRentalMapRequest,
}));

vi.mock("@/infrastructure/public-data/public-rental-snapshot", () => ({
  publicRentalSnapshot: {
    generatedAt: "2026-08-14T00:00:00.000Z",
    locations: [{ id: "location-one" }],
    status: "verified",
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isManualRecruitmentStorageEnabled.mockReturnValue(true);
  mocks.readLocationsWithManualRecruitmentNoticesStrict.mockResolvedValue([{ id: "location-one" }]);
});

test("수기 공고 저장소 장애를 공고 없음 지도 응답으로 숨기지 않는다", async () => {
  mocks.readLocationsWithManualRecruitmentNoticesStrict.mockRejectedValue(new Error("database"));

  const response = await GET(createRequest());

  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.createPublicRentalMapResult).not.toHaveBeenCalled();
});

test("수기 공고 저장소를 사용하지 않는 환경은 정적 스냅샷을 제공한다", async () => {
  mocks.isManualRecruitmentStorageEnabled.mockReturnValue(false);

  const response = await GET(createRequest());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.createPublicRentalMapResult).toHaveBeenCalledWith([{ id: "location-one" }], {});
});

function createRequest() {
  return new Request("http://localhost/api/public-rentals?zoom=15");
}
