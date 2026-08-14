import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const { recordAnnouncementOpen, recordOpenAnnouncementViewed } = vi.hoisted(() => ({
  recordAnnouncementOpen: vi.fn(async () => undefined),
  recordOpenAnnouncementViewed: vi.fn(async () => undefined),
}));

vi.mock("@/infrastructure/analytics", () => ({
  isExperimentAnalyticsEnabled: () => true,
  recordAnalyticsQuietly: vi.fn(async (record: () => Promise<void>) => record()),
  recordAnnouncementOpen,
  recordOpenAnnouncementViewed,
  resolveExperimentVisitorIdentity: () => ({
    setCookieHeader:
      "public_rental_experiment_visitor=visitor; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
    visitorHash: "hashed-visitor",
  }),
}));

vi.mock("@/infrastructure/public-data/public-rental-snapshot", () => ({
  publicRentalSnapshot: {
    generatedAt: new Date().toISOString(),
    locations: [
      {
        id: "31191377",
        recruitmentNotices: [
          {
            announcedAt: null,
            id: "20913",
            title: "공식 공고",
            url: "https://apply.lh.or.kr/notices/20913",
          },
        ],
      },
    ],
  },
}));

test("공식 공고는 클릭 수를 증가시킨 뒤 307으로 이동한다", async () => {
  const response = await GET(createRequest("31191377"), createContext("20913"));

  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://apply.lh.or.kr/notices/20913");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(recordAnnouncementOpen).toHaveBeenCalledWith("20913");
  expect(recordOpenAnnouncementViewed).toHaveBeenCalledWith("31191377", "hashed-visitor");
});

afterEach(() => vi.clearAllMocks());

test("잘못된 공고는 기록하거나 외부 URL로 이동하지 않는다", async () => {
  const response = await GET(createRequest("31191377"), createContext("unknown"));

  expect(response.status).toBe(404);
  expect(recordAnnouncementOpen).not.toHaveBeenCalled();
  expect(recordOpenAnnouncementViewed).not.toHaveBeenCalled();
});

function createRequest(locationId: string) {
  return new Request(`http://localhost/out/20913?locationId=${locationId}`);
}

function createContext(announcementId: string) {
  return { params: Promise.resolve({ announcementId }) };
}
