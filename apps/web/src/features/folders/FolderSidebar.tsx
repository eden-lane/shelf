import { useEffect, useMemo, useState } from "react";
import type { CurrentUserResponse, FolderItem } from "@bookmarks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconBookmark,
  IconChevronDown,
  IconChevronRight,
  IconDatabase,
  IconFolderPlus,
  IconLayoutSidebarLeftCollapse,
  IconPlus,
  IconSearch
} from "@tabler/icons-react";
import { createFolder, updateFolder } from "../../api";
import { usePersistedStringSet } from "../../hooks/usePersistedStringSet";
import { FOLDER_CONTEXT_MENU_SIZE, clampContextMenuPosition } from "../../utils/contextMenu";
import { DeleteFolderDialog } from "./DeleteFolderDialog";
import { FolderContextMenu } from "./FolderContextMenu";
import { FolderDisclosurePlaceholder } from "./FolderDisclosureControls";
import { InlineFolderForm } from "./InlineFolderForm";
import { FolderTreeRow } from "./FolderTreeRow";
import { buildFolderTree, filterFolderTree } from "./folderTree";
import { folderRowIndent } from "./folderIcons";
import type { FolderFormValue } from "./types";

const COLLAPSED_LIBRARIES_STORAGE_KEY = "bookmarks.collapsedLibraries";
const COLLAPSED_FOLDERS_STORAGE_KEY = "bookmarks.collapsedFolders";

