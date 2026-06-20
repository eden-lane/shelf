import { Fragment } from "react";
import type { FolderItem } from "@bookmarks/shared";
import { IconChevronDown, IconChevronRight, IconDotsVertical } from "@tabler/icons-react";
import {
  DEFAULT_FOLDER_ICON_COLOR,
  folderRowIndent,
  getFolderIconComponent
} from "./folderIcons";
import { FolderDisclosureControl, FolderDisclosurePlaceholder } from "./FolderDisclosureControls";
import { InlineFolderForm } from "./InlineFolderForm";
import type { FolderFormValue, FolderNode } from "./types";

export const FolderTreeRow = ({
  activeFolderId,
  collapsedFolderIds,
  creatingTarget,
  editingFolderId,
  folder,
  level,
  createError,
  createPending,
  editError,
  editPending,
  isFiltering,
  onCancelCreate,
  onCancelEdit,
  onCreateFolder,
  onEditFolder,
  onOpenMenu,
  onSelectFolder,
  onToggleFolder
}: {
  activeFolderId: string | null;
  collapsedFolderIds: ReadonlySet<string>;
  creatingTarget: { libraryId: string; parentId: string | null } | null;
  editingFolderId: string | null;
  folder: FolderNode;
  level: number;
  createError: string | null;
  createPending: boolean;
  editError: string | null;
  editPending: boolean;
  isFiltering: boolean;
  onCancelCreate: () => void;
  onCancelEdit: () => void;
  onCreateFolder: (libraryId: string, parentId: string, value: FolderFormValue) => void;
  onEditFolder: (folderId: string, value: FolderFormValue) => void;
  onOpenMenu: (folder: FolderItem, x: number, y: number) => void;
  onSelectFolder: (folderId: string) => void;
  onToggleFolder: (id: string) => void;
}) => {
  const isEditing = editingFolderId === folder.id;
  const isCreatingChild = creatingTarget?.parentId === folder.id;
  const hasChildren = folder.children.length > 0;
  const isActive = activeFolderId === folder.id;
  const isCollapsed = hasChildren && collapsedFolderIds.has(folder.id) && !isFiltering;
  const FolderIcon = getFolderIconComponent(folder.iconName);
  const folderIconColor = folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR;
  const indent = folderRowIndent(level);

  return (
    <Fragment>
      <div
        className={[
          "grid grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center gap-1 rounded-xl transition-colors",
          isActive ? "bg-gray-100 text-slate-950" : "text-slate-950 hover:bg-white"
        ].join(" ")}
        style={{ marginLeft: `${indent}px` }}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenu(folder, event.clientX, event.clientY);
        }}
      >
        {isEditing ? (
          <div className="col-span-3 min-w-0">
            <InlineFolderForm
              defaultValue={folder.name}
              defaultIconColor={folder.iconColor}
              defaultIconName={folder.iconName}
              error={editError}
              isPending={editPending}
              leadingSlot={
                <FolderDisclosureControl
                  folderName={folder.name}
                  isCollapsed={isCollapsed}
                  hasChildren={hasChildren}
                  onToggle={() => onToggleFolder(folder.id)}
                />
              }
              submitLabel="Save"
              onCancel={onCancelEdit}
              onSubmit={(value) => onEditFolder(folder.id, value)}
            />
          </div>
        ) : (
          <>
            <div className="flex min-h-9 min-w-0 items-center gap-1">
              {hasChildren ? (
                <button
                  className="grid h-7 w-6 shrink-0 place-items-center rounded-lg text-gray-500 outline-none hover:bg-gray-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} folder ${folder.name}`}
                  type="button"
                  onClick={() => onToggleFolder(folder.id)}
                >
                  {isCollapsed ? (
                    <IconChevronRight
                      size={16}
                      stroke={1.5}
                      aria-hidden="true"
                      focusable="false"
                    />
                  ) : (
                    <IconChevronDown size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  )}
                </button>
              ) : (
                <span className="h-7 w-6 shrink-0" aria-hidden="true" />
              )}
              <button
                className="flex min-h-9 min-w-0 flex-1 items-center gap-2 pr-2.5 text-left text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                type="button"
                onClick={() => onSelectFolder(folder.id)}
              >
                <FolderIcon
                  size={21}
                  stroke={1.5}
                  color={folderIconColor}
                  aria-hidden="true"
                  focusable="false"
                />
                <span className="truncate">{folder.name}</span>
              </button>
            </div>
            <span className="grid h-9 place-items-center text-xs font-extrabold text-gray-400">
              {folder.bookmarkCount > 0 ? folder.bookmarkCount : null}
            </span>
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label={`Folder actions for ${folder.name}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenMenu(folder, rect.left, rect.bottom + 4);
              }}
            >
              <IconDotsVertical size={16} stroke={1.5} aria-hidden="true" focusable="false" />
            </button>
          </>
        )}
      </div>
      <div
        className={[
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        ].join(" ")}
        aria-hidden={isCollapsed}
      >
        <div className="overflow-hidden">
          <div className={isCollapsed ? "pointer-events-none" : ""}>
            {isCreatingChild ? (
              <div style={{ marginLeft: `${folderRowIndent(level + 1)}px` }}>
                <InlineFolderForm
                  error={createError}
                  isPending={createPending}
                  leadingSlot={<FolderDisclosurePlaceholder />}
                  submitLabel="Create"
                  onCancel={onCancelCreate}
                  onSubmit={(value) => onCreateFolder(folder.libraryId, folder.id, value)}
                />
              </div>
            ) : null}
            {folder.children.map((child) => (
              <FolderTreeRow
                activeFolderId={activeFolderId}
                collapsedFolderIds={collapsedFolderIds}
                creatingTarget={creatingTarget}
                editingFolderId={editingFolderId}
                folder={child}
                key={child.id}
                level={level + 1}
                createError={createError}
                createPending={createPending}
                editError={editError}
                editPending={editPending}
                isFiltering={isFiltering}
                onCancelCreate={onCancelCreate}
                onCancelEdit={onCancelEdit}
                onCreateFolder={onCreateFolder}
                onEditFolder={onEditFolder}
                onOpenMenu={onOpenMenu}
                onSelectFolder={onSelectFolder}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        </div>
      </div>
    </Fragment>
  );
};
