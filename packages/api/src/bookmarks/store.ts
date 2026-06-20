import type { Database } from "../db";
import { createBookmark } from "./createBookmark";
import { listBookmarks } from "./listBookmarks";
import type { BookmarksStore } from "./types";

export const createDatabaseBookmarksStore = (db: Database): BookmarksStore => ({
  createBookmark: (input) => createBookmark(db, input),
  listBookmarks: (input) => listBookmarks(db, input)
});