export const FolderSidebar = ({
  activeFolderId,
  currentUser,
  folders,
  isError,
  isLoading,
  onAddBookmark,
  onHideSidebar,
  onSelectFolder
}: {
  activeFolderId: string | null;
  currentUser?: CurrentUserResponse;
  folders: FolderItem[];
  isError: boolean;
  isLoading: boolean;
  onAddBookmark: (folder: FolderItem | null) => void;
  onHideSidebar: () => void;
  onSelectFolder: (folderId: string | null) => void;
}) => {
  const queryClient = useQueryClient();
  const [creatingTarget, setCreatingTarget] = useState<{
    libraryId: string;
    parentId: string | null;
  } | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [collapsedLibraryIds, toggleCollapsedLibrary] = usePersistedStringSet(
    COLLAPSED_LIBRARIES_STORAGE_KEY
  );
  const [collapsedFolderIds, toggleCollapsedFolder] = usePersistedStringSet(
    COLLAPSED_FOLDERS_STORAGE_KEY
  );
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const [folderSearch, setFolderSearch] = useState("");
  const isFilteringFolders = folderSearch.trim().length > 0;
  const visibleFolderTree = useMemo(
    () => filterFolderTree(folderTree, folderSearch),
    [folderSearch, folderTree]
  );

  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: (folder) => {
      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) => [
        ...currentFolders.filter((currentFolder) => currentFolder.id !== folder.id),
        folder
      ]);
      setCreatingTarget(null);
      onSelectFolder(folder.id);
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });
  const updateFolderMutation = useMutation({
    mutationFn: updateFolder,
    onSuccess: (folder) => {
      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) =>
        currentFolders.map((currentFolder) =>
          currentFolder.id === folder.id ? folder : currentFolder
        )
      );
      setEditingFolderId(null);
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = () => setMenu(null);

    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [menu]);

  const openFolderMenu = (folder: FolderItem, x: number, y: number) => {
    setMenu({
      folderId: folder.id,
      ...clampContextMenuPosition(x, y, FOLDER_CONTEXT_MENU_SIZE)
    });
  };

  const menuFolder = menu ? folders.find((folder) => folder.id === menu.folderId) ?? null : null;

  return (
    <nav className="flex min-h-full flex-col gap-4" aria-label="Folders">
      <div className="flex items-center gap-2">
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-2.5 text-gray-500 outline-none focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-100">
          <IconSearch size={22} stroke={1.5} aria-hidden="true" focusable="false" />
          <input
            className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-gray-500"
            aria-label="Search folders"
            placeholder="Type to search..."
            type="search"
            value={folderSearch}
            onChange={(event) => setFolderSearch(event.target.value)}
          />
        </label>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-white shadow-sm outline-none hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Add bookmark"
          title="Add bookmark"
          type="button"
          onClick={() => onAddBookmark(null)}
        >
          <IconPlus size={25} stroke={1.5} aria-hidden="true" focusable="false" />
        </button>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-slate-950 outline-none hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Hide sidebar"
          title="Hide sidebar"
          type="button"
          onClick={onHideSidebar}
        >
          <IconLayoutSidebarLeftCollapse
            size={23}
            stroke={1.5}
            aria-hidden="true"
            focusable="false"
          />
        </button>
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between px-2.5">
          <span className="text-sm font-medium text-gray-500">My organization</span>
          {currentUser?.libraries[0] ? (
            <button
              className="grid h-8 w-8 place-items-center rounded-xl border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label="Create folder"
              type="button"
              onClick={() =>
                setCreatingTarget({
                  libraryId: currentUser.libraries[0].id,
                  parentId: null
                })
              }
            >
              <IconFolderPlus size={16} stroke={1.5} aria-hidden="true" focusable="false" />
            </button>
          ) : null}
        </div>
        <button
          className={[
            "flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-left text-sm font-medium outline-none hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
            activeFolderId === null ? "bg-gray-100 text-slate-950" : "text-gray-700"
          ].join(" ")}
          type="button"
          onClick={() => onSelectFolder(null)}
        >
          <IconBookmark size={21} stroke={1.5} aria-hidden="true" focusable="false" />
          <span>Items</span>
        </button>
        {isLoading ? (
          <p className="m-0 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-bold text-gray-500">
            Loading folders
          </p>
        ) : null}
        {isError ? (
          <p className="m-0 rounded-xl border border-orange-200 bg-white px-2.5 py-2 text-sm font-bold text-orange-700">
            Folders could not be loaded.
          </p>
        ) : null}
        {currentUser?.libraries.map((library) => {
          const roots = visibleFolderTree.filter((folder) => folder.libraryId === library.id);
          const isLibraryCollapsed = collapsedLibraryIds.has(library.id) && !isFilteringFolders;

          return (
            <section className="grid gap-1" key={library.id} aria-label={`${library.name} folders`}>
              <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center gap-1">
                <button
                  className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-2.5 text-left outline-none hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  aria-expanded={!isLibraryCollapsed}
                  aria-label={`${isLibraryCollapsed ? "Expand" : "Collapse"} workspace ${library.name}`}
                  type="button"
                  onClick={() => toggleCollapsedLibrary(library.id)}
                >
                  {isLibraryCollapsed ? (
                    <IconChevronRight
                      className="shrink-0 text-gray-500"
                      size={16}
                      stroke={1.5}
                      aria-hidden="true"
                      focusable="false"
                    />
                  ) : (
                    <IconChevronDown
                      className="shrink-0 text-gray-500"
                      size={16}
                      stroke={1.5}
                      aria-hidden="true"
                      focusable="false"
                    />
                  )}
                  <IconDatabase
                    className="shrink-0 text-gray-500"
                    size={21}
                    stroke={1.5}
                    aria-hidden="true"
                    focusable="false"
                  />
                  <span className="truncate text-sm font-medium text-slate-950">
                    {library.name}
                  </span>
                </button>
                <span aria-hidden="true" />
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  aria-label={`Create folder in ${library.name}`}
                  type="button"
                  onClick={() => setCreatingTarget({ libraryId: library.id, parentId: null })}
                >
                  <IconPlus size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                </button>
              </div>
              <div
                className={[
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                  isLibraryCollapsed
                    ? "grid-rows-[0fr] opacity-0"
                    : "grid-rows-[1fr] opacity-100"
                ].join(" ")}
                aria-hidden={isLibraryCollapsed}
              >
                <div className="overflow-hidden">
                  <div
                    className={[
                      "grid gap-1 pt-1",
                      isLibraryCollapsed ? "pointer-events-none" : ""
                    ].join(" ")}
                  >
                    {creatingTarget?.libraryId === library.id &&
                    creatingTarget.parentId === null ? (
                      <div style={{ marginLeft: `${folderRowIndent(1)}px` }}>
                        <InlineFolderForm
                          error={
                            createFolderMutation.isError ? "Folder could not be created." : null
                          }
                          isPending={createFolderMutation.isPending}
                          leadingSlot={<FolderDisclosurePlaceholder />}
                          submitLabel="Create"
                          onCancel={() => setCreatingTarget(null)}
                          onSubmit={(folder) =>
                            createFolderMutation.mutate({
                              libraryId: library.id,
                              ...folder,
                              parentId: null
                            })
                          }
                        />
                      </div>
                    ) : null}
                    {roots.map((folder) => (
                      <FolderTreeRow
                        activeFolderId={activeFolderId}
                        collapsedFolderIds={collapsedFolderIds}
                        creatingTarget={creatingTarget}
                        editingFolderId={editingFolderId}
                        folder={folder}
                        key={folder.id}
                        level={1}
                        createError={
                          createFolderMutation.isError ? "Folder could not be created." : null
                        }
                        createPending={createFolderMutation.isPending}
                        editError={
                          updateFolderMutation.isError ? "Folder could not be updated." : null
                        }
                        editPending={updateFolderMutation.isPending}
                        isFiltering={isFilteringFolders}
                        onCancelCreate={() => setCreatingTarget(null)}
                        onCancelEdit={() => setEditingFolderId(null)}
                        onCreateFolder={(libraryId, parentId, folder) =>
                          createFolderMutation.mutate({ libraryId, parentId, ...folder })
                        }
                        onEditFolder={(folderId, folder) =>
                          updateFolderMutation.mutate({ folderId, ...folder })
                        }
                        onOpenMenu={openFolderMenu}
                        onSelectFolder={onSelectFolder}
                        onToggleFolder={toggleCollapsedFolder}
                      />
                    ))}
                    {roots.length === 0 ? (
                      <p className="m-0 px-2.5 py-1 text-xs font-bold text-gray-400">No folders</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {menu && menuFolder ? (
        <FolderContextMenu
          folder={menuFolder}
          x={menu.x}
          y={menu.y}
          onAddBookmark={() => {
            setMenu(null);
            onAddBookmark(menuFolder);
          }}
          onCreateFolder={() => {
            setMenu(null);
            setEditingFolderId(null);
            setCreatingTarget({ libraryId: menuFolder.libraryId, parentId: menuFolder.id });
          }}
          onDeleteFolder={() => {
            setMenu(null);
            setFolderToDelete(menuFolder);
          }}
          onEditFolder={() => {
            setMenu(null);
            setCreatingTarget(null);
            setEditingFolderId(menuFolder.id);
          }}
        />
      ) : null}
      <DeleteFolderDialog
        folder={folderToDelete}
        folders={folders}
        onClose={() => setFolderToDelete(null)}
        onDeleted={(deletedFolderIds) => {
          if (activeFolderId && deletedFolderIds.includes(activeFolderId)) {
            onSelectFolder(null);
          }
        }}
      />
    </nav>
  );
};
