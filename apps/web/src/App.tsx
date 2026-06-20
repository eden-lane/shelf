import {
  type CSSProperties,
  Fragment,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import type {
  BookmarkItem,
  BookmarksPageResponse,
  CurrentUserResponse,
  FolderItem
} from "@bookmarks/shared";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import * as TablerIcons from "@tabler/icons-react";
import {
  IconAlertTriangle,
  IconArchive,
  IconBookmark,
  IconBook,
  IconBriefcase,
  IconBulb,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCode,
  IconCoffee,
  IconCopy,
  IconDatabase,
  IconDeviceGamepad2,
  IconDotsVertical,
  IconExternalLink,
  IconFileText,
  IconFolder,
  IconFolderPlus,
  IconHeart,
  IconHome,
  IconInbox,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLink,
  IconMap,
  IconMovie,
  IconMusic,
  IconPalette,
  IconPencil,
  IconPhoto,
  IconPlane,
  IconPlus,
  IconRefresh,
  IconSchool,
  IconSearch,
  IconShoppingCart,
  IconStar,
  IconTag,
  IconTrash,
  IconWorld,
  IconX
} from "@tabler/icons-react";
import {
  createBookmark,
  createFolder,
  deleteFolder,
  apiAssetUrl,
  deleteBookmark,
  getBookmarks,
  getCurrentUser,
  getFolders,
  updateFolder
} from "./api";

export const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ProductShell />
    </QueryClientProvider>
  );
};

type FolderNode = FolderItem & {
  children: FolderNode[];
};

type FolderFormValue = {
  name: string;
  iconName: string | null;
  iconColor: string | null;
};

const CONTEXT_MENU_MARGIN = 8;
const FOLDER_CONTEXT_MENU_SIZE = { height: 172, width: 190 };
const BOOKMARK_CONTEXT_MENU_SIZE = { height: 128, width: 160 };
const COLLAPSED_LIBRARIES_STORAGE_KEY = "bookmarks.collapsedLibraries";
const COLLAPSED_FOLDERS_STORAGE_KEY = "bookmarks.collapsedFolders";
const DEFAULT_FOLDER_ICON_NAME = "IconFolder";
const DEFAULT_FOLDER_ICON_COLOR = "#697080";
type TablerIconComponent = typeof IconFolder;

const TABLER_ICON_COMPONENTS = TablerIcons as unknown as Record<
  string,
  TablerIconComponent | undefined
>;
const TABLER_ICON_IDS =
  ((TablerIcons.iconsList as unknown as { default?: string[] }).default ?? []).filter(Boolean);

type FolderIconOption = { id?: string; name: string; label: string };

const FOLDER_ICON_OPTIONS: FolderIconOption[] = [
  { name: "IconFolder", label: "Folder" },
  { name: "IconInbox", label: "Inbox" },
  { name: "IconArchive", label: "Archive" },
  { name: "IconBookmark", label: "Bookmark" },
  { name: "IconBook", label: "Book" },
  { name: "IconFileText", label: "Document" },
  { name: "IconBriefcase", label: "Work" },
  { name: "IconCode", label: "Code" },
  { name: "IconBulb", label: "Ideas" },
  { name: "IconHeart", label: "Favorites" },
  { name: "IconHome", label: "Home" },
  { name: "IconLink", label: "Links" },
  { name: "IconPhoto", label: "Photos" },
  { name: "IconMovie", label: "Movies" },
  { name: "IconMusic", label: "Music" },
  { name: "IconPalette", label: "Design" },
  { name: "IconPlane", label: "Travel" },
  { name: "IconMap", label: "Places" },
  { name: "IconSchool", label: "Learning" },
  { name: "IconShoppingCart", label: "Shopping" },
  { name: "IconDeviceGamepad2", label: "Games" },
  { name: "IconCoffee", label: "Coffee" },
  { name: "IconCalendar", label: "Calendar" },
  { name: "IconStar", label: "Star" },
  { name: "IconTag", label: "Tag" },
  { name: "IconWorld", label: "World" }
];
const FOLDER_ICON_RESULT_LIMIT = FOLDER_ICON_OPTIONS.length;
const ALL_FOLDER_ICON_OPTIONS = TABLER_ICON_IDS.map((id) => ({
  id,
  name: toFolderIconComponentName(id),
  label: formatFolderIconLabel(id)
}))
  .filter(({ name }) => TABLER_ICON_COMPONENTS[name])
  .sort((first, second) => first.label.localeCompare(second.label));

const FOLDER_ICON_COLORS = [
  "#697080",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899"
];

