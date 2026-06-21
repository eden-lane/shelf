import { useEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { CurrentUserResponse, FolderItem, TagItem } from "@bookmarks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconBookmark,
  IconChevronDown,
  IconChevronRight,
  IconDatabase,
  IconDotsVertical,
  IconFolderPlus,
  IconLayoutSidebarLeftCollapse,
  IconPlus,
  IconSearch,
  IconTag,
  IconTagPlus
} from "@tabler/icons-react";
import { createFolder, createTag, updateFolder, updateTag } from "../../api";
import { usePersistedStringSet } from "../../hooks/usePersistedStringSet";
import {
  FOLDER_CONTEXT_MENU_SIZE,
  TAG_CONTEXT_MENU_SIZE,
  clampContextMenuPosition
} from "../../utils/contextMenu";
import { DeleteTagDialog } from "../tags/DeleteTagDialog";
import { InlineTagForm } from "../tags/InlineTagForm";
import { TagContextMenu } from "../tags/TagContextMenu";
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
  activeFolderDragId,
  activeTagId,
  currentUser,
  folders,
  isError,
  isLoading,
  isTagsError,
  isTagsLoading,
  tags,
  onAddBookmark,
  onHideSidebar,
  onSelectFolder,
  onSelectTag
}: {
  activeFolderId: string | null;
  activeFolderDragId: string | null;
  activeTagId: string | null;
  currentUser?: CurrentUserResponse;
  folders: FolderItem[];
  isError: boolean;
  isLoading: boolean;
  isTagsError: boolean;
  isTagsLoading: boolean;
  tags: TagItem[];
  onAddBookmark: (target: { folder: FolderItem | null; tag: TagItem | null }) => void;
  onHideSidebar: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tagId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [creatingTarget, setCreatingTarget] = useState<{
    libraryId: string;
    parentId: string | null;
  } | null>(null);
  const [creatingTagLibraryId, setCreatingTagLibraryId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [tagMenu, setTagMenu] = useState<{ tagId: string; x: number; y: number } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [tagToDelete, setTagToDelete] = useState<TagItem | null>(null);
  const [collapsedLibraryIds, toggleCollapsedLibrary, collapsedLibraries] = usePersistedStringSet(
    COLLAPSED_LIBRARIES_STORAGE_KEY
  );
  const [collapsedFolderIds, toggleCollapsedFolder, collapsedFolders] = usePersistedStringSet(
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
      collapsedLibraries.remove(folder.libraryId);
      if (folder.parentId) {
        collapsedFolders.remove(folder.parentId);
      }
      setCreatingTarget(null);
      onSelectFolder(folder.id);
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });
  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: (tag) => {
      queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) => [
        ...currentTags.filter((currentTag) => currentTag.id !== tag.id),
        tag
      ]);
      collapsedLibraries.remove(tag.libraryId);
      setCreatingTagLibraryId(null);
      onSelectTag(tag.id);
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
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
  const updateTagMutation = useMutation({
    mutationFn: updateTag,
    onSuccess: (tag) => {
      queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) =>
        currentTags.map((currentTag) => (currentTag.id === tag.id ? tag : currentTag))
      );
      setEditingTagId(null);
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    }
  });

  useEffect(() => {
    if (!menu && !tagMenu) {
      return;
    }

    const closeMenu = () => {
      setMenu(null);
      setTagMenu(null);
    };

    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [menu, tagMenu]);

  const openFolderMenu = (folder: FolderItem, x: number, y: number) => {
    setTagMenu(null);
    setMenu({
      folderId: folder.id,
      ...clampContextMenuPosition(x, y, FOLDER_CONTEXT_MENU_SIZE)
    });
  };

  const openTagMenu = (tag: TagItem, x: number, y: number) => {
    setMenu(null);
    setTagMenu({
      tagId: tag.id,
      ...clampContextMenuPosition(x, y, TAG_CONTEXT_MENU_SIZE)
    });
  };

  const startCreatingFolder = (libraryId: string, parentId: string | null) => {
    collapsedLibraries.remove(libraryId);
    if (parentId) {
      collapsedFolders.remove(parentId);
    }
    setCreatingTagLibraryId(null);
    setEditingFolderId(null);
    setEditingTagId(null);
    setCreatingTarget({ libraryId, parentId });
  };

  const startCreatingTag = (libraryId: string) => {
    collapsedLibraries.remove(libraryId);
    setCreatingTarget(null);
    setEditingFolderId(null);
    setEditingTagId(null);
    setCreatingTagLibraryId(libraryId);
  };

  const menuFolder = menu ? folders.find((folder) => folder.id === menu.folderId) ?? null : null;
  const menuTag = tagMenu ? tags.find((tag) => tag.id === tagMenu.tagId) ?? null : null;

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
          onClick={() => onAddBookmark({ folder: null, tag: null })}
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
            <section className="grid gap-2" key={library.id} aria-label={`${library.name} workspace`}>
              <div className="relative grid min-h-9 items-center gap-1">
                <button
                  className="flex min-h-9 min-w-0 items-center gap-2 rounded-xl py-0 pr-2.5 pl-2.5 text-left outline-none hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
                <div className="-ml-3 overflow-hidden pl-3">
                  <div
                    className={[
                      "relative grid gap-1 pt-1",
                      isLibraryCollapsed ? "pointer-events-none" : ""
                    ].join(" ")}
                  >
                    <section className="grid gap-1" aria-label={`${library.name} folders`}>
                      <div
                        className="grid min-h-8 grid-cols-[minmax(0,1fr)_2rem] items-center"
                        style={{ marginLeft: `${folderRowIndent(1)}px` }}
                      >
                        <span className="text-xs font-bold tracking-[0.04em] text-gray-400 uppercase">
                          Folders
                        </span>
                        <button
                          className="grid h-7 w-7 place-items-center justify-self-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          aria-label={`Create folder in ${library.name}`}
                          type="button"
                          onClick={() => startCreatingFolder(library.id, null)}
                        >
                          <IconFolderPlus
                            size={15}
                            stroke={1.5}
                            aria-hidden="true"
                            focusable="false"
                          />
                        </button>
                      </div>
                      <WorkspaceInboxRow
                        activeFolderId={activeFolderId}
                        activeTagId={activeTagId}
                        libraryId={library.id}
                        onSelectFolder={onSelectFolder}
                      />
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
                      <LibraryRootDropZone
                        isActive={activeFolderDragId !== null}
                        libraryId={library.id}
                      />
                      {roots.map((folder) => (
                        <FolderTreeRow
                          activeFolderId={activeFolderId}
                          activeFolderDragId={activeFolderDragId}
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
                        <p className="m-0 px-2.5 py-1 text-xs font-bold text-gray-400">
                          No folders
                        </p>
                      ) : null}
                    </section>
                    <TagSection
                      activeTagId={activeTagId}
                      creatingTagLibraryId={creatingTagLibraryId}
                      createError={createTagMutation.isError}
                      createPending={createTagMutation.isPending}
                      editError={updateTagMutation.isError}
                      editPending={updateTagMutation.isPending}
                      editingTagId={editingTagId}
                      isError={isTagsError}
                      isLoading={isTagsLoading}
                      libraryId={library.id}
                      libraryName={library.name}
                      tags={tags.filter((tag) => tag.libraryId === library.id)}
                      onCancelCreate={() => setCreatingTagLibraryId(null)}
                      onCancelEdit={() => setEditingTagId(null)}
                      onCreateTag={(tag) =>
                        createTagMutation.mutate({ libraryId: library.id, ...tag })
                      }
                      onEditTag={(tagId, tag) => updateTagMutation.mutate({ tagId, ...tag })}
                      onOpenMenu={openTagMenu}
                      onSelectTag={onSelectTag}
                      onStartCreate={() => startCreatingTag(library.id)}
                    />
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
            onAddBookmark({ folder: menuFolder, tag: null });
          }}
          onCreateFolder={() => {
            setMenu(null);
            setEditingFolderId(null);
            startCreatingFolder(menuFolder.libraryId, menuFolder.id);
          }}
          onDeleteFolder={() => {
            setMenu(null);
            setFolderToDelete(menuFolder);
          }}
          onEditFolder={() => {
            setMenu(null);
            setCreatingTarget(null);
            setEditingFolderId(menuFolder.id);
            setEditingTagId(null);
          }}
        />
      ) : null}
      {tagMenu && menuTag ? (
        <TagContextMenu
          tag={menuTag}
          x={tagMenu.x}
          y={tagMenu.y}
          onAddBookmark={() => {
            setTagMenu(null);
            onAddBookmark({ folder: null, tag: menuTag });
          }}
          onDeleteTag={() => {
            setTagMenu(null);
            setTagToDelete(menuTag);
          }}
          onEditTag={() => {
            setTagMenu(null);
            setCreatingTagLibraryId(null);
            setCreatingTarget(null);
            setEditingFolderId(null);
            setEditingTagId(menuTag.id);
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
      <DeleteTagDialog
        tag={tagToDelete}
        onClose={() => setTagToDelete(null)}
        onDeleted={(deletedTagId) => {
          if (activeTagId === deletedTagId) {
            onSelectFolder(null);
          }
        }}
      />
    </nav>
  );
};

const WorkspaceInboxRow = ({
  activeFolderId,
  activeTagId,
  libraryId,
  onSelectFolder
}: {
  activeFolderId: string | null;
  activeTagId: string | null;
  libraryId: string;
  onSelectFolder: (folderId: string | null) => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder:inbox:${libraryId}`,
    data: {
      folder: null,
      type: "folder"
    }
  });

  return (
    <button
      ref={setNodeRef}
      className={[
        "flex min-h-9 items-center gap-0.5 rounded-xl pr-8 text-left text-sm font-medium outline-none hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        activeFolderId === null && activeTagId === null
          ? "bg-gray-100 text-slate-950"
          : "text-gray-700",
        isOver ? "bg-blue-50 text-slate-950 ring-2 ring-blue-500 ring-inset" : ""
      ].join(" ")}
      data-workspace-inbox={libraryId}
      style={{ marginLeft: `${folderRowIndent(1)}px` }}
      type="button"
      onClick={() => onSelectFolder(null)}
    >
      <span className="h-7 w-5 shrink-0" aria-hidden="true" />
      <span className="flex min-h-9 min-w-0 flex-1 items-center gap-2 pr-2.5">
        <IconBookmark size={21} stroke={1.5} aria-hidden="true" focusable="false" />
        <span className="truncate" data-workspace-inbox-title={libraryId}>
          Inbox
        </span>
      </span>
    </button>
  );
};

const TagSection = ({
  activeTagId,
  creatingTagLibraryId,
  createError,
  createPending,
  editError,
  editPending,
  editingTagId,
  isError,
  isLoading,
  libraryId,
  libraryName,
  tags,
  onCancelCreate,
  onCancelEdit,
  onCreateTag,
  onEditTag,
  onOpenMenu,
  onSelectTag,
  onStartCreate
}: {
  activeTagId: string | null;
  creatingTagLibraryId: string | null;
  createError: boolean;
  createPending: boolean;
  editError: boolean;
  editPending: boolean;
  editingTagId: string | null;
  isError: boolean;
  isLoading: boolean;
  libraryId: string;
  libraryName: string;
  tags: TagItem[];
  onCancelCreate: () => void;
  onCancelEdit: () => void;
  onCreateTag: (tag: { name: string; color: string }) => void;
  onEditTag: (tagId: string, tag: { name: string; color: string }) => void;
  onOpenMenu: (tag: TagItem, x: number, y: number) => void;
  onSelectTag: (tagId: string) => void;
  onStartCreate: () => void;
}) => (
  <section className="grid gap-1 pt-3" aria-label={`${libraryName} tags`}>
    <div
      className="grid min-h-8 grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center"
      style={{ marginLeft: `${folderRowIndent(1)}px` }}
    >
      <span className="text-xs font-bold tracking-[0.04em] text-gray-400 uppercase">Tags</span>
      <button
        className="col-start-3 grid h-7 w-7 place-items-center justify-self-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        aria-label={`Create tag in ${libraryName}`}
        type="button"
        onClick={onStartCreate}
      >
        <IconTagPlus size={15} stroke={1.5} aria-hidden="true" focusable="false" />
      </button>
    </div>
    {isLoading ? (
      <p className="m-0 px-2.5 py-1 text-xs font-bold text-gray-400">Loading tags</p>
    ) : null}
    {isError ? (
      <p className="m-0 px-2.5 py-1 text-xs font-bold text-orange-700">
        Tags could not be loaded.
      </p>
    ) : null}
    {creatingTagLibraryId === libraryId ? (
      <div style={{ marginLeft: `${folderRowIndent(1)}px` }}>
        <InlineTagForm
          error={createError ? "Tag could not be created." : null}
          isPending={createPending}
          onCancel={onCancelCreate}
          onSubmit={onCreateTag}
        />
      </div>
    ) : null}
    {tags.map((tag) => (
      <div
        className={[
          "group grid min-h-9 grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center rounded-xl text-sm font-medium",
          activeTagId === tag.id ? "bg-gray-100 text-slate-950" : "text-gray-700 hover:bg-white"
        ].join(" ")}
        key={tag.id}
        style={{ marginLeft: `${folderRowIndent(1)}px` }}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenu(tag, event.clientX, event.clientY);
        }}
      >
        {editingTagId === tag.id ? (
          <div className="col-span-3 min-w-0">
            <InlineTagForm
              defaultColor={tag.color}
              defaultName={tag.name}
              error={editError ? "Tag could not be updated." : null}
              isPending={editPending}
              submitLabel="Save tag"
              onCancel={onCancelEdit}
              onSubmit={(value) => onEditTag(tag.id, value)}
            />
          </div>
        ) : (
          <>
            <button
              className="flex min-h-9 min-w-0 items-center gap-2 rounded-xl pr-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label={tag.name}
              type="button"
              onClick={() => onSelectTag(tag.id)}
            >
              <span className="h-7 w-5 shrink-0" aria-hidden="true" />
              <IconTag
                size={20}
                stroke={1.5}
                color={tag.color ?? "#697080"}
                aria-hidden="true"
                focusable="false"
              />
              <span className="truncate">{tag.name}</span>
            </button>
            <span
              className="grid h-9 place-items-center text-xs font-extrabold text-gray-400"
              aria-hidden="true"
            >
              {tag.bookmarkCount > 0 ? tag.bookmarkCount : null}
            </span>
            <button
              className="grid h-8 w-8 place-items-center justify-self-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label={`Tag actions for ${tag.name}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenMenu(tag, rect.left, rect.bottom + 4);
              }}
            >
              <IconDotsVertical size={16} stroke={1.5} aria-hidden="true" focusable="false" />
            </button>
          </>
        )}
      </div>
    ))}
    {!isLoading && tags.length === 0 ? (
      <p className="m-0 px-2.5 py-1 text-xs font-bold text-gray-400">No tags</p>
    ) : null}
  </section>
);

const LibraryRootDropZone = ({
  isActive,
  libraryId
}: {
  isActive: boolean;
  libraryId: string;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-root:${libraryId}`,
    data: {
      libraryId,
      type: "folder-root"
    }
  });

  return (
    <div
      className={[
        "pointer-events-none absolute top-1 right-2.5 left-2.5 z-10 h-2 rounded-lg border border-transparent transition-[opacity,background-color,box-shadow] duration-150",
        isActive ? "" : "opacity-0",
        isOver ? "border-blue-500 bg-blue-50 shadow-[inset_0_0_0_1px_#3b82f6]" : ""
      ].join(" ")}
      ref={setNodeRef}
      data-folder-root-drop-zone={libraryId}
      aria-hidden="true"
    />
  );
};
