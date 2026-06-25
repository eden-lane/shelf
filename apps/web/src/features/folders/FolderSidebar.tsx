import { useEffect, useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CurrentUserResponse, FolderItem, SavedItem, TagItem } from "@shelf/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconLink,
  IconChevronDown,
  IconChevronRight,
  IconDatabase,
  IconDotsVertical,
  IconFolderPlus,
  IconGripVertical,
  IconInbox,
  IconLayoutSidebarLeftCollapse,
  IconLogout2,
  IconPlus,
  IconPlugConnected,
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
import { buildFolderTree } from "./folderTree";
import { folderRowIndent } from "./folderIcons";
import type { FolderFormValue } from "./types";

const COLLAPSED_LIBRARIES_STORAGE_KEY = "savedItems.collapsedLibraries";
const COLLAPSED_FOLDERS_STORAGE_KEY = "savedItems.collapsedFolders";

export const FolderSidebar = ({
  activeFolderId,
  activeFolderDragId,
  activeSavedItemDragItem,
  activeTagDragId,
  activeTagId,
  currentUser,
  folders,
  isError,
  isLoading,
  isTagsError,
  isTagsLoading,
  searchQuery,
  tags,
  isSigningOut,
  onAddSavedItem,
  onHideSidebar,
  onOpenConnectedApps,
  onSignOut,
  onSearchQueryChange,
  onSelectFolder,
  onSelectTag
}: {
  activeFolderId: string | null;
  activeFolderDragId: string | null;
  activeSavedItemDragItem: SavedItem | null;
  activeTagDragId: string | null;
  activeTagId: string | null;
  currentUser?: CurrentUserResponse;
  folders: FolderItem[];
  isError: boolean;
  isLoading: boolean;
  isTagsError: boolean;
  isTagsLoading: boolean;
  searchQuery: string;
  tags: TagItem[];
  isSigningOut: boolean;
  onAddSavedItem: (target: { folder: FolderItem | null; tag: TagItem | null }) => void;
  onHideSidebar: () => void;
  onOpenConnectedApps: () => void;
  onSignOut: () => void;
  onSearchQueryChange: (query: string) => void;
  onSelectFolder: (folderId: string | null, libraryId?: string | null) => void;
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
      void queryClient.invalidateQueries({ queryKey: ["savedItems"] });
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
      void queryClient.invalidateQueries({ queryKey: ["savedItems"] });
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
        <label className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-500 shadow-[0_8px_22px_rgb(15_23_42_/_0.04)] outline-none focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-100">
          <IconSearch size={18} stroke={1.5} aria-hidden="true" focusable="false" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-950 outline-none placeholder:text-gray-500"
            aria-label="Search saved items"
            autoComplete="off"
            data-1p-ignore="true"
            data-op-ignore="true"
            placeholder="Search saved links"
            type="search"
            value={searchQuery}
            onInput={(event) => onSearchQueryChange(event.currentTarget.value)}
          />
        </label>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500 text-white shadow-sm outline-none hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Add saved item"
          title="Add saved item"
          type="button"
          onClick={() => onAddSavedItem({ folder: null, tag: null })}
        >
          <IconPlus size={20} stroke={1.7} aria-hidden="true" focusable="false" />
        </button>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-slate-950 shadow-[0_8px_22px_rgb(15_23_42_/_0.04)] outline-none hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Hide sidebar"
          title="Hide sidebar"
          type="button"
          onClick={onHideSidebar}
        >
          <IconLayoutSidebarLeftCollapse
            size={19}
            stroke={1.5}
            aria-hidden="true"
            focusable="false"
          />
        </button>
      </div>
      <div className="grid gap-3">
        {isLoading ? (
          <p className="m-0 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-500">
            Loading folders
          </p>
        ) : null}
        {isError ? (
          <p className="m-0 rounded-xl border border-orange-200 bg-white px-2.5 py-2 text-sm font-medium text-orange-700">
            Folders could not be loaded.
          </p>
        ) : null}
        {currentUser?.libraries.map((library) => {
          const roots = folderTree.filter((folder) => folder.libraryId === library.id);
          const isLibraryCollapsed = collapsedLibraryIds.has(library.id);

          return (
            <section className="grid gap-2" key={library.id} aria-label={`${library.name} workspace`}>
              <div className="relative grid min-h-7 items-center gap-1">
                <button
                  className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-xl py-0 pr-2 pl-2 text-left outline-none hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  aria-expanded={!isLibraryCollapsed}
                  aria-label={`${isLibraryCollapsed ? "Expand" : "Collapse"} workspace ${library.name}`}
                  type="button"
                  onClick={() => toggleCollapsedLibrary(library.id)}
                >
                  {isLibraryCollapsed ? (
                    <IconChevronRight
                      className="shrink-0 text-gray-500"
                      size={14}
                      stroke={1.5}
                      aria-hidden="true"
                      focusable="false"
                    />
                  ) : (
                    <IconChevronDown
                      className="shrink-0 text-gray-500"
                      size={14}
                      stroke={1.5}
                      aria-hidden="true"
                      focusable="false"
                    />
                  )}
                  <IconDatabase
                    className="shrink-0 text-gray-500"
                    size={17}
                    stroke={1.5}
                    aria-hidden="true"
                    focusable="false"
                  />
                  <span className="truncate text-[13px] font-medium text-slate-950">
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
                      "relative grid gap-1 pt-0.5",
                      isLibraryCollapsed ? "pointer-events-none" : ""
                    ].join(" ")}
                  >
                    <section className="grid gap-1" aria-label={`${library.name} folders`}>
                      <div
                        className="grid min-h-7 grid-cols-[minmax(0,1fr)_1.75rem] items-center"
                        style={{ marginLeft: `${folderRowIndent(1)}px` }}
                      >
                        <span className="text-xs font-medium tracking-[0.04em] text-gray-400 uppercase">
                          Folders
                        </span>
                        <button
                          className="grid h-7 w-7 place-items-center justify-self-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          aria-label={`Create folder in ${library.name}`}
                          type="button"
                          onClick={() => startCreatingFolder(library.id, null)}
                        >
                          <IconFolderPlus
                            size={14}
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
                          isFiltering={false}
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
                    </section>
                    <TagSection
                      activeTagId={activeTagId}
                      activeSavedItemDragItem={activeSavedItemDragItem}
                      activeTagDragId={activeTagDragId}
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
      <div className="mt-auto border-t border-gray-200/70 pt-4">
        <button
          className="mb-1 inline-flex min-h-8 items-center gap-2 rounded-lg bg-transparent px-2 text-[13px] font-medium text-gray-600 outline-none hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Connected apps"
          type="button"
          onClick={onOpenConnectedApps}
        >
          <IconPlugConnected size={17} stroke={1.5} aria-hidden="true" focusable="false" />
          <span>Connected apps</span>
        </button>
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-transparent px-2 text-[13px] font-medium text-gray-600 outline-none hover:text-slate-950 disabled:cursor-not-allowed disabled:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Sign out"
          disabled={isSigningOut}
          type="button"
          onClick={onSignOut}
        >
          <IconLogout2 size={17} stroke={1.5} aria-hidden="true" focusable="false" />
          <span>Sign out</span>
        </button>
      </div>
      {menu && menuFolder ? (
        <FolderContextMenu
          folder={menuFolder}
          x={menu.x}
          y={menu.y}
          onAddSavedItem={() => {
            setMenu(null);
            onAddSavedItem({ folder: menuFolder, tag: null });
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
          onAddSavedItem={() => {
            setTagMenu(null);
            onAddSavedItem({ folder: null, tag: menuTag });
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
  onSelectFolder: (folderId: string | null, libraryId?: string | null) => void;
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
        "flex min-h-8 items-center gap-0.5 rounded-xl pr-7 text-left text-[13px] font-medium outline-none hover:bg-white/70 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        activeFolderId === null && activeTagId === null
          ? "bg-gray-100/90 text-slate-950"
          : "text-gray-700",
        isOver ? "bg-blue-50 text-slate-950 ring-2 ring-blue-500 ring-inset" : ""
      ].join(" ")}
      data-workspace-inbox={libraryId}
      style={{ marginLeft: `${folderRowIndent(1)}px` }}
      type="button"
      onClick={() => onSelectFolder(null, libraryId)}
    >
      <span className="h-6 w-4 shrink-0" aria-hidden="true" />
      <span className="flex min-h-8 min-w-0 flex-1 items-center gap-2 pr-2">
        <IconInbox size={17} stroke={1.5} aria-hidden="true" focusable="false" />
        <span className="truncate" data-workspace-inbox-title={libraryId}>
          Inbox
        </span>
      </span>
    </button>
  );
};

const TagSection = ({
  activeTagId,
  activeSavedItemDragItem,
  activeTagDragId,
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
  activeSavedItemDragItem: SavedItem | null;
  activeTagDragId: string | null;
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
}) => {
  const rowIndent = folderRowIndent(1);
  const rowStyle = { marginLeft: `${rowIndent}px`, width: `calc(100% - ${rowIndent}px)` };

  return (
    <section className="grid min-w-0 gap-1 pt-3" aria-label={`${libraryName} tags`}>
      <div
        className="grid min-h-7 grid-cols-[minmax(0,1fr)_1.5rem_1.75rem] items-center"
        style={rowStyle}
      >
        <span className="text-xs font-medium tracking-[0.04em] text-gray-400 uppercase">
          Tags
        </span>
        <button
          className="col-start-3 grid h-7 w-7 place-items-center justify-self-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label={`Create tag in ${libraryName}`}
          type="button"
          onClick={onStartCreate}
        >
          <IconTagPlus size={14} stroke={1.5} aria-hidden="true" focusable="false" />
        </button>
      </div>
      {isLoading ? (
        <p className="m-0 px-2.5 py-1 text-xs font-medium text-gray-400">Loading tags</p>
      ) : null}
      {isError ? (
        <p className="m-0 px-2.5 py-1 text-xs font-medium text-orange-700">
          Tags could not be loaded.
        </p>
      ) : null}
      {creatingTagLibraryId === libraryId ? (
        <div className="min-w-0" style={rowStyle}>
          <InlineTagForm
            error={createError ? "Tag could not be created." : null}
            isPending={createPending}
            onCancel={onCancelCreate}
            onSubmit={onCreateTag}
          />
        </div>
      ) : null}
      {tags.map((tag) => (
        <TagRow
          activeSavedItemDragItem={activeSavedItemDragItem}
          activeTagDragId={activeTagDragId}
          activeTagId={activeTagId}
          editError={editError}
          editPending={editPending}
          editingTagId={editingTagId}
          key={tag.id}
          rowStyle={rowStyle}
          tag={tag}
          onCancelEdit={onCancelEdit}
          onEditTag={onEditTag}
          onOpenMenu={onOpenMenu}
          onSelectTag={onSelectTag}
        />
      ))}
    </section>
  );
};

const TagRow = ({
  activeSavedItemDragItem,
  activeTagDragId,
  activeTagId,
  editError,
  editPending,
  editingTagId,
  rowStyle,
  tag,
  onCancelEdit,
  onEditTag,
  onOpenMenu,
  onSelectTag
}: {
  activeSavedItemDragItem: SavedItem | null;
  activeTagDragId: string | null;
  activeTagId: string | null;
  editError: boolean;
  editPending: boolean;
  editingTagId: string | null;
  rowStyle: { marginLeft: string; width: string };
  tag: TagItem;
  onCancelEdit: () => void;
  onEditTag: (tagId: string, tag: { name: string; color: string }) => void;
  onOpenMenu: (tag: TagItem, x: number, y: number) => void;
  onSelectTag: (tagId: string) => void;
}) => {
  const isEditing = editingTagId === tag.id;
  const isActive = activeTagId === tag.id;
  const canAcceptSavedItem =
    activeSavedItemDragItem !== null &&
    activeSavedItemDragItem.libraryId === tag.libraryId &&
    !(activeSavedItemDragItem.tags ?? []).some((itemTag) => itemTag.id === tag.id);
  const { isOver: isSavedItemOver, setNodeRef: setSavedItemDropNodeRef } = useDroppable({
    id: `tag:${tag.id}`,
    data: {
      tag,
      type: "tag"
    },
    disabled: isEditing || !canAcceptSavedItem
  });
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `tag-drag:${tag.id}`,
    data: {
      libraryId: tag.libraryId,
      tagId: tag.id,
      type: "tag-drag"
    },
    disabled: isEditing
  });
  const dragStyle =
    transform && !isDragging
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
        }
      : undefined;
  const setRowRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setSavedItemDropNodeRef(node);
  };

  return (
    <div
      className={[
        "group relative grid min-h-8 grid-cols-[minmax(0,1fr)_1.5rem_1.75rem] items-center rounded-xl text-[13px] font-medium transition-[background-color,box-shadow,opacity]",
        isActive ? "bg-gray-100/90 text-slate-950" : "text-gray-700 hover:bg-white/70",
        canAcceptSavedItem ? "ring-1 ring-transparent" : "",
        isSavedItemOver ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : "",
        isDragging ? "z-20 opacity-80 shadow-[0_12px_34px_rgb(15_23_42_/_0.14)]" : ""
      ].join(" ")}
      key={tag.id}
      ref={setRowRefs}
      data-tag-drop-target={tag.id}
      style={{ ...rowStyle, ...dragStyle }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(tag, event.clientX, event.clientY);
      }}
    >
      <TagPositionDropZone activeTagDragId={activeTagDragId} position="before" tag={tag} />
      <TagPositionDropZone activeTagDragId={activeTagDragId} position="after" tag={tag} />
      {isEditing ? (
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
            className="tag-drag-handle absolute top-1/2 -left-4 z-10 grid h-6 w-4 -translate-y-1/2 cursor-grab place-items-center rounded-md text-gray-400 opacity-0 outline-none transition-opacity hover:bg-gray-100 hover:text-slate-950 hover:opacity-100 active:cursor-grabbing active:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label={`Drag tag ${tag.name}`}
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={13} stroke={1.5} aria-hidden="true" focusable="false" />
          </button>
          <button
            className="flex min-h-8 min-w-0 items-center gap-0.5 rounded-xl pr-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label={tag.name}
            type="button"
            onClick={() => onSelectTag(tag.id)}
          >
            <span className="h-6 w-4 shrink-0" aria-hidden="true" />
            <span className="flex min-h-8 min-w-0 flex-1 items-center gap-2">
              <IconTag
                size={16}
                stroke={1.5}
                color={tag.color ?? "#697080"}
                aria-hidden="true"
                focusable="false"
              />
              <span className="truncate">{tag.name}</span>
            </span>
          </button>
          <span
            className="grid h-8 place-items-center text-[11px] font-medium text-gray-400"
            aria-hidden="true"
          >
            {tag.savedItemCount > 0 ? tag.savedItemCount : null}
          </span>
          <button
            className="grid h-7 w-7 place-items-center justify-self-center rounded-lg border border-transparent text-gray-500 opacity-0 outline-none transition-opacity hover:border-gray-200 hover:bg-white hover:text-slate-950 hover:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label={`Tag actions for ${tag.name}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenMenu(tag, rect.left, rect.bottom + 4);
            }}
          >
            <IconDotsVertical size={14} stroke={1.5} aria-hidden="true" focusable="false" />
          </button>
        </>
      )}
    </div>
  );
};

const TagPositionDropZone = ({
  activeTagDragId,
  position,
  tag
}: {
  activeTagDragId: string | null;
  position: "before" | "after";
  tag: TagItem;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `tag-position:${position}:${tag.id}`,
    data: {
      libraryId: tag.libraryId,
      position,
      relativeTagId: tag.id,
      type: "tag-position"
    },
    disabled: activeTagDragId === null || activeTagDragId === tag.id
  });

  return (
    <div
      className={[
        "pointer-events-none absolute right-2 left-2 z-10 h-[35%]",
        position === "before" ? "top-0" : "bottom-0"
      ].join(" ")}
      ref={setNodeRef}
      aria-hidden="true"
    >
      <span
        className={[
          "absolute right-0 left-0 h-1 rounded-full transition-colors duration-150",
          position === "before" ? "-top-0.5" : "-bottom-0.5",
          isOver ? "bg-blue-500" : "bg-transparent"
        ].join(" ")}
      />
    </div>
  );
};

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
