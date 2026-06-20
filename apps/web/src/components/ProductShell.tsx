import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FolderItem } from "@bookmarks/shared";
import {
  IconBookmark,
  IconDatabase,
  IconLayoutSidebarLeftExpand,
  IconLogout2
} from "@tabler/icons-react";
import { getCurrentUser, getFolders, logout } from "../api";
import { AddBookmarkDialog } from "../features/bookmarks/AddBookmarkDialog";
import { BookmarksWorkspace } from "../features/bookmarks/BookmarksWorkspace";
import { FolderSidebar } from "../features/folders/FolderSidebar";
import { folderPathSegments } from "../features/folders/folderTree";
import {
  DEFAULT_FOLDER_ICON_COLOR,
  getFolderIconComponent
} from "../features/folders/folderIcons";

const STACKED_SIDEBAR_BREAKPOINT = 768;

const isStackedSidebarViewport = () =>
  typeof window !== "undefined" && window.innerWidth < STACKED_SIDEBAR_BREAKPOINT;

export const ProductShell = () => {
  const queryClient = useQueryClient();
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
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
    }
  });
  const activeFolder = folders.data?.find((folder) => folder.id === activeFolderId) ?? null;
  const activeFolderPath = activeFolder ? folderPathSegments(activeFolder, folders.data ?? []) : [];

  const openBookmarkDialog = (folder: FolderItem | null) => {
    setBookmarkTargetFolder(folder);
    setBookmarkDialogOpen(true);
  };

  const selectFolder = (folderId: string | null) => {
    setActiveFolderId(folderId);

    if (isStackedSidebarViewport()) {
      setIsSidebarVisible(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-slate-950 md:flex md:h-screen md:overflow-hidden">
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 w-[min(300px,calc(100vw-48px))] overflow-hidden bg-gray-50 text-slate-950 transition-[transform,opacity] duration-300 ease-out md:static md:h-screen md:w-[300px] md:shrink-0",
          isSidebarVisible
            ? "translate-x-0 border-r border-gray-200 opacity-100 shadow-[16px_0_44px_rgb(15_23_42_/_0.14)] md:shadow-none"
            : "pointer-events-none -translate-x-full border-r-0 opacity-0 md:hidden"
        ].join(" ")}
        aria-label="Primary"
        aria-hidden={!isSidebarVisible}
      >
        <div className="h-full w-[min(300px,calc(100vw-48px))] min-w-0 overflow-y-auto px-3 py-3 md:w-[300px] md:px-4 md:py-4">
          <FolderSidebar
            activeFolderId={activeFolderId}
            currentUser={currentUser.data}
            folders={folders.data ?? []}
            isError={folders.isError}
            isLoading={folders.isLoading}
            onAddBookmark={openBookmarkDialog}
            onHideSidebar={() => setIsSidebarVisible(false)}
            onSelectFolder={selectFolder}
          />
        </div>
      </aside>

      <section
        className="flex min-w-0 flex-col gap-5 p-5 md:h-screen md:flex-1 md:overflow-y-auto md:p-7"
        aria-label="Items workspace"
      >
        <header className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
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
          ) : (
            <span className="h-10 w-10" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <FolderBreadcrumbs folders={activeFolderPath} />
          </div>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-slate-950 outline-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label="Log out"
            title="Log out"
            type="button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            <IconLogout2 size={22} stroke={1.5} aria-hidden="true" focusable="false" />
          </button>
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

const FolderBreadcrumbs = ({ folders }: { folders: FolderItem[] }) => {
  const label = folders.length > 0 ? folders.map((folder) => folder.name).join(" / ") : "Inbox";

  return (
    <h1
      className="m-0 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5 font-semibold"
      aria-label={label}
    >
      <IconDatabase
        className="shrink-0 text-gray-500"
        size={16}
        stroke={1.5}
        aria-hidden="true"
        focusable="false"
      />
      <BreadcrumbSeparator />
      {folders.length > 0 ? (
        folders.map((folder, index) => (
          <BreadcrumbFolder folder={folder} key={folder.id} isLast={index === folders.length - 1} />
        ))
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1">
          <IconBookmark
            className="shrink-0 text-[#3b8df5]"
            size={16}
            stroke={1.5}
            aria-hidden="true"
            focusable="false"
          />
          <span className="min-w-0 truncate">Inbox</span>
        </span>
      )}
    </h1>
  );
};

const BreadcrumbFolder = ({ folder, isLast }: { folder: FolderItem; isLast: boolean }) => {
  const FolderIcon = getFolderIconComponent(folder.iconName);

  return (
    <>
      <span className="inline-flex min-w-0 items-center gap-1">
        <FolderIcon
          className="shrink-0"
          size={16}
          stroke={1.5}
          color={folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR}
          aria-hidden="true"
          focusable="false"
        />
        <span className="min-w-0 truncate">{folder.name}</span>
      </span>
      {isLast ? null : <BreadcrumbSeparator />}
    </>
  );
};

const BreadcrumbSeparator = () => (
  <span className="shrink-0 text-sm leading-none font-medium text-gray-300" aria-hidden="true">
    /
  </span>
);
