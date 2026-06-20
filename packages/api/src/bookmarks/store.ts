import type { Database } from "../db";
import { createBookmark } from "./createBookmark";
import { createFolder } from "./createFolder";
import { deleteFolder } from "./deleteFolder";
import { listBookmarks } from "./listBookmarks";
import { listFolders } from "./listFolders";
import type { BookmarksStore } from "./types";
import { updateFolder } from "./updateFolder";

export const createDatabaseBookmarksStore = (db: Database): BookmarksStore => ({
  createBookmark: (input) => createBookmark(db, input),
  createFolder: (input) => createFolder(db, input),
  deleteFolder: (input) => deleteFolder(db, input),
  listBookmarks: (input) => listBookmarks(db, input),
  listFolders: (input) => listFolders(db, input),
  updateFolder: (input) => updateFolder(db, input)
});
