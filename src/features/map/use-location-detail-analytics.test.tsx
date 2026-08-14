import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { PublicRentalLocation } from "@/domain/public-rental";

import { useLocationDetailAnalytics } from "./use-location-detail-analytics";

afterEach(() => vi.unstubAllGlobals());

test("현재 연결된 모집공고가 없는 상세만 기록한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ recorded: true }));
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(<AnalyticsProbe location={createLocation(false)} />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  rerender(<AnalyticsProbe location={createLocation(true)} />);

  expect(fetchMock).toHaveBeenCalledOnce();
});

function AnalyticsProbe({ location }: Readonly<{ location: PublicRentalLocation }>) {
  useLocationDetailAnalytics(location);
  return null;
}

function createLocation(hasOpenNotice: boolean): PublicRentalLocation {
  if (hasOpenNotice) return { ...BASE_LOCATION, recruitmentNotices: [RECRUITMENT_NOTICE] };
  return { ...BASE_LOCATION, recruitmentNotices: [] };
}

const RECRUITMENT_NOTICE = {
  announcedAt: "2026-08-01",
  id: "notice-one",
  title: "모집공고",
  url: "https://www.myhome.go.kr/notice-one",
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
