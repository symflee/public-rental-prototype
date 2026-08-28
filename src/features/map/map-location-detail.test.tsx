import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { createDandaeHappyHousingLocation } from "@/domain/public-rental";

import { MapLocationDetail } from "./map-location-detail";

test("모집 중인 단지에 공식 공고 상세 링크를 표시한다", () => {
  const notice = {
    announcedAt: "2026-07-29",
    applicationEndsAt: "2100-01-01",
    applicationStartsAt: "2026-01-01",
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
  expect(screen.getByText("현재 모집 중 공고")).toBeVisible();
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

  expect(screen.getByText("현재 모집공고 없음")).toBeVisible();
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
      {
        announcedAt: null,
        applicationEndsAt: "2100-01-01",
        applicationStartsAt: "2026-01-01",
        id: "notice-one",
        title: "모집공고",
        url: "https://example.com",
      },
    ],
  };

  render(<MapLocationDetail location={location} onBookmarkToggle={vi.fn()} />);

  expect(screen.getByText("현재 모집 중")).toBeVisible();
  expect(screen.queryByRole("button", { name: "이 주택 저장" })).not.toBeInTheDocument();
});

test("종료된 수기 연결 공고는 기간과 출처를 과거 이력으로 표시한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    recruitmentNotices: [
      {
        announcedAt: "2026-07-20",
        applicationEndsAt: "2026-08-14",
        applicationStartsAt: "2026-07-27",
        evidenceUrl: "https://apply.lh.or.kr/notice",
        id: "20853",
        sourceKind: "MANUAL_REVIEW" as const,
        title: "과거 모집공고",
        url: "https://apply.lh.or.kr/notice",
      },
    ],
  };

  render(<MapLocationDetail location={location} onBookmarkToggle={vi.fn()} />);

  expect(screen.getByText("지난 공고 · 수기 연결")).toBeVisible();
  expect(screen.getByText("지난 모집공고")).toBeVisible();
  expect(screen.getByText("모집기간 2026-07-27 ~ 2026-08-14")).toBeVisible();
  expect(screen.getByText("공식 LH 공고 · 수기 연결")).toBeVisible();
  expect(screen.getByRole("button", { name: "이 주택 저장" })).toBeVisible();
});

test("아직 시작하지 않은 수기 공고를 모집 예정으로 표시한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    recruitmentNotices: [
      {
        announcedAt: "2099-07-20",
        applicationEndsAt: "2099-08-14",
        applicationStartsAt: "2099-08-11",
        id: "future-notice",
        sourceKind: "MANUAL_REVIEW" as const,
        title: "예정 모집공고",
        url: "https://apply.lh.or.kr/notice",
      },
    ],
  };

  render(<MapLocationDetail location={location} />);

  expect(screen.getByText("모집 예정 · 수기 연결")).toBeVisible();
  expect(screen.getByRole("heading", { level: 3, name: "예정 모집공고" })).toBeVisible();
});

test("오래된 스냅샷의 공고 부재를 현재 공고 없음으로 단정하지 않는다", () => {
  render(
    <MapLocationDetail
      location={createDandaeHappyHousingLocation()}
      recruitmentAbsenceReliable={false}
    />,
  );

  expect(screen.getByText("모집 상태 확인 필요")).toBeVisible();
  expect(screen.queryByText("현재 모집공고 없음")).not.toBeInTheDocument();
});

test("DB에 저장된 모집 시각을 한국 시각으로 표시한다", () => {
  const location = {
    ...createDandaeHappyHousingLocation(),
    recruitmentNotices: [
      {
        announcedAt: "2026-07-20",
        applicationEndsAt: "2026-08-14T14:59:59.999Z",
        applicationStartsAt: "2026-07-26T15:00:00.000Z",
        id: "20853",
        sourceKind: "MANUAL_REVIEW" as const,
        title: "과거 모집공고",
        url: "https://apply.lh.or.kr/notice",
      },
    ],
  };

  render(<MapLocationDetail location={location} />);

  expect(screen.getByText(/모집기간 2026\. 7\. 27\./u)).toHaveTextContent(/2026\. 8\. 14\./u);
});
