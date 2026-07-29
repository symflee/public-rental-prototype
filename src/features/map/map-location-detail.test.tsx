import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { createDandaeHappyHousingLocation } from "@/domain/public-rental";

import { MapLocationDetail } from "./map-location-detail";

test("모집 중인 단지에 공식 공고 상세 링크를 표시한다", () => {
  const notice = {
    announcedAt: "2026-07-29",
    id: "19001",
    title: "단대동 행복주택 입주자 모집공고",
    url: "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId=19001",
  };
  const location = {
    ...createDandaeHappyHousingLocation(),
    recruitmentNotices: [notice],
  };

  render(<MapLocationDetail location={location} />);

  const link = screen.getByRole("link", { name: "단대동 행복주택 입주자 모집공고" });
  expect(link).toHaveAttribute("href", notice.url);
  expect(screen.getByText("모집 중 공고")).toBeVisible();
});
