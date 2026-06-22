import type { Database } from "../db";
import { createSavedItem } from "./createSavedItem";
import { createFolder } from "./createFolder";
import { createTag } from "./createTag";
import { deleteSavedItem } from "./deleteSavedItem";
import { deleteFolder } from "./deleteFolder";
import { deleteTag } from "./deleteTag";
import { getFavicon } from "./getFavicon";
import { listSavedItemLocations } from "./listSavedItemLocations";
import { listSavedItems } from "./listSavedItems";
import { listFolders } from "./listFolders";
import { listSavedItemSearchDocuments } from "./listSavedItemSearchDocuments";
import { listTags } from "./listTags";
import { moveFolder } from "./moveFolder";
import { moveSavedItems } from "./moveSavedItems";
import { moveTag } from "./moveTag";
import type { SavedItemsStore } from "./types";
import { updateFolder } from "./updateFolder";
import { updateTag } from "./updateTag";

export const createDatabaseSavedItemsStore = (db: Database): SavedItemsStore => ({
  createSavedItem: (input) => createSavedItem(db, input),
  createFolder: (input) => createFolder(db, input),
  createTag: (input) => createTag(db, input),
  deleteSavedItem: (input) => deleteSavedItem(db, input),
  deleteFolder: (input) => deleteFolder(db, input),
  deleteTag: (input) => deleteTag(db, input),
  getFavicon: (id) => getFavicon(db, id),
  listSavedItemLocations: (input) => listSavedItemLocations(db, input),
  listSavedItems: (input) => listSavedItems(db, input),
  listFolders: (input) => listFolders(db, input),
  listSavedItemSearchDocuments: (input) => listSavedItemSearchDocuments(db, input),
  listTags: (input) => listTags(db, input),
  moveFolder: (input) => moveFolder(db, input),
  moveSavedItems: (input) => moveSavedItems(db, input),
  moveTag: (input) => moveTag(db, input),
  updateFolder: (input) => updateFolder(db, input),
  updateTag: (input) => updateTag(db, input)
});