const ProductShell = () => {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkTargetFolder, setBookmarkTargetFolder] = useState<FolderItem | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const currentUser = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser
  });
  const folders = useQuery({
    enabled: currentUser.isSuccess,
    queryKey: ["folders"],
    queryFn: getFolders
  });
  const username = displayUsername(currentUser.data);
  const activeFolder = folders.data?.find((folder) => folder.id === activeFolderId) ?? null;

  const openBookmarkDialog = (folder: FolderItem | null) => {
    setBookmarkTargetFolder(folder);
    setBookmarkDialogOpen(true);
  };

  return (
    <main
      className="min-h-screen bg-gray-50 font-sans text-slate-950 md:h-screen md:overflow-hidden"
      style={{ "--sidebar-width": isSidebarVisible ? "300px" : "0px" } as CSSProperties}
    >
      <aside
        className={[
          "overflow-hidden bg-gray-50 text-slate-950 transition-[max-height,opacity] duration-300 ease-out md:fixed md:inset-y-0 md:left-0 md:z-20 md:max-h-none md:w-[var(--sidebar-width)] md:transition-[width,opacity]",
          isSidebarVisible
            ? "max-h-[80vh] border-b border-gray-200 opacity-100 md:border-r md:border-b-0"
            : "max-h-0 border-b-0 opacity-0 md:border-r-0"
        ].join(" ")}
        aria-label="Primary"
        aria-hidden={!isSidebarVisible}
      >
        <div className="min-w-0 px-3 py-3 md:h-full md:w-[300px] md:overflow-y-auto md:px-4 md:py-4">
          <FolderSidebar
            activeFolderId={activeFolderId}
            currentUser={currentUser.data}
            folders={folders.data ?? []}
            isError={folders.isError}
            isLoading={folders.isLoading}
            onAddBookmark={openBookmarkDialog}
            onHideSidebar={() => setIsSidebarVisible(false)}
            onSelectFolder={setActiveFolderId}
          />
        </div>
      </aside>

      <section
        className="flex min-w-0 flex-col gap-7 p-5 transition-[margin-left] duration-300 ease-out md:ml-[var(--sidebar-width)] md:h-screen md:overflow-y-auto md:p-7"
        aria-label="Items workspace"
      >
        <header className="flex items-start gap-3">
          {!isSidebarVisible ? (
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-slate-950 outline-none hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label="Show sidebar"
              title="Show sidebar"
              type="button"
              onClick={() => setIsSidebarVisible(true)}
            >
              <IconLayoutSidebarLeftExpand
                size={23}
                stroke={1.5}
                aria-hidden="true"
                focusable="false"
              />
            </button>
          ) : null}
          <div className="col-span-3 min-w-0">
            <p className="mb-1 text-[13px] font-bold text-[#858b9a]">{username}</p>
            <h1 className="m-0 text-[34px] leading-[1.1] font-bold">
              {activeFolder?.name ?? "Items"}
            </h1>
          </div>
        </header>

        <BookmarksWorkspace folderId={activeFolderId} folderName={activeFolder?.name ?? null} />
      </section>
      <AddBookmarkDialog
        isOpen={bookmarkDialogOpen}
        targetFolder={bookmarkTargetFolder}
        visibleFolderId={activeFolderId}
        onOpenChange={setBookmarkDialogOpen}
      />
    </main>
  );
};

const displayUsername = (currentUser?: CurrentUserResponse) =>
  currentUser?.user.name || currentUser?.user.email || "User";

