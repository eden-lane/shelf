import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SavedItem, SavedItemsPageResponse, FolderItem, TagItem } from "@shelf/shared";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { createSavedItem, createTag } from "../../api";
import {
  savedItemQueryKey,
  savedItemQueryKeysForFolder,
  savedItemQueryKeysForTag,
  insertSavedItemIntoPages,
  isValidSavedItemUrl
} from "./savedItemUtils";

export const AddSavedItemDialog = ({
  isOpen,
  targetFolder,
  targetLibraryId,
  targetTagId,
  tags,
  visibleFolderId,
  visibleLibraryId,
  visibleTagId,
  onOpenChange
}: {
  isOpen: boolean;
  targetFolder: FolderItem | null;
  targetLibraryId: string | null;
  targetTagId: string | null;
  tags: TagItem[];
  visibleFolderId: string | null;
  visibleLibraryId: string | null;
  visibleTagId: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [isUrlInvalid, setIsUrlInvalid] = useState(false);
  const [isUrlShaking, setIsUrlShaking] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [selectedTagOptions, setSelectedTagOptions] = useState<TagComboboxOption[]>([]);
  const queryClient = useQueryClient();
  const visibleTags = useMemo(
    () =>
      targetFolder
        ? tags.filter((tag) => tag.libraryId === targetFolder.libraryId)
        : targetLibraryId
          ? tags.filter((tag) => tag.libraryId === targetLibraryId)
          : tags,
    [tags, targetFolder, targetLibraryId]
  );
  const selectedExistingTagIds = new Set(
    selectedTagOptions.flatMap((option) => (option.kind === "existing" ? [option.tag.id] : []))
  );
  const selectedNewTagNames = new Set(
    selectedTagOptions.flatMap((option) => (option.kind === "new" ? [normalizeTagName(option.name)] : []))
  );
  const normalizedTagInput = normalizeTagName(tagInputValue);
  const findMatchingVisibleTag = (tagName: string) =>
    visibleTags.find((tag) => normalizeTagName(tag.name).toLowerCase() === tagName.toLowerCase());
  const matchingExistingTag = findMatchingVisibleTag(normalizedTagInput);
  const canCreateTag =
    normalizedTagInput.length > 0 &&
    !matchingExistingTag &&
    !selectedNewTagNames.has(normalizedTagInput);
  const tagOptions = [
    ...visibleTags
      .filter((tag) => !selectedExistingTagIds.has(tag.id))
      .map((tag): TagComboboxOption => ({ kind: "existing", tag })),
    ...(canCreateTag ? [{ kind: "create", name: normalizedTagInput } satisfies TagComboboxOption] : [])
  ];
  const addSavedItem = useMutation({
    mutationFn: async ({
      existingTagIds,
      newTagNames,
      optimisticFolder: _optimisticFolder,
      ...input
    }: AddSavedItemMutationInput) => {
      if (newTagNames.length > 0 && !input.libraryId) {
        throw new Error("A library is required to create tags");
      }

      const createdTags = await Promise.all(
        newTagNames.map((name) => createTag({ libraryId: input.libraryId as string, name }))
      );
      const tagIds = [...existingTagIds, ...createdTags.map((tag) => tag.id)];

      return createSavedItem({
        folderId: input.folderId,
        libraryId: input.folderId ? undefined : input.libraryId,
        tagIds,
        url: input.url
      });
    },
    onMutate: async (input) => {
      const optimisticFolder = input.optimisticFolder;

      if (!optimisticFolder) {
        return { targetFolderId: null };
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["savedItems"] }),
        queryClient.cancelQueries({ queryKey: ["folders"] }),
        queryClient.cancelQueries({ queryKey: ["tags"] })
      ]);

      const savedItemQueryKeys = savedItemQueryKeysForFolder(
        optimisticFolder.id,
        optimisticFolder.libraryId
      );
      const previousSavedItems = savedItemQueryKeys.map((queryKey) => ({
        data: queryClient.getQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(queryKey),
        hadData: Boolean(queryClient.getQueryState(queryKey)),
        queryKey
      }));
      const previousFolders = queryClient.getQueryData<FolderItem[]>(["folders"]);
      const previousTags = queryClient.getQueryData<TagItem[]>(["tags"]);
      const now = new Date().toISOString();
      const optimisticSavedItem: SavedItem = {
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

      for (const queryKey of savedItemQueryKeys) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(queryKey, (data) =>
          insertSavedItemIntoPages(data, optimisticSavedItem)
        );
      }

      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) =>
        currentFolders.map((folder) =>
          folder.id === optimisticFolder.id
            ? { ...folder, savedItemCount: folder.savedItemCount + 1, updatedAt: now }
            : folder
        )
      );

      if (input.existingTagIds.length > 0) {
        const selectedTagIds = new Set(input.existingTagIds);

        queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) =>
          currentTags.map((tag) =>
            selectedTagIds.has(tag.id)
              ? { ...tag, savedItemCount: tag.savedItemCount + 1, updatedAt: now }
              : tag
          )
        );
      }

      return {
        optimisticSavedItemId: optimisticSavedItem.id,
        previousSavedItems,
        previousFolders,
        previousTags,
        targetFolderId: optimisticFolder.id
      };
    },
    onError: (_error, _input, context) => {
      for (const previousSavedItem of context?.previousSavedItems ?? []) {
        if (previousSavedItem.hadData) {
          queryClient.setQueryData(previousSavedItem.queryKey, previousSavedItem.data);
        } else {
          queryClient.removeQueries({ exact: true, queryKey: previousSavedItem.queryKey });
        }
      }

      if (context?.previousFolders) {
        queryClient.setQueryData(["folders"], context.previousFolders);
      }

      if (context?.previousTags) {
        queryClient.setQueryData(["tags"], context.previousTags);
      }
    },
    onSuccess: (savedItem, _input, context) => {
      if (
        !visibleTagId &&
        savedItem.folderId === visibleFolderId &&
        (!visibleLibraryId || savedItem.libraryId === visibleLibraryId)
      ) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
          savedItemQueryKey({ folderId: visibleFolderId, libraryId: visibleLibraryId, tagId: null }),
          (data) => insertSavedItemIntoPages(data, savedItem, context?.optimisticSavedItemId)
        );
      }

      if (
        visibleTagId &&
        _input.existingTagIds.includes(visibleTagId) &&
        (!visibleLibraryId || savedItem.libraryId === visibleLibraryId)
      ) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
          savedItemQueryKey({ folderId: null, libraryId: visibleLibraryId, tagId: visibleTagId }),
          (data) => insertSavedItemIntoPages(data, savedItem, context?.optimisticSavedItemId)
        );
      }

      formRef.current?.reset();
      setSelectedTagOptions([]);
      setTagInputValue("");
      setIsUrlInvalid(false);
      setIsUrlShaking(false);
      onOpenChange(false);
    },
    onSettled: (savedItem, _error, input, context) => {
      const targetFolderId =
        savedItem?.folderId ?? context?.targetFolderId ?? input.optimisticFolder?.id ?? null;
      const targetLibraryId = savedItem?.libraryId ?? input.optimisticFolder?.libraryId ?? visibleLibraryId;

      if (savedItem && context?.optimisticSavedItemId) {
        for (const queryKey of savedItemQueryKeysForFolder(savedItem.folderId, savedItem.libraryId)) {
          queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
            queryKey,
            (data) => insertSavedItemIntoPages(data, savedItem, context.optimisticSavedItemId)
          );
        }
      }

      void queryClient.invalidateQueries({
        exact: true,
        queryKey: savedItemQueryKey({ folderId: null, libraryId: visibleLibraryId, tagId: null })
      });

      if (targetFolderId) {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: savedItemQueryKey({
            folderId: targetFolderId,
            libraryId: targetLibraryId,
            tagId: null
          })
        });
      }

      for (const tagId of input.existingTagIds) {
        for (const queryKey of savedItemQueryKeysForTag(tagId, visibleLibraryId)) {
          void queryClient.invalidateQueries({ exact: true, queryKey });
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    }
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const targetTag = targetTagId ? visibleTags.find((tag) => tag.id === targetTagId) : null;
    setSelectedTagOptions(targetTag ? [{ kind: "existing", tag: targetTag }] : []);
    setTagInputValue("");
  }, [isOpen, targetTagId, visibleTags]);

  const selectTypedTag = (rawTagName = tagInputRef.current?.value ?? tagInputValue) => {
    const tagName = normalizeTagName(rawTagName);
    const existingTag = findMatchingVisibleTag(tagName);

    if (!tagName) {
      return false;
    }

    if (existingTag) {
      if (!selectedExistingTagIds.has(existingTag.id)) {
        setSelectedTagOptions((current) => [
          ...current,
          { kind: "existing", tag: existingTag }
        ]);
      }
      setTagInputValue("");
      return true;
    }

    if (!selectedNewTagNames.has(tagName)) {
      setSelectedTagOptions((current) => [...current, { kind: "new", name: tagName }]);
    }
    setTagInputValue("");
    return true;
  };

  const handleTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const tagName = normalizeTagName(event.currentTarget.value);

    if (event.key !== "Enter" || !tagName) {
      return;
    }

    if (selectTypedTag(tagName)) {
      event.preventDefault();
    }
  };

  const submitSavedItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const url = (urlInputRef.current?.value ?? String(formData.get("url") ?? "")).trim();

    if (!isValidSavedItemUrl(url)) {
      setIsUrlInvalid(true);
      setIsUrlShaking(false);
      requestAnimationFrame(() => setIsUrlShaking(true));
      urlInputRef.current?.focus();
      return;
    }

    const pendingTagName = normalizeTagName(tagInputRef.current?.value ?? tagInputValue);
    const pendingExistingTag = pendingTagName ? findMatchingVisibleTag(pendingTagName) : undefined;

    selectTypedTag(pendingTagName);

    const currentSelectedTags = pendingTagName
      ? mergeTagOptionsForSubmit(
          selectedTagOptions,
          pendingExistingTag
            ? { kind: "existing", tag: pendingExistingTag }
            : { kind: "new", name: pendingTagName }
        )
      : selectedTagOptions;
    const existingTagIds = currentSelectedTags.flatMap((option) =>
      option.kind === "existing" ? [option.tag.id] : []
    );
    const newTagNames = currentSelectedTags.flatMap((option) =>
      option.kind === "new" ? [option.name] : []
    );

    addSavedItem.mutate({
      existingTagIds,
      folderId: targetFolder?.id,
      libraryId: targetFolder?.libraryId ?? targetLibraryId ?? undefined,
      newTagNames,
      optimisticFolder: targetFolder,
      url
    });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (open) {
          addSavedItem.reset();
          setTagInputValue("");
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
              {targetFolder ? `Add to ${targetFolder.name}` : "Add saved item"}
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              Paste the page link you want to save.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:top-[calc(1rem+env(safe-area-inset-top))]"
            aria-label="Close add saved item dialog"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form
            className="grid min-h-0 gap-4 max-md:grid-rows-[minmax(0,1fr)_auto]"
            ref={formRef}
            noValidate
            onSubmit={submitSavedItem}
          >
            <div className="grid min-h-0 content-start gap-4 overflow-y-auto overscroll-contain max-md:px-4 max-md:py-4">
              <label className="grid gap-2 text-sm font-bold" htmlFor="savedItem-url">
                Page URL
                <input
                  className={[
                    "min-h-11 rounded-lg border bg-white px-3 text-base font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]",
                    isUrlInvalid ? "border-[#ef4444] ring-3 ring-[#fee2e2]" : "border-[#dfe4ef]",
                    isUrlShaking ? "field-shake" : ""
                  ].join(" ")}
                  aria-invalid={isUrlInvalid}
                  id="savedItem-url"
                  inputMode="url"
                  name="url"
                  placeholder="https://example.com/article"
                  ref={urlInputRef}
                  type="text"
                  onAnimationEnd={() => setIsUrlShaking(false)}
                  onChange={(event) => {
                    if (isValidSavedItemUrl(event.target.value.trim())) {
                      setIsUrlInvalid(false);
                    }
                  }}
                  onInput={(event) => {
                    if (isValidSavedItemUrl(event.currentTarget.value.trim())) {
                      setIsUrlInvalid(false);
                    }
                  }}
                />
              </label>
              <div className="grid gap-2 text-sm font-bold">
                <label htmlFor="savedItem-tags">Tags</label>
                <Combobox.Root<TagComboboxOption, true>
                  items={tagOptions}
                  multiple
                  value={selectedTagOptions}
                  autoHighlight
                  itemToStringLabel={getTagOptionLabel}
                  itemToStringValue={getTagOptionValue}
                  isItemEqualToValue={isTagOptionEqual}
                  onInputValueChange={setTagInputValue}
                  onValueChange={(nextValue) => {
                    setSelectedTagOptions(normalizeSelectedTagOptions(nextValue));
                    setTagInputValue("");
                  }}
                >
                  <Combobox.InputGroup className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1 rounded-lg border border-[#dfe4ef] bg-white px-2 py-1.5 text-[#242833] outline-none focus-within:border-[#3b8df5] focus-within:ring-3 focus-within:ring-[#d9eaff] has-[button]:px-1">
                    <Combobox.Chips className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                      <Combobox.Value>
                        {(value: TagComboboxOption[]) => (
                          <>
                            {value.map((option) => (
                              <Combobox.Chip
                                className="group flex min-h-7 max-w-full cursor-default items-center gap-1.5 overflow-hidden rounded-md border border-[#dfe4ef] bg-[#f7f8fc] py-0 pr-1 pl-2 text-sm font-bold text-[#4b5262] outline-none focus-within:border-[#3b8df5] focus-within:ring-2 focus-within:ring-[#d9eaff] data-highlighted:border-[#3b8df5]"
                                aria-label={getTagOptionLabel(option)}
                                key={getTagOptionValue(option)}
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      option.kind === "existing" ? (option.tag.color ?? "#697080") : "#9aa1ad"
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 truncate">{getTagOptionLabel(option)}</span>
                                <Combobox.ChipRemove
                                  className="grid h-5 w-5 shrink-0 place-items-center rounded border-0 bg-transparent p-0 text-[#697080] outline-none hover:bg-[#e9edf5] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#3b8df5]"
                                  aria-label={`Remove ${getTagOptionLabel(option)}`}
                                  type="button"
                                >
                                  <IconX size={13} stroke={1.8} aria-hidden="true" focusable="false" />
                                </Combobox.ChipRemove>
                              </Combobox.Chip>
                            ))}
                            <Combobox.Input
                              className="h-7 min-w-24 flex-1 border-0 bg-transparent p-0 text-base font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad] md:text-sm"
                              autoComplete="off"
                              id="savedItem-tags"
                              placeholder={value.length > 0 ? "" : "Type a tag"}
                              ref={tagInputRef}
                              value={tagInputValue}
                              onChange={(event) => setTagInputValue(event.currentTarget.value)}
                              onKeyDown={handleTagInputKeyDown}
                            />
                          </>
                        )}
                      </Combobox.Value>
                    </Combobox.Chips>
                  </Combobox.InputGroup>
                  <Combobox.Portal>
                    <Combobox.Positioner className="z-[80] outline-none" sideOffset={4}>
                      <Combobox.Popup className="max-h-[min(260px,var(--available-height))] w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-y-auto overscroll-contain rounded-lg border border-[#dfe4ef] bg-white py-1 text-[#242833] shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none">
                        <Combobox.Empty>
                          <div className="px-3 py-2 text-sm font-bold text-[#697080]">
                            Type a tag name to create it.
                          </div>
                        </Combobox.Empty>
                        <Combobox.List>
                          {(option: TagComboboxOption, index: number) => (
                            <Combobox.Item
                              className="grid min-h-10 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-sm font-bold text-[#4b5262] outline-none select-none data-highlighted:bg-[#f0f6ff] data-highlighted:text-[#242833] data-selected:text-[#242833]"
                              index={index}
                              key={getTagOptionValue(option)}
                              value={option}
                            >
                              <Combobox.ItemIndicator className="col-start-1 text-[#3b8df5]">
                                <IconCheck size={15} stroke={1.8} aria-hidden="true" focusable="false" />
                              </Combobox.ItemIndicator>
                              <span className="col-start-2 flex min-w-0 items-center gap-2">
                                {option.kind === "existing" ? (
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: option.tag.color ?? "#697080" }}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <IconPlus
                                    className="shrink-0 text-[#3b8df5]"
                                    size={15}
                                    stroke={1.8}
                                    aria-hidden="true"
                                    focusable="false"
                                  />
                                )}
                                <span className="min-w-0 truncate">
                                  {option.kind === "existing" ? option.tag.name : `Create "${option.name}"`}
                                </span>
                              </span>
                            </Combobox.Item>
                          )}
                        </Combobox.List>
                      </Combobox.Popup>
                    </Combobox.Positioner>
                  </Combobox.Portal>
                </Combobox.Root>
              </div>
              {addSavedItem.isError ? (
                <p className="m-0 rounded-lg border border-[#f0b37e] bg-[#fff8f1] px-3 py-2 text-sm font-bold text-[#9a4d0a]">
                  Saved item could not be saved.
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 max-md:border-t max-md:border-[#eef1f6] max-md:bg-white max-md:px-4 max-md:pt-3 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Dialog.Close
                className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:flex-1"
                disabled={addSavedItem.isPending}
                type="button"
              >
                Cancel
              </Dialog.Close>
              <button
                className="min-h-10 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-3 text-sm font-extrabold text-white outline-none hover:bg-[#2f80ed] disabled:cursor-not-allowed disabled:border-[#91bff8] disabled:bg-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:flex-1"
                disabled={addSavedItem.isPending}
                type="submit"
              >
                {addSavedItem.isPending ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

type AddSavedItemMutationInput = {
  existingTagIds: string[];
  folderId?: string;
  libraryId?: string;
  newTagNames: string[];
  optimisticFolder: FolderItem | null;
  url: string;
};

type ExistingTagOption = {
  kind: "existing";
  tag: TagItem;
};

type NewTagOption = {
  kind: "new";
  name: string;
};

type CreateTagOption = {
  kind: "create";
  name: string;
};

type TagComboboxOption = ExistingTagOption | NewTagOption | CreateTagOption;

const normalizeTagName = (name: string) => name.trim().replace(/\s+/g, " ");

const getTagOptionLabel = (option: TagComboboxOption) =>
  option.kind === "existing" ? option.tag.name : option.name;

const getTagOptionValue = (option: TagComboboxOption) =>
  option.kind === "existing" ? `existing:${option.tag.id}` : `${option.kind}:${option.name.toLowerCase()}`;

const isTagOptionEqual = (itemValue: TagComboboxOption, value: TagComboboxOption) =>
  getTagOptionValue(itemValue) === getTagOptionValue(value);

const normalizeSelectedTagOptions = (options: TagComboboxOption[]) => {
  const selectedOptions: TagComboboxOption[] = [];
  const selectedKeys = new Set<string>();

  for (const option of options) {
    const selectedOption: TagComboboxOption =
      option.kind === "create" ? { kind: "new", name: option.name } : option;
    const key = getTagOptionValue(selectedOption);

    if (!selectedKeys.has(key)) {
      selectedKeys.add(key);
      selectedOptions.push(selectedOption);
    }
  }

  return selectedOptions;
};

const mergeTagOptionsForSubmit = (
  options: TagComboboxOption[],
  option: ExistingTagOption | NewTagOption
) => normalizeSelectedTagOptions([...options, option]);
