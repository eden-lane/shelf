import { type FormEvent, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookmarkItem, BookmarksPageResponse, FolderItem, TagItem } from "@bookmarks/shared";
import { IconX } from "@tabler/icons-react";
import { createBookmark } from "../../api";
import {
  bookmarkQueryKey,
  bookmarkQueryKeysForFolder,
  bookmarkQueryKeysForTag,
  insertBookmarkIntoPages,
  isValidBookmarkUrl
} from "./bookmarkUtils";

export const AddBookmarkDialog = ({
  isOpen,
  targetFolder,
  targetLibraryId,
  targetTagId,
  tags,
  visibleFolderId,
  visibleTagId,
  onOpenChange
}: {
  isOpen: boolean;
  targetFolder: FolderItem | null;
  targetLibraryId: string | null;
  targetTagId: string | null;
  tags: TagItem[];
  visibleFolderId: string | null;
  visibleTagId: string | null;
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
        queryClient.cancelQueries({ queryKey: ["folders"] }),
        queryClient.cancelQueries({ queryKey: ["tags"] })
      ]);

      const bookmarkQueryKeys = bookmarkQueryKeysForFolder(optimisticFolder.id);
      const previousBookmarks = bookmarkQueryKeys.map((queryKey) => ({
        data: queryClient.getQueryData<InfiniteData<BookmarksPageResponse, string | null>>(queryKey),
        hadData: Boolean(queryClient.getQueryState(queryKey)),
        queryKey
      }));
      const previousFolders = queryClient.getQueryData<FolderItem[]>(["folders"]);
      const previousTags = queryClient.getQueryData<TagItem[]>(["tags"]);
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

      if (input.tagIds.length > 0) {
        const selectedTagIds = new Set(input.tagIds);

        queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) =>
          currentTags.map((tag) =>
            selectedTagIds.has(tag.id)
              ? { ...tag, bookmarkCount: tag.bookmarkCount + 1, updatedAt: now }
              : tag
          )
        );
      }

      return {
        optimisticBookmarkId: optimisticBookmark.id,
        previousBookmarks,
        previousFolders,
        previousTags,
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

      if (context?.previousTags) {
        queryClient.setQueryData(["tags"], context.previousTags);
      }
    },
    onSuccess: (bookmark, _input, context) => {
      if (!visibleTagId && (!visibleFolderId || bookmark.folderId === visibleFolderId)) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
          bookmarkQueryKey({ folderId: visibleFolderId, tagId: null }),
          (data) => insertBookmarkIntoPages(data, bookmark, context?.optimisticBookmarkId)
        );
      }

      if (visibleTagId && _input.tagIds.includes(visibleTagId)) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
          bookmarkQueryKey({ folderId: null, tagId: visibleTagId }),
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

      void queryClient.invalidateQueries({
        exact: true,
        queryKey: bookmarkQueryKey({ folderId: null, tagId: null })
      });

      if (targetFolderId) {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: bookmarkQueryKey({ folderId: targetFolderId, tagId: null })
        });
      }

      for (const tagId of input.tagIds) {
        for (const queryKey of bookmarkQueryKeysForTag(tagId)) {
          void queryClient.invalidateQueries({ exact: true, queryKey });
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
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

    const tagIds = formData
      .getAll("tagIds")
      .map((tagId) => String(tagId))
      .filter(Boolean);

    addBookmark.mutate({
      folderId: targetFolder?.id,
      libraryId: targetFolder ? undefined : (targetLibraryId ?? undefined),
      optimisticFolder: targetFolder,
      tagIds,
      url
    });
  };

  const visibleTags = targetFolder
    ? tags.filter((tag) => tag.libraryId === targetFolder.libraryId)
    : targetLibraryId
      ? tags.filter((tag) => tag.libraryId === targetLibraryId)
      : tags;

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
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-32px),420px)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)] gap-5 rounded-lg border border-[#e4e7ef] bg-white p-5 text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-screen max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:p-0 max-md:shadow-none">
          <div className="grid gap-1 pr-9 max-md:border-b max-md:border-[#eef1f6] max-md:px-4 max-md:pt-[calc(1rem+env(safe-area-inset-top))] max-md:pb-3">
            <Dialog.Title className="text-lg leading-[1.25] font-extrabold">
              {targetFolder ? `Add to ${targetFolder.name}` : "Add bookmark"}
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              Paste the page link you want to save.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:top-[calc(1rem+env(safe-area-inset-top))]"
            aria-label="Close add bookmark dialog"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form
            className="grid min-h-0 gap-4 max-md:grid-rows-[minmax(0,1fr)_auto]"
            ref={formRef}
            noValidate
            onSubmit={submitBookmark}
          >
            <div className="grid min-h-0 content-start gap-4 overflow-y-auto overscroll-contain max-md:px-4 max-md:py-4">
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
              {visibleTags.length > 0 ? (
                <fieldset className="grid gap-2 rounded-lg border border-[#dfe4ef] p-3">
                  <legend className="px-1 text-sm font-bold text-[#242833]">Tags</legend>
                  <div className="flex flex-wrap gap-2">
                    {visibleTags.map((tag) => (
                      <label
                        className="flex min-h-8 items-center gap-2 rounded-lg border border-[#dfe4ef] bg-white px-2 text-sm font-bold text-[#4b5262]"
                        key={tag.id}
                      >
                        <input
                          className="h-4 w-4 accent-[#3b8df5]"
                          defaultChecked={tag.id === targetTagId}
                          name="tagIds"
                          type="checkbox"
                          value={tag.id}
                        />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color ?? "#697080" }}
                          aria-hidden="true"
                        />
                        <span>{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {addBookmark.isError ? (
                <p className="m-0 rounded-lg border border-[#f0b37e] bg-[#fff8f1] px-3 py-2 text-sm font-bold text-[#9a4d0a]">
                  Bookmark could not be saved.
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 max-md:border-t max-md:border-[#eef1f6] max-md:bg-white max-md:px-4 max-md:pt-3 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Dialog.Close
                className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:flex-1"
                disabled={addBookmark.isPending}
                type="button"
              >
                Cancel
              </Dialog.Close>
              <button
                className="min-h-10 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-3 text-sm font-extrabold text-white outline-none hover:bg-[#2f80ed] disabled:cursor-not-allowed disabled:border-[#91bff8] disabled:bg-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:flex-1"
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
  libraryId?: string;
  optimisticFolder: FolderItem | null;
  tagIds: string[];
  url: string;
};
