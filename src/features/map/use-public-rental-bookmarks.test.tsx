import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { PublicRentalBookmarks } from "@/domain/public-rental";
import { MAXIMUM_PUBLIC_RENTAL_BOOKMARKS } from "@/domain/public-rental";
import type { PublicRentalBookmarkStorage } from "@/infrastructure/browser/public-rental-bookmark-storage";

import { usePublicRentalBookmarks } from "./use-public-rental-bookmarks";

test("저장소에서 북마크를 복원하고 변경 결과를 저장한다", () => {
  const storage = createStorage(["location-one"]);
  const { result } = renderHook(() => usePublicRentalBookmarks(undefined, storage));

  act(() => result.current.toggleBookmark("location-two"));

  expect(result.current.bookmarks.values).toEqual(["location-one", "location-two"]);
  expect(storage.write).toHaveBeenCalledWith(result.current.bookmarks);
});

test("북마크 추가와 해제 결과를 변경 콜백에 전달한다", () => {
  const onBookmarkChange = vi.fn();
  const { result } = renderHook(() =>
    usePublicRentalBookmarks(onBookmarkChange, createStorage([])),
  );

  act(() => result.current.toggleBookmark("location-one"));
  act(() => result.current.toggleBookmark("location-one"));

  expect(onBookmarkChange).toHaveBeenNthCalledWith(1, "location-one", true);
  expect(onBookmarkChange).toHaveBeenNthCalledWith(2, "location-one", false);
});

test("저장에 실패하면 기존 상태를 유지하고 변경 콜백을 호출하지 않는다", () => {
  const onBookmarkChange = vi.fn();
  const storage = createStorage(["location-one"], false);
  const { result } = renderHook(() => usePublicRentalBookmarks(onBookmarkChange, storage));

  act(() => result.current.toggleBookmark("location-two"));

  expect(result.current.bookmarks.values).toEqual(["location-one"]);
  expect(result.current.storageFailed).toBe(true);
  expect(onBookmarkChange).not.toHaveBeenCalled();
});

test("저장 한도에 도달하면 새 북마크를 추가하거나 콜백을 호출하지 않는다", () => {
  const identifiers = Array.from(
    { length: MAXIMUM_PUBLIC_RENTAL_BOOKMARKS },
    (_, index) => `location-${index}`,
  );
  const onBookmarkChange = vi.fn();
  const storage = createStorage(identifiers);
  const { result } = renderHook(() => usePublicRentalBookmarks(onBookmarkChange, storage));

  act(() => result.current.toggleBookmark("location-over-limit"));

  expect(result.current.limitReached).toBe(true);
  expect(storage.write).not.toHaveBeenCalled();
  expect(onBookmarkChange).not.toHaveBeenCalled();
});

function createStorage(
  identifiers: readonly string[],
  writeSucceeded = true,
): PublicRentalBookmarkStorage {
  return {
    read: vi.fn(() => new PublicRentalBookmarks(identifiers)),
    write: vi.fn(() => writeSucceeded),
  };
}
