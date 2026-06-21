import { Fragment } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { FolderItem } from "@bookmarks/shared";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconGripVertical
} from "@tabler/icons-react";
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
  activeFolderDragId,
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
  activeFolderDragId: string | null;
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
  const hasBookmarkCount = folder.bookmarkCount > 0;
  const indent = folderRowIndent(level);
  const { isOver, setNodeRef } = useDroppable({
    id: `folder:${folder.id}`,
    data: {
      folder,
      type: "folder"
    },
    disabled: isEditing
  });
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `folder-drag:${folder.id}`,
    data: {
      folderId: folder.id,
      libraryId: folder.libraryId,
      parentId: folder.parentId,
      type: "folder-drag"
    },
    disabled: isEditing
  });
  const dragStyle = transform && !isDragging
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined;
  const setRowRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setDraggableNodeRef(node);
  };

  return (
    <Fragment>
      <div
        ref={setRowRefs}
        className={[
          "folder-tree-row group relative flex min-h-9 items-center rounded-xl transition-[background-color,box-shadow,opacity]",
          hasBookmarkCount ? "pr-16" : "pr-8",
          isActive ? "bg-gray-100 text-slate-950" : "text-slate-950 hover:bg-white",
          isOver ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : "",
          isDragging ? "z-20 opacity-80 shadow-[0_12px_34px_rgb(15_23_42_/_0.14)]" : ""
        ].join(" ")}
        data-folder-drop-target={folder.id}
        style={{ marginLeft: `${indent}px`, ...dragStyle }}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenu(folder, event.clientX, event.clientY);
        }}
      >
        <FolderPositionDropZone
          activeFolderDragId={activeFolderDragId}
          folder={folder}
          position="before"
        />
        <FolderPositionDropZone
          activeFolderDragId={activeFolderDragId}
          folder={folder}
          position="after"
        />
        {!isEditing ? (
          <button
            className="folder-drag-handle absolute top-1/2 -left-5 z-10 grid h-7 w-5 -translate-y-1/2 cursor-grab place-items-center rounded-lg text-gray-400 opacity-0 outline-none transition-opacity hover:bg-gray-100 hover:text-slate-950 hover:opacity-100 active:cursor-grabbing active:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label={`Drag folder ${folder.name}`}
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={15} stroke={1.5} aria-hidden="true" focusable="false" />
          </button>
        ) : null}
        {isEditing ? (
          <div className="min-w-0 flex-1">
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
            <div className="flex min-h-9 min-w-0 flex-1 items-center gap-0.5">
              {hasChildren ? (
                <button
                  className="grid h-7 w-5 shrink-0 place-items-center rounded-lg text-gray-500 outline-none hover:bg-gray-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
                <span className="h-7 w-5 shrink-0" aria-hidden="true" />
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
                <span className="truncate" data-folder-title={folder.id}>
                  {folder.name}
                </span>
              </button>
            </div>
            {hasBookmarkCount ? (
              <span className="absolute top-0 right-8 grid h-9 w-7 place-items-center text-xs font-extrabold text-gray-400">
                {folder.bookmarkCount}
              </span>
            ) : null}
            <button
              className="absolute top-1/2 right-0 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg border border-transparent text-gray-500 outline-none hover:border-gray-200 hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
                activeFolderDragId={activeFolderDragId}
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

const FolderPositionDropZone = ({
  activeFolderDragId,
  folder,
  position
}: {
  activeFolderDragId: string | null;
  folder: FolderItem;
  position: "before" | "after";
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-position:${position}:${folder.id}`,
    data: {
      libraryId: folder.libraryId,
      parentId: folder.parentId,
      position,
      relativeFolderId: folder.id,
      type: "folder-position"
    },
    disabled: activeFolderDragId === null || activeFolderDragId === folder.id
  });

  return (
    <div
      className={[
        "pointer-events-none absolute right-2 left-2 z-10 h-1 rounded-full transition-colors duration-150",
        position === "before" ? "-top-0.5" : "-bottom-0.5",
        isOver ? "bg-blue-500" : "bg-transparent"
      ].join(" ")}
      ref={setNodeRef}
      aria-hidden="true"
    />
  );
};
