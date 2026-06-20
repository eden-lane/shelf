import {
  Fragment,
  type FormEvent,
  type KeyboardEvent,
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
  FolderItem,
  HealthResponse
} from "@bookmarks/shared";
import { Dialog } from "@base-ui/react/dialog";
import {
  IconAlertTriangle,
  IconBookmark,
  IconCircleCheck,
  IconDotsVertical,
  IconExternalLink,
  IconFolder,
  IconFolderPlus,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX
} from "@tabler/icons-react";
import {
  createBookmark,
  createFolder,
  deleteFolder,
  getBookmarks,
  getCurrentUser,
  getFolders,
  getHealth,
  updateFolder
} from "./api";

const queryClient = new QueryClient();

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <ProductShell />
  </QueryClientProvider>
);

type FolderNode = FolderItem & {
  children: FolderNode[];
};

const ProductShell = () => {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkTargetFolder, setBookmarkTargetFolder] = useState<FolderItem | null>(null);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000
  });
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
    <main className="grid min-h-screen grid-cols-1 bg-[#f7f8fc] font-sans text-[#242833] md:grid-cols-[300px_minmax(0,1fr)]">
      <aside
        className="flex flex-col gap-[18px] border-b border-[#e6e8ef] bg-[#f7f8fc] px-[18px] py-6 text-[#242833] md:gap-6 md:border-r md:border-b-0"
        aria-label="Primary"
      >
        <div className="flex items-center gap-3 text-lg font-bold">
          <span
            className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-[#e4efff] font-extrabold text-[#3b8df5]"
            aria-hidden="true"
          >
            <IconBookmark size={18} stroke={2.4} aria-hidden="true" focusable="false" />
          </span>
          <span>{username}</span>
        </div>
        <button
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-3 py-[11px] text-sm font-extrabold text-white shadow-[0_12px_28px_rgb(59_141_245_/_0.22)] outline-none hover:bg-[#2f80ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          type="button"
          onClick={() => openBookmarkDialog(null)}
        >
          <IconPlus size={18} stroke={2.4} aria-hidden="true" focusable="false" />
          <span>Add bookmark</span>
        </button>
        <FolderSidebar
          activeFolderId={activeFolderId}
          currentUser={currentUser.data}
          folders={folders.data ?? []}
          isError={folders.isError}
          isLoading={folders.isLoading}
          onAddBookmark={openBookmarkDialog}
          onSelectFolder={setActiveFolderId}
        />
      </aside>

      <section className="flex min-w-0 flex-col gap-7 p-5 md:p-7" aria-label="Items workspace">
        <header className="flex flex-col items-start justify-between gap-5 md:flex-row">
          <div>
            <p className="mb-1 text-[13px] font-bold text-[#858b9a]">{username}</p>
            <h1 className="m-0 text-[34px] leading-[1.1] font-bold">
              {activeFolder?.name ?? "Items"}
            </h1>
          </div>
          <HealthSummary health={health.data} isLoading={health.isLoading} isError={health.isError} />
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
  onSelectFolder
}: {
  activeFolderId: string | null;
  currentUser?: CurrentUserResponse;
  folders: FolderItem[];
  isError: boolean;
  isLoading: boolean;
  onAddBookmark: (folder: FolderItem | null) => void;
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
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

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
    setMenu({ folderId: folder.id, x, y });
  };

  const menuFolder = menu ? folders.find((folder) => folder.id === menu.folderId) ?? null : null;

  return (
    <nav className="grid gap-3" aria-label="Folders">
      <button
        className={[
          "flex min-h-10 items-center gap-2 rounded-lg border px-3 text-left text-sm font-semibold outline-none hover:border-[#dfe4ef] hover:bg-white hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
          activeFolderId === null
            ? "border-[#d8e7ff] bg-[#eef5ff] text-[#2f80ed]"
            : "border-transparent text-[#697080]"
        ].join(" ")}
        type="button"
        onClick={() => onSelectFolder(null)}
      >
        <IconBookmark size={17} stroke={2} aria-hidden="true" focusable="false" />
        <span>Items</span>
      </button>
      <div className="grid gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold tracking-[0.08em] text-[#858b9a] uppercase">
            Folders
          </span>
          {currentUser?.libraries[0] ? (
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#dfe4ef] hover:bg-white hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
              aria-label="Create folder"
              type="button"
              onClick={() =>
                setCreatingTarget({
                  libraryId: currentUser.libraries[0].id,
                  parentId: null
                })
              }
            >
              <IconFolderPlus size={17} stroke={2.2} aria-hidden="true" focusable="false" />
            </button>
          ) : null}
        </div>
        {isLoading ? (
          <p className="m-0 rounded-lg border border-[#e4e7ef] bg-white px-3 py-2 text-sm font-bold text-[#858b9a]">
            Loading folders
          </p>
        ) : null}
        {isError ? (
          <p className="m-0 rounded-lg border border-[#f0b37e] bg-white px-3 py-2 text-sm font-bold text-[#9a4d0a]">
            Folders could not be loaded.
          </p>
        ) : null}
        {currentUser?.libraries.map((library) => {
          const roots = folderTree.filter((folder) => folder.libraryId === library.id);

          return (
            <section className="grid gap-1" key={library.id} aria-label={`${library.name} folders`}>
              <div className="flex min-h-8 items-center justify-between gap-2 px-1">
                <span className="truncate text-xs font-bold text-[#858b9a]">{library.name}</span>
                <button
                  className="grid h-7 w-7 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#dfe4ef] hover:bg-white hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                  aria-label={`Create folder in ${library.name}`}
                  type="button"
                  onClick={() => setCreatingTarget({ libraryId: library.id, parentId: null })}
                >
                  <IconPlus size={15} stroke={2.2} aria-hidden="true" focusable="false" />
                </button>
              </div>
              {creatingTarget?.libraryId === library.id && creatingTarget.parentId === null ? (
                <InlineFolderForm
                  error={createFolderMutation.isError ? "Folder could not be created." : null}
                  isPending={createFolderMutation.isPending}
                  submitLabel="Create"
                  onCancel={() => setCreatingTarget(null)}
                  onSubmit={(name) =>
                    createFolderMutation.mutate({
                      libraryId: library.id,
                      name,
                      parentId: null
                    })
                  }
                />
              ) : null}
              {roots.map((folder) => (
                <FolderTreeRow
                  activeFolderId={activeFolderId}
                  creatingTarget={creatingTarget}
                  editingFolderId={editingFolderId}
                  folder={folder}
                  key={folder.id}
                  level={0}
                  createError={createFolderMutation.isError ? "Folder could not be created." : null}
                  createPending={createFolderMutation.isPending}
                  editError={updateFolderMutation.isError ? "Folder could not be updated." : null}
                  editPending={updateFolderMutation.isPending}
                  onCancelCreate={() => setCreatingTarget(null)}
                  onCancelEdit={() => setEditingFolderId(null)}
                  onCreateFolder={(libraryId, parentId, name) =>
                    createFolderMutation.mutate({ libraryId, parentId, name })
                  }
                  onEditFolder={(folderId, name) => updateFolderMutation.mutate({ folderId, name })}
                  onOpenMenu={openFolderMenu}
                  onSelectFolder={onSelectFolder}
                />
              ))}
              {roots.length === 0 ? (
                <p className="m-0 px-3 py-1 text-xs font-bold text-[#9aa1ad]">No folders</p>
              ) : null}
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
  creatingTarget,
  editingFolderId,
  folder,
  level,
  createError,
  createPending,
  editError,
  editPending,
  onCancelCreate,
  onCancelEdit,
  onCreateFolder,
  onEditFolder,
  onOpenMenu,
  onSelectFolder
}: {
  activeFolderId: string | null;
  creatingTarget: { libraryId: string; parentId: string | null } | null;
  editingFolderId: string | null;
  folder: FolderNode;
  level: number;
  createError: string | null;
  createPending: boolean;
  editError: string | null;
  editPending: boolean;
  onCancelCreate: () => void;
  onCancelEdit: () => void;
  onCreateFolder: (libraryId: string, parentId: string, name: string) => void;
  onEditFolder: (folderId: string, name: string) => void;
  onOpenMenu: (folder: FolderItem, x: number, y: number) => void;
  onSelectFolder: (folderId: string) => void;
}) => {
  const isEditing = editingFolderId === folder.id;
  const isCreatingChild = creatingTarget?.parentId === folder.id;

  return (
    <Fragment>
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: `${level * 14}px` }}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenu(folder, event.clientX, event.clientY);
        }}
      >
        {isEditing ? (
          <InlineFolderForm
            defaultValue={folder.name}
            error={editError}
            isPending={editPending}
            submitLabel="Save"
            onCancel={onCancelEdit}
            onSubmit={(name) => onEditFolder(folder.id, name)}
          />
        ) : (
          <>
            <button
              className={[
                "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 text-left text-sm font-semibold outline-none hover:border-[#dfe4ef] hover:bg-white hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                activeFolderId === folder.id
                  ? "border-[#d8e7ff] bg-[#eef5ff] text-[#2f80ed]"
                  : "border-transparent text-[#697080]"
              ].join(" ")}
              type="button"
              onClick={() => onSelectFolder(folder.id)}
            >
              <IconFolder size={16} stroke={2.1} aria-hidden="true" focusable="false" />
              <span className="truncate">{folder.name}</span>
              {folder.bookmarkCount > 0 ? (
                <span className="ml-auto text-xs font-extrabold text-[#9aa1ad]">
                  {folder.bookmarkCount}
                </span>
              ) : null}
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#dfe4ef] hover:bg-white hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
              aria-label={`Folder actions for ${folder.name}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenMenu(folder, rect.left, rect.bottom + 4);
              }}
            >
              <IconDotsVertical size={17} stroke={2.2} aria-hidden="true" focusable="false" />
            </button>
          </>
        )}
      </div>
      {isCreatingChild ? (
        <div style={{ paddingLeft: `${(level + 1) * 14}px` }}>
          <InlineFolderForm
            error={createError}
            isPending={createPending}
            submitLabel="Create"
            onCancel={onCancelCreate}
            onSubmit={(name) => onCreateFolder(folder.libraryId, folder.id, name)}
          />
        </div>
      ) : null}
      {folder.children.map((child) => (
        <FolderTreeRow
          activeFolderId={activeFolderId}
          creatingTarget={creatingTarget}
          editingFolderId={editingFolderId}
          folder={child}
          key={child.id}
          level={level + 1}
          createError={createError}
          createPending={createPending}
          editError={editError}
          editPending={editPending}
          onCancelCreate={onCancelCreate}
          onCancelEdit={onCancelEdit}
          onCreateFolder={onCreateFolder}
          onEditFolder={onEditFolder}
          onOpenMenu={onOpenMenu}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </Fragment>
  );
};

const InlineFolderForm = ({
  defaultValue = "",
  error,
  isPending,
  submitLabel,
  onCancel,
  onSubmit
}: {
  defaultValue?: string;
  error: string | null;
  isPending: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(defaultValue);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="grid flex-1 gap-2 rounded-lg border border-[#dfe4ef] bg-white p-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmedName = name.trim();

        if (trimmedName) {
          onSubmit(trimmedName);
        }
      }}
    >
      <input
        className="min-h-9 rounded-lg border border-[#dfe4ef] bg-white px-2.5 text-sm font-semibold text-[#242833] outline-none placeholder:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]"
        aria-label="Folder title"
        name="name"
        placeholder="Folder title"
        ref={inputRef}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {error ? <p className="m-0 text-xs font-bold text-[#9a4d0a]">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          className="min-h-8 rounded-lg border border-[#dfe4ef] bg-white px-2.5 text-xs font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          disabled={isPending}
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="min-h-8 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-2.5 text-xs font-extrabold text-white outline-none hover:bg-[#2f80ed] disabled:cursor-not-allowed disabled:border-[#91bff8] disabled:bg-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
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
    className="fixed z-30 grid min-w-[190px] gap-1 rounded-lg border border-[#dfe4ef] bg-white p-1.5 text-sm font-bold text-[#4b5262] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
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
    <Icon size={16} stroke={2.2} aria-hidden="true" focusable="false" />
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
            <IconX size={17} stroke={2.2} aria-hidden="true" focusable="false" />
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
  const bookmarks = useInfiniteQuery({
    queryKey: ["bookmarks", folderId],
    queryFn: ({ pageParam }) => getBookmarks({ cursor: pageParam, folderId, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = bookmarks;
  const items = bookmarks.data?.pages.flatMap((page) => page.items) ?? [];

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
            stroke={2.2}
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
          <IconRefresh size={17} stroke={2.2} aria-hidden="true" focusable="false" />
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
          stroke={2.2}
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
    <section
      className="grid gap-3"
      aria-label={folderName ? `${folderName} items` : "Saved items"}
      aria-busy={bookmarks.isFetchingNextPage}
    >
      {items.map((item) => (
        <BookmarkRow item={item} key={item.id} />
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
  );
};

const BookmarkRow = ({ item }: { item: BookmarkItem }) => {
  const host = hostFromUrl(item.url);

  return (
    <article className="grid gap-3 rounded-lg border border-[#e4e7ef] bg-white p-4 shadow-[0_14px_40px_rgb(46_54_77_/_0.045)]">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-lg leading-[1.25] font-extrabold">
            {item.title || host || item.url}
          </h2>
          <a
            className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#2f80ed] no-underline hover:underline"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            <IconExternalLink size={15} stroke={2.2} aria-hidden="true" focusable="false" />
            <span className="truncate">{item.url}</span>
          </a>
        </div>
        <span className="flex w-fit items-center gap-1.5 rounded-lg border border-[#e7eaf1] bg-[#fbfcff] px-2.5 py-1 text-xs font-extrabold text-[#697080]">
          <IconFolder size={14} stroke={2.1} aria-hidden="true" focusable="false" />
          {item.folderName}
        </span>
      </div>
      {item.description ? (
        <p className="m-0 max-w-[74ch] text-sm leading-6 text-[#697080]">{item.description}</p>
      ) : null}
      <time className="text-xs font-bold text-[#858b9a]" dateTime={item.createdAt}>
        Added {formatBookmarkDate(item.createdAt)}
      </time>
    </article>
  );
};

const hostFromUrl = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
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
  const queryClient = useQueryClient();
  const addBookmark = useMutation({
    mutationFn: createBookmark,
    onSuccess: (bookmark) => {
      if (!visibleFolderId || bookmark.folderId === visibleFolderId) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
          ["bookmarks", visibleFolderId],
          (data) => insertBookmarkIntoPages(data, bookmark)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      formRef.current?.reset();
      onOpenChange(false);
    }
  });

  const submitBookmark = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const url = String(formData.get("url") ?? "");

    addBookmark.mutate({ folderId: targetFolder?.id, url });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (open) {
          addBookmark.reset();
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
            <IconX size={17} stroke={2.2} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form className="grid gap-4" ref={formRef} onSubmit={submitBookmark}>
            <label className="grid gap-2 text-sm font-bold" htmlFor="bookmark-url">
              Page URL
              <input
                className="min-h-11 rounded-lg border border-[#dfe4ef] bg-white px-3 text-base font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]"
                id="bookmark-url"
                name="url"
                placeholder="https://example.com/article"
                required
                type="url"
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

const insertBookmarkIntoPages = (
  data: InfiniteData<BookmarksPageResponse, string | null> | undefined,
  bookmark: BookmarkItem
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
    items: page.items.filter((item) => item.id !== bookmark.id)
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

const HealthSummary = ({
  health,
  isLoading,
  isError
}: {
  health?: HealthResponse;
  isLoading: boolean;
  isError: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-[#e4e7ef] bg-white px-3 py-2.5 text-[#858b9a] shadow-[0_10px_30px_rgb(46_54_77_/_0.06)] md:min-w-[260px]">
        <IconCircleCheck size={18} stroke={2} aria-hidden="true" focusable="false" />
        <span>Checking services</span>
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-[#f0b37e] bg-white px-3 py-2.5 shadow-[0_10px_30px_rgb(46_54_77_/_0.06)] md:min-w-[260px]">
        <IconAlertTriangle
          className="text-[#d97706]"
          size={18}
          stroke={2}
          aria-hidden="true"
          focusable="false"
        />
        <span>API unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={[
        "grid w-full min-w-0 gap-0.5 rounded-lg border bg-white px-3 py-2.5 shadow-[0_10px_30px_rgb(46_54_77_/_0.06)] md:min-w-[260px]",
        health.status === "ok" ? "border-[#3b8df5]" : "border-[#f0b37e]"
      ].join(" ")}
    >
      <span className="flex items-center gap-2 text-sm font-extrabold">
        {health.status === "ok" ? (
          <IconCircleCheck
            className="text-[#3b8df5]"
            size={18}
            stroke={2}
            aria-hidden="true"
            focusable="false"
          />
        ) : (
          <IconAlertTriangle
            className="text-[#d97706]"
            size={18}
            stroke={2}
            aria-hidden="true"
            focusable="false"
          />
        )}
        {health.status === "ok" ? "Healthy" : "Degraded"}
      </span>
      <small className="text-xs text-[#858b9a]">
        DB {health.services.database} · Queue {health.services.queue} · Search{" "}
        {health.services.search}
      </small>
    </div>
  );
};

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
