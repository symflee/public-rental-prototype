import { expect, test } from "vitest";

import { MAXIMUM_PUBLIC_RENTAL_BOOKMARKS, PublicRentalBookmarks } from "./public-rental-bookmarks";

test("북마크 식별자를 중복 없이 보관한다", () => {
  const bookmarks = new PublicRentalBookmarks(["location-one", "location-one", "location-two"]);

  expect(bookmarks.values).toEqual(["location-one", "location-two"]);
  expect(bookmarks.includes("location-one")).toBe(true);
});

test("북마크를 추가하고 해제해도 기존 컬렉션은 바뀌지 않는다", () => {
  const bookmarks = new PublicRentalBookmarks(["location-one"]);
  const added = bookmarks.toggle("location-two");
  const removed = added.toggle("location-one");

  expect(bookmarks.values).toEqual(["location-one"]);
  expect(added.values).toEqual(["location-one", "location-two"]);
  expect(removed.values).toEqual(["location-two"]);
});

test("비어 있거나 공백뿐인 식별자는 보관하지 않는다", () => {
  const bookmarks = new PublicRentalBookmarks(["", "  ", " location-one "]);

  expect(bookmarks.values).toEqual(["location-one"]);
});

test("지도 요청에 안전한 최대 개수까지만 보관한다", () => {
  const identifiers = Array.from(
    { length: MAXIMUM_PUBLIC_RENTAL_BOOKMARKS + 1 },
    (_, index) => `location-${index}`,
  );

  expect(new PublicRentalBookmarks(identifiers).values).toHaveLength(
    MAXIMUM_PUBLIC_RENTAL_BOOKMARKS,
  );
});

test("지도 요청을 깨뜨리는 식별자는 보관하지 않는다", () => {
  const tooLong = "a".repeat(201);
  const bookmarks = new PublicRentalBookmarks(["location,one", tooLong, "location-two"]);

  expect(bookmarks.values).toEqual(["location-two"]);
});
