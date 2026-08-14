import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

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
  expect(link).toHaveAttribute(
    "href",
    `/out/${notice.id}?locationId=${encodeURIComponent(location.id)}`,
  );
  expect(screen.getByText("수집 시 모집 중 공고")).toBeVisible();
});

test("공고가 없는 단지에는 확인 의향 버튼을 표시한다", () => {
  render(<MapLocationDetail location={createDandaeHappyHousingLocation()} />);

  expect(screen.getByRole("button", { name: "공고 확인해보기" })).toBeVisible();
});

test("공고가 없는 주택을 저장하고 해제할 수 있다", () => {
  const location = createDandaeHappyHousingLocation();
  const onBookmarkToggle = vi.fn();
  const view = render(
    <MapLocationDetail
      bookmarked={false}
      location={location}
      onBookmarkToggle={onBookmarkToggle}
    />,
  );

  expect(screen.getByText("수집 시 모집공고 없음")).toBeVisible();
  expect(
    screen.getByText("이 브라우저에만 저장되며 모집 알림은 아직 제공하지 않습니다."),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "이 주택 저장" }));
  expect(onBookmarkToggle).toHaveBeenCalledWith(location.id);
  view.rerender(
    <MapLocationDetail bookmarked location={location} onBookmarkToggle={onBookmarkToggle} />,
  );
  expect(screen.getByRole("button", { name: "저장 해제" })).toBeVisible();
});

test("모집 중인 주택은 모집 상태를 명확히 표시한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    recruitmentNotices: [
      { announcedAt: null, id: "notice-one", title: "모집공고", url: "https://example.com" },
    ],
  };

  render(<MapLocationDetail location={location} onBookmarkToggle={vi.fn()} />);

  expect(screen.getByText("수집 시 모집 중")).toBeVisible();
  expect(screen.queryByRole("button", { name: "이 주택 저장" })).not.toBeInTheDocument();
});
