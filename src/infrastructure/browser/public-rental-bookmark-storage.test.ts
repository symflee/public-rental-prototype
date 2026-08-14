import { expect, test } from "vitest";

import { PublicRentalBookmarks } from "@/domain/public-rental";

import {
  createPublicRentalBookmarkStorage,
  PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY,
} from "./public-rental-bookmark-storage";

test("북마크를 버전이 포함된 문서로 저장하고 다시 읽는다", () => {
  const browserStorage = createMemoryStorage();
  const storage = createPublicRentalBookmarkStorage(browserStorage);

  storage.write(new PublicRentalBookmarks(["location-one", "location-two"]));

  expect(storage.read().values).toEqual(["location-one", "location-two"]);
  expect(readStoredDocument(browserStorage)).toEqual({
    locationIdentifiers: ["location-one", "location-two"],
    version: 1,
  });
});

test("손상되거나 지원하지 않는 버전의 문서는 빈 북마크로 복구한다", () => {
  const browserStorage = createMemoryStorage();
  const storage = createPublicRentalBookmarkStorage(browserStorage);
  browserStorage.setItem(PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY, "not-json");
  expect(storage.read().values).toEqual([]);

  browserStorage.setItem(
    PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY,
    JSON.stringify({ locationIdentifiers: ["location-one"], version: 2 }),
  );
  expect(storage.read().values).toEqual([]);
});

function readStoredDocument(storage: Storage) {
  const stored = storage.getItem(PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY);
  if (!stored) throw new Error("저장된 북마크 문서가 없습니다.");
  return JSON.parse(stored) as unknown;
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
