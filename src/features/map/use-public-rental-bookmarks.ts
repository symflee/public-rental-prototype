"use client";

import { useEffect, useRef, useState } from "react";

import { PublicRentalBookmarks } from "@/domain/public-rental";
import {
  createBrowserPublicRentalBookmarkStorage,
  type PublicRentalBookmarkStorage,
} from "@/infrastructure/browser/public-rental-bookmark-storage";

export type BookmarkChangeHandler = (locationIdentifier: string, bookmarked: boolean) => void;

export function usePublicRentalBookmarks(
  onBookmarkChange?: BookmarkChangeHandler,
  suppliedStorage?: PublicRentalBookmarkStorage,
) {
  const storage = useRef(suppliedStorage);
  const state = useBookmarkState(storage);
  const toggleBookmark = useBookmarkToggle(state, storage, onBookmarkChange);
  return createBookmarkResult(state, toggleBookmark);
}

function useBookmarkState(storage: { current: PublicRentalBookmarkStorage | undefined }) {
  const [bookmarks, setBookmarks] = useState(() => new PublicRentalBookmarks());
  const [storageFailed, setStorageFailed] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  useEffect(() => restoreBookmarks(storage, setBookmarks, setStorageFailed), [storage]);
  return {
    bookmarks,
    limitReached,
    setBookmarks,
    setLimitReached,
    setStorageFailed,
    storageFailed,
  };
}

type BookmarkState = ReturnType<typeof useBookmarkState>;

function useBookmarkToggle(
  state: BookmarkState,
  storage: { current: PublicRentalBookmarkStorage | undefined },
  onBookmarkChange: BookmarkChangeHandler | undefined,
) {
  const { bookmarks, setBookmarks, setLimitReached, setStorageFailed } = state;
  return (locationIdentifier: string) => {
    const dependencies = {
      onBookmarkChange,
      setBookmarks,
      setLimitReached,
      setStorageFailed,
      storage: storage.current,
    };
    changeBookmarks(createBookmarkChange(locationIdentifier, bookmarks), dependencies);
  };
}

function createBookmarkResult(state: BookmarkState, toggleBookmark: (identifier: string) => void) {
  return {
    bookmarks: state.bookmarks,
    limitReached: state.limitReached,
    storageFailed: state.storageFailed,
    toggleBookmark,
  };
}

function restoreBookmarks(
  storageReference: { current: PublicRentalBookmarkStorage | undefined },
  setBookmarks: (bookmarks: PublicRentalBookmarks) => void,
  setStorageFailed: (failed: boolean) => void,
) {
  const storage = storageReference.current ?? createBrowserPublicRentalBookmarkStorage();
  storageReference.current = storage;
  if (!storage) return setStorageFailed(true);
  setStorageFailed(false);
  setBookmarks(storage.read());
}

type BookmarkChange = Readonly<{
  bookmarks: PublicRentalBookmarks;
  bookmarked: boolean;
  changed: boolean;
  locationIdentifier: string;
}>;

type BookmarkChangeDependencies = Readonly<{
  onBookmarkChange: BookmarkChangeHandler | undefined;
  setBookmarks: (bookmarks: PublicRentalBookmarks) => void;
  setLimitReached: (reached: boolean) => void;
  setStorageFailed: (failed: boolean) => void;
  storage: PublicRentalBookmarkStorage | undefined;
}>;

function createBookmarkChange(locationIdentifier: string, bookmarks: PublicRentalBookmarks) {
  const changed = bookmarks.toggle(locationIdentifier);
  const bookmarked = changed.includes(locationIdentifier);
  return {
    bookmarks: changed,
    bookmarked,
    changed: bookmarks.includes(locationIdentifier) !== bookmarked,
    locationIdentifier,
  };
}

function changeBookmarks(change: BookmarkChange, dependencies: BookmarkChangeDependencies) {
  if (!change.changed) return dependencies.setLimitReached(true);
  if (!writeBookmarks(dependencies.storage, change.bookmarks)) {
    dependencies.setLimitReached(false);
    return dependencies.setStorageFailed(true);
  }
  dependencies.setLimitReached(false);
  dependencies.setStorageFailed(false);
  dependencies.setBookmarks(change.bookmarks);
  dependencies.onBookmarkChange?.(change.locationIdentifier, change.bookmarked);
}

function writeBookmarks(
  storage: PublicRentalBookmarkStorage | undefined,
  bookmarks: PublicRentalBookmarks,
) {
  if (!storage) return;
  return storage.write(bookmarks);
}
