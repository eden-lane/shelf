import { type CSSProperties, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CurrentUserResponse, FolderItem } from "@bookmarks/shared";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { getCurrentUser, getFolders } from "../api";
import { AddBookmarkDialog } from "../features/bookmarks/AddBookmarkDialog";
import { BookmarksWorkspace } from "../features/bookmarks/BookmarksWorkspace";
import { FolderSidebar } from "../features/folders/FolderSidebar";

export const ProductShell = () => {
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
