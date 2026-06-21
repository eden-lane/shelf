import { Dialog } from "@base-ui/react/dialog";
import type { TagItem } from "@bookmarks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconX } from "@tabler/icons-react";
import { deleteTag } from "../../api";

export const DeleteTagDialog = ({
  tag,
  onClose,
  onDeleted
}: {
  tag: TagItem | null;
  onClose: () => void;
  onDeleted: (deletedTagId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const deleteTagMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: (result) => {
      queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) =>
        currentTags.filter((currentTag) => currentTag.id !== result.deletedTagId)
      );
      onDeleted(result.deletedTagId);
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
      onClose();
    }
  });

  if (!tag) {
    return null;
  }

  return (
    <Dialog.Root open={Boolean(tag)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-32px),420px)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-lg border border-[#e4e7ef] bg-white p-5 text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none">
          <div className="grid gap-1 pr-9">
            <Dialog.Title className="text-lg leading-[1.25] font-extrabold">
              Delete {tag.name}
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              This removes the tag from saved bookmarks. The bookmarks will stay in your library.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
            aria-label="Close delete tag dialog"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              deleteTagMutation.mutate({ tagId: tag.id });
            }}
          >
            {deleteTagMutation.isError ? (
              <p className="m-0 rounded-lg border border-[#f0b37e] bg-[#fff8f1] px-3 py-2 text-sm font-bold text-[#9a4d0a]">
                Tag could not be deleted.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close
                className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                disabled={deleteTagMutation.isPending}
                type="button"
              >
                Cancel
              </Dialog.Close>
              <button
                className="min-h-10 rounded-lg border border-[#b42318] bg-[#b42318] px-3 text-sm font-extrabold text-white outline-none hover:bg-[#961b12] disabled:cursor-not-allowed disabled:border-[#e7a6a0] disabled:bg-[#e7a6a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                disabled={deleteTagMutation.isPending}
                type="submit"
              >
                {deleteTagMutation.isPending ? "Deleting" : "Delete tag"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