const FolderSidebar = ({
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

const FolderTreeRow = ({
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

const usePersistedStringSet = (storageKey: string): [ReadonlySet<string>, (id: string) => void] => {
  const [items, setItems] = useState<Set<string>>(() => readStringSet(storageKey));

  useEffect(() => {
    writeStringSet(storageKey, items);
  }, [items, storageKey]);

  const toggleItem = useCallback((id: string) => {
    setItems((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  return [items, toggleItem];
};

const readStringSet = (storageKey: string) => {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
};

const writeStringSet = (storageKey: string, items: ReadonlySet<string>) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...items]));
  } catch {
    // Persisting sidebar preferences is best-effort.
  }
};

function formatFolderIconLabel(iconNameOrId: string) {
  return iconNameOrId
    .replace(/^Icon/, "")
    .replace(/-/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/(\d+)/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

function toFolderIconComponentName(iconId: string) {
  return `Icon${iconId
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join("")}`;
}

const normalizeFolderIconName = (iconName: string | null | undefined) =>
  iconName && TABLER_ICON_COMPONENTS[iconName] ? iconName : DEFAULT_FOLDER_ICON_NAME;

const getFolderIconComponent = (iconName: string | null | undefined) =>
  TABLER_ICON_COMPONENTS[normalizeFolderIconName(iconName)] ?? IconFolder;

const folderRowIndent = (level: number) => 8 + level * 18;

const FolderDisclosurePlaceholder = () => <span className="h-7 w-6 shrink-0" aria-hidden="true" />;

const FolderDisclosureControl = ({
  folderName,
  hasChildren,
  isCollapsed,
  onToggle
}: {
  folderName: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}) => {
  if (!hasChildren) {
    return <FolderDisclosurePlaceholder />;
  }

  return (
    <button
      className="grid h-7 w-6 shrink-0 place-items-center rounded-lg text-gray-500 outline-none hover:bg-gray-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      aria-expanded={!isCollapsed}
      aria-label={`${isCollapsed ? "Expand" : "Collapse"} folder ${folderName}`}
      type="button"
      onClick={onToggle}
    >
      {isCollapsed ? (
        <IconChevronRight size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      ) : (
        <IconChevronDown size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      )}
    </button>
  );
};

const InlineFolderForm = ({
  defaultValue = "",
  defaultIconColor = null,
  defaultIconName = null,
  error,
  isPending,
  leadingSlot,
  submitLabel,
  onCancel,
  onSubmit
}: {
  defaultValue?: string;
  defaultIconColor?: string | null;
  defaultIconName?: string | null;
  error: string | null;
  isPending: boolean;
  leadingSlot?: ReactNode;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (value: FolderFormValue) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(defaultValue);
  const [iconName, setIconName] = useState(defaultIconName ?? DEFAULT_FOLDER_ICON_NAME);
  const [iconColor, setIconColor] = useState(defaultIconColor ?? DEFAULT_FOLDER_ICON_COLOR);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isNameInvalid, setIsNameInvalid] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const triggerNameValidation = () => {
    setIsNameInvalid(true);
    setIsNameShaking(false);
    requestAnimationFrame(() => setIsNameShaking(true));
    inputRef.current?.focus();
  };

  const updateName = (value: string) => {
    setName(value);
    if (value.trim()) {
      setIsNameInvalid(false);
    }
  };

  return (
    <form
      className="grid min-h-9 min-w-0 grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center gap-1"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const trimmedName = String(formData.get("name") ?? "").trim();

        if (!trimmedName) {
          triggerNameValidation();
          return;
        }

        onSubmit({
          iconColor,
          iconName,
          name: trimmedName
        });
      }}
    >
      <div className="flex min-w-0 items-center gap-1">
        {leadingSlot}
        <FolderIconPickerDropdown
          iconColor={iconColor}
          iconName={iconName}
          isOpen={isIconPickerOpen}
          onCancel={() => setIsIconPickerOpen(false)}
          onCommit={(nextIconName, nextIconColor) => {
            setIconName(nextIconName);
            setIconColor(nextIconColor);
            setIsIconPickerOpen(false);
          }}
          onOpenChange={setIsIconPickerOpen}
        />
        <input
          className={[
            "min-h-8 min-w-0 flex-1 rounded-md border bg-transparent px-1.5 text-sm font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]",
            isNameInvalid
              ? "border-[#ef4444] ring-3 ring-[#fee2e2]"
              : "border-transparent",
            isNameShaking ? "field-shake" : ""
          ].join(" ")}
          aria-label="Folder title"
          aria-invalid={isNameInvalid}
          name="name"
          placeholder="Folder title"
          ref={inputRef}
          value={name}
          onAnimationEnd={() => setIsNameShaking(false)}
          onChange={(event) => updateName(event.target.value)}
          onInput={(event) => updateName(event.currentTarget.value)}
        />
      </div>
      <button
        className="grid h-8 w-7 place-items-center rounded-lg border border-transparent bg-transparent text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label="Cancel"
        disabled={isPending}
        title="Cancel"
        type="button"
        onClick={onCancel}
      >
        <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      </button>
      <button
        className="grid h-8 w-8 place-items-center rounded-lg border border-transparent bg-transparent text-[#3b8df5] outline-none hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:text-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label={isPending ? "Saving" : submitLabel}
        disabled={isPending}
        title={isPending ? "Saving" : submitLabel}
        type="submit"
      >
        <IconCheck size={17} stroke={1.8} aria-hidden="true" focusable="false" />
      </button>
      {error ? (
        <p className="col-span-3 m-0 text-xs font-bold text-[#9a4d0a]">{error}</p>
      ) : null}
    </form>
  );
};

const FolderIconPickerDropdown = ({
  iconColor,
  iconName,
  isOpen,
  onCancel,
  onCommit,
  onOpenChange
}: {
  iconColor: string;
  iconName: string;
  isOpen: boolean;
  onCancel: () => void;
  onCommit: (iconName: string, iconColor: string) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const [search, setSearch] = useState("");
  const [draftIconName, setDraftIconName] = useState(iconName);
  const [draftIconColor, setDraftIconColor] = useState(iconColor);
  const TriggerIcon = getFolderIconComponent(iconName);
  const selectedIcon = normalizeFolderIconName(draftIconName);
  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return FOLDER_ICON_OPTIONS;
    }

    return ALL_FOLDER_ICON_OPTIONS.filter(
      (icon) =>
        icon.label.toLowerCase().includes(query) ||
        icon.name.toLowerCase().includes(query) ||
        icon.id?.toLowerCase().includes(query)
    ).slice(0, FOLDER_ICON_RESULT_LIMIT);
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setDraftIconName(normalizeFolderIconName(iconName));
      setDraftIconColor(iconColor);
    }
  }, [iconColor, iconName, isOpen]);

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger
        className="grid h-8 w-[21px] shrink-0 place-items-center rounded-lg border border-transparent bg-transparent outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label="Choose folder icon"
        type="button"
      >
        <TriggerIcon
          size={19}
          stroke={1.5}
          color={iconColor}
          aria-hidden="true"
          focusable="false"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-[80]" side="bottom" align="start" sideOffset={6}>
          <Popover.Popup
            className="grid max-h-[min(420px,calc(100vh-24px))] w-[312px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[#dfe4ef] bg-white text-[#242833] shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none"
            aria-label="Folder icon picker"
          >
            <div className="grid gap-2 border-b border-[#eef1f6] p-2.5">
              <label className="flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg border border-[#dfe4ef] bg-white px-2.5 text-[#697080] outline-none focus-within:border-[#3b8df5] focus-within:ring-3 focus-within:ring-[#d9eaff]">
                <IconSearch size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]"
                  aria-label="Search icons"
                  placeholder="Search icons..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-1.5" aria-label="Icon colors">
                {FOLDER_ICON_COLORS.map((color) => (
                  <button
                    className={[
                      "grid h-6 w-6 place-items-center rounded-full border outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                      draftIconColor === color ? "border-[#242833]" : "border-[#dfe4ef]"
                    ].join(" ")}
                    aria-label={`Select color ${color}`}
                    key={color}
                    type="button"
                    onClick={() => setDraftIconColor(color)}
                  >
                    <span
                      className="block h-4 w-4 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-2">
              <div className="grid grid-cols-[repeat(auto-fill,40px)] justify-start gap-1.5">
                {filteredIcons.map(({ label, name }) => {
                  const PickerIcon = getFolderIconComponent(name);
                  const isSelected = selectedIcon === name;

                  return (
                    <button
                      className={[
                        "grid h-9 w-10 place-items-center rounded-md border bg-white p-1 text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                        isSelected ? "border-[#3b8df5] ring-3 ring-[#d9eaff]" : "border-[#dfe4ef]"
                      ].join(" ")}
                      aria-label={label}
                      aria-pressed={isSelected}
                      key={name}
                      type="button"
                      onClick={() => setDraftIconName(name)}
                    >
                      <PickerIcon
                        size={18}
                        stroke={1.5}
                        color={draftIconColor}
                        aria-hidden="true"
                        focusable="false"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#eef1f6] bg-white p-2">
              <button
                className="h-8 rounded-md px-3 text-xs font-medium text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="h-8 rounded-md bg-[#3b8df5] px-3 text-xs font-medium text-white outline-none hover:bg-[#2f7fe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                type="button"
                onClick={() => onCommit(selectedIcon, draftIconColor)}
              >
                Okay
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

const FolderContextMenu = ({
  folder,
  x,
  y,
  onAddBookmark,
  onCreateFolder,
  onDeleteFolder,
  onEditFolder
}: {
  folder: FolderItem;
  x: number;
  y: number;
  onAddBookmark: () => void;
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onEditFolder: () => void;
}) => (
  <div
    className="fixed z-30 grid w-[190px] gap-1 rounded-lg border border-[#dfe4ef] bg-white p-1.5 text-sm font-medium text-[#4b5262] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
    role="menu"
    aria-label={`Folder actions for ${folder.name}`}
    style={{ left: x, top: y }}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.currentTarget.blur();
      }
    }}
  >
    <ContextMenuButton icon={IconBookmark} label="Add a bookmark" onClick={onAddBookmark} />
    <ContextMenuButton icon={IconFolderPlus} label="Create new folder" onClick={onCreateFolder} />
    <ContextMenuButton icon={IconPencil} label="Edit folder" onClick={onEditFolder} />
    <ContextMenuButton icon={IconTrash} label="Delete folder" tone="danger" onClick={onDeleteFolder} />
  </div>
);

const ContextMenuButton = ({
  icon: Icon,
  label,
  tone = "default",
  onClick
}: {
  icon: typeof IconBookmark;
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) => (
  <button
    className={[
      "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-left outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
      tone === "danger" ? "text-[#b42318]" : "text-[#4b5262]"
    ].join(" ")}
    role="menuitem"
    type="button"
    onClick={onClick}
  >
    <Icon size={16} stroke={1.5} aria-hidden="true" focusable="false" />
    <span>{label}</span>
  </button>
);

const DeleteFolderDialog = ({
  folder,
  folders,
  onClose,
  onDeleted
}: {
  folder: FolderItem | null;
  folders: FolderItem[];
  onClose: () => void;
  onDeleted: (deletedFolderIds: string[]) => void;
}) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"move" | "delete">("move");
  const [destinationFolderId, setDestinationFolderId] = useState("");
  const deletedFolderIds = useMemo(
    () => (folder ? collectFolderSubtreeIds(folders, folder.id) : []),
    [folder, folders]
  );
  const destinationFolders = useMemo(
    () =>
      folder
        ? folders.filter(
            (candidate) =>
              candidate.libraryId === folder.libraryId && !deletedFolderIds.includes(candidate.id)
          )
        : [],
    [deletedFolderIds, folder, folders]
  );
  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: (result) => {
      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) =>
        currentFolders.filter((currentFolder) => !result.deletedFolderIds.includes(currentFolder.id))
      );
      onDeleted(result.deletedFolderIds);
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      onClose();
    }
  });

  useEffect(() => {
    const firstDestination = destinationFolders[0]?.id ?? "";

    setDestinationFolderId(firstDestination);
    setMode(firstDestination ? "move" : "delete");
  }, [destinationFolders, folder]);

  if (!folder) {
    return null;
  }

  const submitDisabled =
    deleteFolderMutation.isPending || (mode === "move" && !destinationFolderId);

  return (
    <Dialog.Root open={Boolean(folder)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-32px),460px)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-lg border border-[#e4e7ef] bg-white p-5 text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none">
          <div className="grid gap-1 pr-9">
            <Dialog.Title className="text-lg leading-[1.25] font-extrabold">
              Delete {folder.name}
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              Choose what happens to bookmarks inside this folder and its nested folders.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
            aria-label="Close delete folder dialog"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              deleteFolderMutation.mutate({
                destinationFolderId: mode === "move" ? destinationFolderId : null,
                folderId: folder.id,
                mode
              });
            }}
          >
            <label className="flex items-start gap-3 rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-3 text-sm font-bold">
              <input
                className="mt-1"
                checked={mode === "move"}
                disabled={destinationFolders.length === 0}
                name="delete-mode"
                type="radio"
                onChange={() => setMode("move")}
              />
              <span className="grid gap-2">
                <span>Move bookmarks to another folder</span>
                <select
                  className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-semibold text-[#242833] outline-none disabled:bg-[#f3f5f9] disabled:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]"
                  disabled={mode !== "move" || destinationFolders.length === 0}
                  value={destinationFolderId}
                  onChange={(event) => setDestinationFolderId(event.target.value)}
                >
                  {destinationFolders.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {folderPath(candidate, folders)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-3 text-sm font-bold">
              <input
                className="mt-1"
                checked={mode === "delete"}
                name="delete-mode"
                type="radio"
                onChange={() => setMode("delete")}
              />
              <span>Remove bookmarks along with the folder</span>
            </label>
            {deleteFolderMutation.isError ? (
              <p className="m-0 rounded-lg border border-[#f0b37e] bg-[#fff8f1] px-3 py-2 text-sm font-bold text-[#9a4d0a]">
                Folder could not be deleted.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close
                className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                disabled={deleteFolderMutation.isPending}
                type="button"
              >
                Cancel
              </Dialog.Close>
              <button
                className="min-h-10 rounded-lg border border-[#b42318] bg-[#b42318] px-3 text-sm font-extrabold text-white outline-none hover:bg-[#961b12] disabled:cursor-not-allowed disabled:border-[#e7a6a0] disabled:bg-[#e7a6a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                disabled={submitDisabled}
                type="submit"
              >
                {deleteFolderMutation.isPending ? "Deleting" : "Delete folder"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const BookmarksWorkspace = ({
  folderId,
  folderName
}: {
  folderId: string | null;
  folderName: string | null;
}) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<string | null>(null);
  const bookmarks = useInfiniteQuery({
    queryKey: ["bookmarks", folderId],
    queryFn: ({ pageParam }) => getBookmarks({ cursor: pageParam, folderId, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = bookmarks;
  const items = bookmarks.data?.pages.flatMap((page) => page.items) ?? [];
  const hasPendingMetadata = items.some((item) => item.metadataStatus === "pending");
  const deleteBookmarkMutation = useMutation({
    mutationFn: deleteBookmark,
    onMutate: async ({ bookmarkId }) => {
      const queryKey = ["bookmarks", folderId];

      await queryClient.cancelQueries({ queryKey });

      const previousBookmarks =
        queryClient.getQueryData<InfiniteData<BookmarksPageResponse, string | null>>(queryKey);

      queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
        queryKey,
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== bookmarkId)
                }))
              }
            : current
      );

      return { previousBookmarks, queryKey };
    },
    onError: (_error, _input, context) => {
      if (context?.previousBookmarks) {
        queryClient.setQueryData(context.queryKey, context.previousBookmarks);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });

  useEffect(() => {
    const node = loadMoreRef.current;

    if (
      !node ||
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: "360px 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (!hasPendingMetadata) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [hasPendingMetadata, refetch]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeout = window.setTimeout(() => setNotification(null), 2200);

    return () => window.clearTimeout(timeout);
  }, [notification]);

  if (bookmarks.isLoading) {
    return (
      <section
        className="grid gap-3 rounded-lg border border-[#e4e7ef] bg-white p-5 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-label="Loading items"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="grid gap-2 rounded-lg border border-[#edf0f6] p-4" key={index}>
            <div className="h-4 w-2/5 rounded bg-[#eef1f6]" />
            <div className="h-3 w-4/5 rounded bg-[#f3f5f9]" />
          </div>
        ))}
      </section>
    );
  }

  if (bookmarks.isError) {
    return (
      <section
        className="grid gap-4 rounded-lg border border-[#f0b37e] bg-white p-5 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-labelledby="items-error-title"
      >
        <div className="flex items-start gap-3">
          <IconAlertTriangle
            className="mt-0.5 text-[#d97706]"
            size={20}
            stroke={1.5}
            aria-hidden="true"
            focusable="false"
          />
          <div>
            <h2 id="items-error-title" className="m-0 text-lg font-extrabold">
              Items could not be loaded
            </h2>
            <p className="mt-1 mb-0 text-sm leading-6 text-[#697080]">
              The API did not return the bookmark list.
            </p>
          </div>
        </div>
        <button
          className="flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          type="button"
          onClick={() => void bookmarks.refetch()}
        >
          <IconRefresh size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          <span>Retry</span>
        </button>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section
        className="grid gap-3 rounded-lg border border-[#e4e7ef] bg-white p-7 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-labelledby="empty-items-title"
      >
        <IconBookmark
          className="text-[#3b8df5]"
          size={24}
          stroke={1.5}
          aria-hidden="true"
          focusable="false"
        />
        <div>
          <h2 id="empty-items-title" className="mb-2 text-2xl leading-[1.2] font-bold">
            No items yet
          </h2>
          <p className="mb-0 max-w-[56ch] text-[#697080]">
            {folderName
              ? "Bookmarks added to this folder will appear here."
              : "Added bookmarks will appear here as soon as they are saved."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className="grid gap-3"
        aria-label={folderName ? `${folderName} items` : "Saved items"}
        aria-busy={bookmarks.isFetchingNextPage}
      >
        {items.map((item) => (
          <BookmarkRow
            item={item}
            key={item.id}
            showFolderName={folderId === null}
            onDeleteBookmark={(bookmarkId) => deleteBookmarkMutation.mutate({ bookmarkId })}
            onLinkCopied={() => setNotification("Link copied")}
          />
        ))}
        <div ref={loadMoreRef} className="min-h-6" aria-hidden="true" />
        {bookmarks.isFetchingNextPage ? (
          <p className="m-0 rounded-lg border border-[#e4e7ef] bg-white px-4 py-3 text-sm font-bold text-[#697080]">
            Loading more items
          </p>
        ) : null}
        {!bookmarks.hasNextPage ? (
          <p className="m-0 px-1 py-2 text-sm font-bold text-[#858b9a]">All items loaded</p>
        ) : null}
      </section>
      {notification ? (
        <div
          className="fixed right-4 bottom-4 z-40 rounded-lg border border-[#dfe4ef] bg-white px-3 py-2 text-sm font-extrabold text-[#242833] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
          role="status"
          aria-live="polite"
        >
          {notification}
        </div>
      ) : null}
    </>
  );
};

const BookmarkRow = ({
  item,
  showFolderName,
  onDeleteBookmark,
  onLinkCopied
}: {
  item: BookmarkItem;
  showFolderName: boolean;
  onDeleteBookmark: (bookmarkId: string) => void;
  onLinkCopied: () => void;
}) => {
  const host = hostFromUrl(item.url);
  const faviconSrc = item.faviconUrl ? apiAssetUrl(item.faviconUrl) : null;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const title = item.title || host || item.url;

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = () => setMenu(null);

    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [menu]);

  const openLink = () => {
    window.open(item.url, "_blank", "noopener,noreferrer");
    setMenu(null);
  };

  const copyLink = () => {
    void copyBookmarkLink(item.url).then(onLinkCopied);
    setMenu(null);
  };

  const deleteItem = () => {
    onDeleteBookmark(item.id);
    setMenu(null);
  };

  return (
    <article className="rounded-lg border border-[#e4e7ef] bg-white p-4 shadow-[0_14px_40px_rgb(46_54_77_/_0.045)]">
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[144px_minmax(0,1fr)]">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#f3f5f9] sm:aspect-[3/2]">
          {item.imageUrl ? (
            <img
              className="h-full w-full object-cover"
              src={item.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="grid h-full w-full place-items-center bg-[#f7f8fc] text-[#9aa1ad]"
              role="img"
              aria-label="No thumbnail available"
            >
              <IconPhoto size={28} stroke={1.5} aria-hidden="true" focusable="false" />
            </div>
          )}
        </div>
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#fbfcff]">
                {faviconSrc ? (
                  <img
                    className="h-5 w-5 object-contain"
                    src={faviconSrc}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <IconBookmark size={19} stroke={1.5} aria-hidden="true" focusable="false" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="m-0 truncate text-lg leading-[1.25] font-extrabold">
                  {title}
                </h2>
                <a
                  className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#2f80ed] no-underline hover:underline"
                  href={item.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <IconExternalLink size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  <span className="truncate">{item.url}</span>
                </a>
              </div>
            </div>
            <div className="flex w-fit shrink-0 items-center gap-2">
              {showFolderName ? (
                <span
                  className="flex items-center gap-1.5 rounded-lg border border-[#e7eaf1] bg-[#fbfcff] px-2.5 py-1 text-xs font-extrabold text-[#697080]"
                  aria-label={`Bookmark folder ${item.folderName}`}
                >
                  <IconFolder size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  {item.folderName}
                </span>
              ) : null}
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7eaf1] bg-[#fbfcff] text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                aria-label={`Bookmark actions for ${title}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenu(
                    clampContextMenuPosition(rect.left, rect.bottom + 4, BOOKMARK_CONTEXT_MENU_SIZE)
                  );
                }}
              >
                <IconDotsVertical size={16} stroke={1.5} aria-hidden="true" focusable="false" />
              </button>
            </div>
          </div>
          {item.description ? (
            <p className="m-0 max-w-[74ch] text-sm leading-6 text-[#697080]">
              {item.description}
            </p>
          ) : null}
          <time className="text-xs font-bold text-[#858b9a]" dateTime={item.createdAt}>
            Added {formatBookmarkDate(item.createdAt)}
          </time>
        </div>
      </div>
      {menu ? (
        <BookmarkContextMenu
          itemTitle={title}
          x={menu.x}
          y={menu.y}
          onOpenLink={openLink}
          onCopyLink={copyLink}
          onDelete={deleteItem}
        />
      ) : null}
    </article>
  );
};

const BookmarkContextMenu = ({
  itemTitle,
  x,
  y,
  onOpenLink,
  onCopyLink,
  onDelete
}: {
  itemTitle: string;
  x: number;
  y: number;
  onOpenLink: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) => (
  <div
    className="fixed z-30 grid w-[160px] gap-1 rounded-lg border border-[#dfe4ef] bg-white p-1.5 text-sm font-medium text-[#4b5262] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
    role="menu"
    aria-label={`Bookmark actions for ${itemTitle}`}
    style={{ left: x, top: y }}
    onClick={(event) => event.stopPropagation()}
  >
    <button
      className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-left outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
      role="menuitem"
      type="button"
      onClick={onOpenLink}
    >
      <IconExternalLink size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      <span>Open</span>
    </button>
    <button
      className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-left outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
      role="menuitem"
      type="button"
      onClick={onCopyLink}
    >
      <IconCopy size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      <span>Copy link</span>
    </button>
    <button
      className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-left text-[#b42318] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
      role="menuitem"
      type="button"
      onClick={onDelete}
    >
      <IconTrash size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      <span>Delete</span>
    </button>
  </div>
);

const copyBookmarkLink = async (url: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const clampContextMenuPosition = (
  x: number,
  y: number,
  size: { height: number; width: number }
) => {
  const viewportWidth =
    typeof window === "undefined" ? size.width + CONTEXT_MENU_MARGIN * 2 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? size.height + CONTEXT_MENU_MARGIN * 2 : window.innerHeight;
  const maxX = Math.max(CONTEXT_MENU_MARGIN, viewportWidth - size.width - CONTEXT_MENU_MARGIN);
  const maxY = Math.max(CONTEXT_MENU_MARGIN, viewportHeight - size.height - CONTEXT_MENU_MARGIN);

  return {
    x: Math.min(Math.max(CONTEXT_MENU_MARGIN, x), maxX),
    y: Math.min(Math.max(CONTEXT_MENU_MARGIN, y), maxY)
  };
};

const hostFromUrl = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

const isValidBookmarkUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

const formatBookmarkDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));

const AddBookmarkDialog = ({
  isOpen,
  targetFolder,
  visibleFolderId,
  onOpenChange
}: {
  isOpen: boolean;
  targetFolder: FolderItem | null;
  visibleFolderId: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [isUrlInvalid, setIsUrlInvalid] = useState(false);
  const [isUrlShaking, setIsUrlShaking] = useState(false);
  const queryClient = useQueryClient();
  const addBookmark = useMutation({
    mutationFn: ({ optimisticFolder: _optimisticFolder, ...input }: AddBookmarkMutationInput) =>
      createBookmark(input),
    onMutate: async (input) => {
      const optimisticFolder = input.optimisticFolder;

      if (!optimisticFolder) {
        return { targetFolderId: null };
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["bookmarks"] }),
        queryClient.cancelQueries({ queryKey: ["folders"] })
      ]);

      const bookmarkQueryKeys = bookmarkQueryKeysForFolder(optimisticFolder.id);
      const previousBookmarks = bookmarkQueryKeys.map((queryKey) => ({
        data: queryClient.getQueryData<InfiniteData<BookmarksPageResponse, string | null>>(queryKey),
        hadData: Boolean(queryClient.getQueryState(queryKey)),
        queryKey
      }));
      const previousFolders = queryClient.getQueryData<FolderItem[]>(["folders"]);
      const now = new Date().toISOString();
      const optimisticBookmark: BookmarkItem = {
        id: `optimistic-${crypto.randomUUID()}`,
        libraryId: optimisticFolder.libraryId,
        folderId: optimisticFolder.id,
        folderName: optimisticFolder.name,
        url: input.url,
        title: null,
        description: null,
        siteName: null,
        imageUrl: null,
        metadataStatus: "pending",
        metadataFetchedAt: null,
        faviconId: null,
        faviconUrl: null,
        createdAt: now,
        updatedAt: now
      };

      for (const queryKey of bookmarkQueryKeys) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(queryKey, (data) =>
          insertBookmarkIntoPages(data, optimisticBookmark)
        );
      }

      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) =>
        currentFolders.map((folder) =>
          folder.id === optimisticFolder.id
            ? { ...folder, bookmarkCount: folder.bookmarkCount + 1, updatedAt: now }
            : folder
        )
      );

      return {
        optimisticBookmarkId: optimisticBookmark.id,
        previousBookmarks,
        previousFolders,
        targetFolderId: optimisticFolder.id
      };
    },
    onError: (_error, _input, context) => {
      for (const previousBookmark of context?.previousBookmarks ?? []) {
        if (previousBookmark.hadData) {
          queryClient.setQueryData(previousBookmark.queryKey, previousBookmark.data);
        } else {
          queryClient.removeQueries({ exact: true, queryKey: previousBookmark.queryKey });
        }
      }

      if (context?.previousFolders) {
        queryClient.setQueryData(["folders"], context.previousFolders);
      }
    },
    onSuccess: (bookmark, _input, context) => {
      if (!visibleFolderId || bookmark.folderId === visibleFolderId) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
          ["bookmarks", visibleFolderId],
          (data) => insertBookmarkIntoPages(data, bookmark, context?.optimisticBookmarkId)
        );
      }

      formRef.current?.reset();
      setIsUrlInvalid(false);
      setIsUrlShaking(false);
      onOpenChange(false);
    },
    onSettled: (bookmark, _error, input, context) => {
      const targetFolderId =
        bookmark?.folderId ?? context?.targetFolderId ?? input.optimisticFolder?.id ?? null;

      if (bookmark && context?.optimisticBookmarkId) {
        for (const queryKey of bookmarkQueryKeysForFolder(bookmark.folderId)) {
          queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
            queryKey,
            (data) => insertBookmarkIntoPages(data, bookmark, context.optimisticBookmarkId)
          );
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["bookmarks", null], exact: true });

      if (targetFolderId) {
        void queryClient.invalidateQueries({ queryKey: ["bookmarks", targetFolderId], exact: true });
      }

      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });

  const submitBookmark = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const url = (urlInputRef.current?.value ?? String(formData.get("url") ?? "")).trim();

    if (!isValidBookmarkUrl(url)) {
      setIsUrlInvalid(true);
      setIsUrlShaking(false);
      requestAnimationFrame(() => setIsUrlShaking(true));
      urlInputRef.current?.focus();
      return;
    }

    addBookmark.mutate({ folderId: targetFolder?.id, optimisticFolder: targetFolder, url });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (open) {
          addBookmark.reset();
          setIsUrlInvalid(false);
          setIsUrlShaking(false);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-32px),420px)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-lg border border-[#e4e7ef] bg-white p-5 text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none">
          <div className="grid gap-1 pr-9">
            <Dialog.Title className="text-lg leading-[1.25] font-extrabold">
              {targetFolder ? `Add to ${targetFolder.name}` : "Add bookmark"}
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              Paste the page link you want to save.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
            aria-label="Close add bookmark dialog"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form className="grid gap-4" ref={formRef} noValidate onSubmit={submitBookmark}>
            <label className="grid gap-2 text-sm font-bold" htmlFor="bookmark-url">
              Page URL
              <input
                className={[
                  "min-h-11 rounded-lg border bg-white px-3 text-base font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]",
                  isUrlInvalid ? "border-[#ef4444] ring-3 ring-[#fee2e2]" : "border-[#dfe4ef]",
                  isUrlShaking ? "field-shake" : ""
                ].join(" ")}
                aria-invalid={isUrlInvalid}
                id="bookmark-url"
                inputMode="url"
                name="url"
                placeholder="https://example.com/article"
                ref={urlInputRef}
                type="text"
                onAnimationEnd={() => setIsUrlShaking(false)}
                onChange={(event) => {
                  if (isValidBookmarkUrl(event.target.value.trim())) {
                    setIsUrlInvalid(false);
                  }
                }}
                onInput={(event) => {
                  if (isValidBookmarkUrl(event.currentTarget.value.trim())) {
                    setIsUrlInvalid(false);
                  }
                }}
              />
            </label>
            {addBookmark.isError ? (
              <p className="m-0 rounded-lg border border-[#f0b37e] bg-[#fff8f1] px-3 py-2 text-sm font-bold text-[#9a4d0a]">
                Bookmark could not be saved.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close
                className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                disabled={addBookmark.isPending}
                type="button"
              >
                Cancel
              </Dialog.Close>
              <button
                className="min-h-10 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-3 text-sm font-extrabold text-white outline-none hover:bg-[#2f80ed] disabled:cursor-not-allowed disabled:border-[#91bff8] disabled:bg-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                disabled={addBookmark.isPending}
                type="submit"
              >
                {addBookmark.isPending ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

type AddBookmarkMutationInput = {
  folderId?: string;
  optimisticFolder: FolderItem | null;
  url: string;
};

const insertBookmarkIntoPages = (
  data: InfiniteData<BookmarksPageResponse, string | null> | undefined,
  bookmark: BookmarkItem,
  replacementId?: string
): InfiniteData<BookmarksPageResponse, string | null> => {
  if (!data) {
    return {
      pageParams: [null],
      pages: [
        {
          items: [bookmark],
          nextCursor: null
        }
      ]
    };
  }

  const pagesWithoutDuplicate = data.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== bookmark.id && item.id !== replacementId)
  }));
  const [firstPage, ...restPages] = pagesWithoutDuplicate;

  return {
    ...data,
    pages: [
      {
        ...(firstPage ?? { nextCursor: null }),
        items: [bookmark, ...(firstPage?.items ?? [])]
      },
      ...restPages
    ]
  };
};

const bookmarkQueryKeysForFolder = (folderId: string): Array<["bookmarks", string | null]> => [
  ["bookmarks", null],
  ["bookmarks", folderId]
];

const buildFolderTree = (folders: FolderItem[]): FolderNode[] => {
  const nodes = new Map<string, FolderNode>();

  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  const roots: FolderNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return sortFolderNodes(roots);
};

const sortFolderNodes = (nodes: FolderNode[]): FolderNode[] =>
  nodes
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((node) => ({
      ...node,
      children: sortFolderNodes(node.children)
    }));

const filterFolderTree = (nodes: FolderNode[], search: string): FolderNode[] => {
  const query = search.trim().toLocaleLowerCase();

  if (!query) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterFolderTree(node.children, query);

    if (node.name.toLocaleLowerCase().includes(query) || children.length > 0) {
      return [{ ...node, children }];
    }

    return [];
  });
};

const collectFolderSubtreeIds = (folders: FolderItem[], folderId: string): string[] => {
  const ids = [folderId];

  for (const child of folders.filter((folder) => folder.parentId === folderId)) {
    ids.push(...collectFolderSubtreeIds(folders, child.id));
  }

  return ids;
};

const folderPath = (folder: FolderItem, folders: FolderItem[]) => {
  const path = [folder.name];
  let parentId = folder.parentId;

  while (parentId) {
    const parent = folders.find((candidate) => candidate.id === parentId);

    if (!parent) {
      break;
    }

    path.unshift(parent.name);
    parentId = parent.parentId;
  }

  return path.join(" / ");
};

export default App;
