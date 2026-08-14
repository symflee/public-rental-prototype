import { PublicRentalBookmarks } from "@/domain/public-rental";

const BOOKMARK_DOCUMENT_VERSION = 1;

type BookmarkDocument = Readonly<{
  locationIdentifiers: readonly string[];
  version: typeof BOOKMARK_DOCUMENT_VERSION;
}>;

export const PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY = "public-rental-bookmarks";

export type PublicRentalBookmarkStorage = Readonly<{
  read: () => PublicRentalBookmarks;
  write: (bookmarks: PublicRentalBookmarks) => boolean;
}>;

export function createPublicRentalBookmarkStorage(storage: Storage): PublicRentalBookmarkStorage {
  return {
    read: () => readBookmarks(storage),
    write: (bookmarks) => writeBookmarks(storage, bookmarks),
  };
}

export function createBrowserPublicRentalBookmarkStorage() {
  const storage = readBrowserStorage();
  if (!storage) return undefined;
  return createPublicRentalBookmarkStorage(storage);
}

function readBrowserStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readBookmarks(storage: Storage) {
  try {
    return parseBookmarks(storage.getItem(PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY));
  } catch {
    return new PublicRentalBookmarks();
  }
}

function parseBookmarks(stored: string | null) {
  if (!stored) return new PublicRentalBookmarks();
  const document: unknown = JSON.parse(stored);
  if (!isBookmarkDocument(document)) return new PublicRentalBookmarks();
  return new PublicRentalBookmarks(document.locationIdentifiers);
}

function isBookmarkDocument(value: unknown): value is BookmarkDocument {
  if (!isRecord(value)) return false;
  if (value.version !== BOOKMARK_DOCUMENT_VERSION) return false;
  return isStringArray(value.locationIdentifiers);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  return value.every(isString);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function writeBookmarks(storage: Storage, bookmarks: PublicRentalBookmarks) {
  try {
    storage.setItem(PUBLIC_RENTAL_BOOKMARK_STORAGE_KEY, createDocument(bookmarks));
    return true;
  } catch {
    return false;
  }
}

function createDocument(bookmarks: PublicRentalBookmarks) {
  return JSON.stringify({
    locationIdentifiers: bookmarks.values,
    version: BOOKMARK_DOCUMENT_VERSION,
  });
}
