import { render, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import { useLocationDetailAnalytics } from "./use-location-detail-analytics";

const mocks = vi.hoisted(() => ({
  recordLocationDetailView: vi.fn(async () => undefined),
  recordNoOpenNoticeLocationViewed: vi.fn(async () => undefined),
}));

vi.mock("./experiment-event-client", () => ({
  recordNoOpenNoticeLocationViewed: mocks.recordNoOpenNoticeLocationViewed,
}));

vi.mock("./location-detail-view-client", () => ({
  recordLocationDetailView: mocks.recordLocationDetailView,
}));

beforeEach(() => vi.clearAllMocks());

test("모든 상세와 비모집 상세의 기존 실험 이벤트를 함께 기록한다", async () => {
  const view = render(<AnalyticsProbe location={createLocation("location-one", false)} />);
  await waitFor(() => expect(mocks.recordLocationDetailView).toHaveBeenCalledOnce());
  view.rerender(<AnalyticsProbe location={createLocation("location-two", true)} />);
  await waitFor(() => expect(mocks.recordLocationDetailView).toHaveBeenCalledTimes(2));

  expect(mocks.recordNoOpenNoticeLocationViewed).toHaveBeenCalledOnce();
  expect(mocks.recordNoOpenNoticeLocationViewed).toHaveBeenCalledWith("location-one");
});

test("같은 상세의 단순 rerender는 다시 기록하지 않는다", async () => {
  const location = createLocation("location-one", false);
  const view = render(<AnalyticsProbe location={location} />);
  await waitFor(() => expect(mocks.recordLocationDetailView).toHaveBeenCalledOnce());
  view.rerender(<AnalyticsProbe location={location} />);

  expect(mocks.recordLocationDetailView).toHaveBeenCalledOnce();
});

test("다른 상세를 거쳐 돌아오면 같은 위치도 다시 기록한다", async () => {
  const view = render(<AnalyticsProbe location={createLocation("location-one", false)} />);
  view.rerender(<AnalyticsProbe location={createLocation("location-two", false)} />);
  view.rerender(<AnalyticsProbe location={createLocation("location-one", false)} />);

  await waitFor(() => expect(mocks.recordLocationDetailView).toHaveBeenCalledTimes(3));
});

test("상세를 닫았다가 다시 열면 다시 기록한다", async () => {
  const location = createLocation("location-one", false);
  const view = render(<AnalyticsProbe location={location} />);
  view.rerender(<AnalyticsProbe location={undefined} />);
  view.rerender(<AnalyticsProbe location={location} />);

  await waitFor(() => expect(mocks.recordLocationDetailView).toHaveBeenCalledTimes(2));
});

test("오래된 스냅샷의 공고 부재는 클라이언트에서도 계측 요청하지 않는다", async () => {
  render(<AnalyticsProbe location={createLocation("location-one", false)} reliable={false} />);

  await waitFor(() => expect(mocks.recordLocationDetailView).not.toHaveBeenCalled());
  expect(mocks.recordNoOpenNoticeLocationViewed).not.toHaveBeenCalled();
});

test("기간을 검토한 수기 공고가 있으면 오래된 스냅샷에서도 계측한다", async () => {
  const location = createLocation("location-one", false, [CLOSED_MANUAL_NOTICE]);
  render(<AnalyticsProbe location={location} reliable={false} />);

  await waitFor(() => expect(mocks.recordLocationDetailView).toHaveBeenCalledWith("location-one"));
  expect(mocks.recordNoOpenNoticeLocationViewed).toHaveBeenCalledWith("location-one");
});

function AnalyticsProbe({
  location,
  reliable = true,
}: Readonly<{ location: PublicRentalLocation | undefined; reliable?: boolean }>) {
  useLocationDetailAnalytics(location, reliable);
  return null;
}

function createLocation(
  locationId: string,
  hasOpenNotice: boolean,
  recruitmentNotices: PublicRentalLocation["recruitmentNotices"] = [],
): PublicRentalLocation {
  if (hasOpenNotice) return { ...BASE_LOCATION, id: locationId, recruitmentNotices: [NOTICE] };
  return { ...BASE_LOCATION, id: locationId, recruitmentNotices };
}

const NOTICE = {
  announcedAt: "2026-08-01",
  applicationEndsAt: "2100-01-01",
  applicationStartsAt: "2026-01-01",
  id: "notice-one",
  title: "모집공고",
  url: "https://www.myhome.go.kr/notice-one",
};

const CLOSED_MANUAL_NOTICE = {
  ...NOTICE,
  applicationEndsAt: "2026-08-14",
  sourceKind: "MANUAL_REVIEW" as const,
};

const BASE_LOCATION: PublicRentalLocation = {
  addressAliases: [],
  completionDate: null,
  coordinate: null,
  district: "권선구",
  householdCount: null,
  id: "location-one",
  kind: "CONSTRUCTION_RENTAL_COMPLEX",
  legalCategories: ["NATIONAL_RENTAL"],
  municipality: "SUWON",
  name: "테스트 단지",
  offerings: [],
  parcelNumber: null,
  properties: [],
  provider: "LH",
  roadAddress: "경기도 수원시 권선구 테스트로 1",
  sourceRecords: [],
};
