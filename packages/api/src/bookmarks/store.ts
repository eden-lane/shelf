import type { Database } from "../db";
import { createBookmark } from "./createBookmark";
import { createFolder } from "./createFolder";
import { deleteBookmark } from "./deleteBookmark";
import { deleteFolder } from "./deleteFolder";
import { getFavicon } from "./getFavicon";
import { listBookmarks } from "./listBookmarks";
import { listFolders } from "./listFolders";
import { listTags } from "./listTags";
import type { BookmarksStore } from "./types";
import { updateFolder } from "./updateFolder";

export const createDatabaseBookmarksStore = (db: Database): BookmarksStore => ({
  createBookmark: (input) => createBookmark(db, input),
  createFolder: (input) => createFolder(db, input),
  deleteBookmark: (input) => deleteBookmark(db, input),
  deleteFolder: (input) => deleteFolder(db, input),
  getFavicon: (id) => getFavicon(db, id),
  listBookmarks: (input) => listBookmarks(db, input),
  listFolders: (input) => listFolders(db, input),
  listTags: (input) => listTags(db, input),
  updateFolder: (input) => updateFolder(db, input)
});
