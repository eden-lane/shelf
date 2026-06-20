import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { FolderItem } from "@bookmarks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconX } from "@tabler/icons-react";
import { deleteFolder } from "../../api";
import { collectFolderSubtreeIds, folderPath } from "./folderTree";

export const DeleteFolderDialog = ({
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
