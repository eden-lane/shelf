import type { Database } from "../db";
import { createBookmark } from "./createBookmark";
import { createFolder } from "./createFolder";
import { createTag } from "./createTag";
import { deleteBookmark } from "./deleteBookmark";
import { deleteFolder } from "./deleteFolder";
import { deleteTag } from "./deleteTag";
import { getFavicon } from "./getFavicon";
import { listBookmarkLocations } from "./listBookmarkLocations";
import { listBookmarks } from "./listBookmarks";
import { listFolders } from "./listFolders";
import { listSavedItemSearchDocuments } from "./listSavedItemSearchDocuments";
import { listTags } from "./listTags";
import { moveFolder } from "./moveFolder";
import { moveBookmarks } from "./moveBookmarks";
import type { BookmarksStore } from "./types";
import { updateFolder } from "./updateFolder";
import { updateTag } from "./updateTag";

export const createDatabaseBookmarksStore = (db: Database): BookmarksStore => ({
  createBookmark: (input) => createBookmark(db, input),
  createFolder: (input) => createFolder(db, input),
  createTag: (input) => createTag(db, input),
  deleteBookmark: (input) => deleteBookmark(db, input),
  deleteFolder: (input) => deleteFolder(db, input),
  deleteTag: (input) => deleteTag(db, input),
  getFavicon: (id) => getFavicon(db, id),
  listBookmarkLocations: (input) => listBookmarkLocations(db, input),
  listBookmarks: (input) => listBookmarks(db, input),
  listFolders: (input) => listFolders(db, input),
  listSavedItemSearchDocuments: (input) => listSavedItemSearchDocuments(db, input),
  listTags: (input) => listTags(db, input),
  moveFolder: (input) => moveFolder(db, input),
  moveBookmarks: (input) => moveBookmarks(db, input),
  updateFolder: (input) => updateFolder(db, input),
  updateTag: (input) => updateTag(db, input)
});
