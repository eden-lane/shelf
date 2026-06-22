import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SavedItem, SavedItemsPageResponse, FolderItem, TagItem } from "@shelf/shared";
import {
  IconCheck,
  IconChevronDown,
  IconInbox,
  IconPlus,
  IconSearch,
  IconTag,
  IconTags,
  IconX
} from "@tabler/icons-react";
import { createSavedItem, createTag, getSavedItemPreview } from "../../api";
import { buildFolderTree, folderPath } from "../folders/folderTree";
import {
  DEFAULT_FOLDER_ICON_COLOR,
  getFolderIconComponent
} from "../folders/folderIcons";
import type { FolderNode } from "../folders/types";
import {
  savedItemQueryKey,
  savedItemQueryKeysForFolder,
  savedItemQueryKeysForTag,
  insertSavedItemIntoPages,
  isValidSavedItemUrl
} from "./savedItemUtils";

export const AddSavedItemDialog = ({
  folders,
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
  folders: FolderItem[];
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
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const folderSearchInputRef = useRef<HTMLInputElement | null>(null);
  const tagSearchInputRef = useRef<HTMLInputElement | null>(null);
  const previewRequestIdRef = useRef(0);
  const descriptionEditVersionRef = useRef(0);
  const lastPreviewUrlRef = useRef<string | null>(null);
  const [isUrlInvalid, setIsUrlInvalid] = useState(false);
  const [isUrlShaking, setIsUrlShaking] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [isDescriptionPreviewLoading, setIsDescriptionPreviewLoading] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderSearchValue, setFolderSearchValue] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [selectedTagOptions, setSelectedTagOptions] = useState<TagComboboxOption[]>([]);
  const queryClient = useQueryClient();
  const selectedFolder = selectedFolderId
    ? (folders.find((folder) => folder.id === selectedFolderId) ?? null)
    : null;
  const baseLibraryId = targetFolder?.libraryId ?? targetLibraryId ?? null;
  const selectedLibraryId = selectedFolder?.libraryId ?? baseLibraryId;
  const visibleFolders = useMemo(
    () =>
      selectedLibraryId
        ? folders.filter((folder) => folder.libraryId === selectedLibraryId)
        : folders,
    [folders, selectedLibraryId]
  );
  const visibleTags = useMemo(
    () => (selectedLibraryId ? tags.filter((tag) => tag.libraryId === selectedLibraryId) : tags),
    [tags, selectedLibraryId]
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
  const tagSearchNeedle = normalizedTagInput.toLowerCase();
  const tagOptions = [
    ...visibleTags
      .filter(
        (tag) =>
          !tagSearchNeedle ||
          normalizeTagName(tag.name).toLowerCase().includes(tagSearchNeedle)
      )
      .map((tag): TagComboboxOption => ({ kind: "existing", tag })),
    ...(canCreateTag ? [{ kind: "create", name: normalizedTagInput } satisfies TagComboboxOption] : [])
  ];
  const displayedTagOptions = normalizeSelectedTagOptions([
    ...selectedTagOptions.filter((option) =>
      tagSearchNeedle ? getTagOptionLabel(option).toLowerCase().includes(tagSearchNeedle) : true
    ),
    ...tagOptions
  ]);
  const selectedFolderLabel = selectedFolder ? selectedFolder.name : "Inbox";
  const SelectedFolderIcon = selectedFolder
    ? getFolderIconComponent(selectedFolder.iconName)
    : IconInbox;
  const selectedFolderIconColor = selectedFolder
    ? (selectedFolder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR)
    : "#697080";
  const selectedTagLabel =
    selectedTagOptions.length === 0
      ? "Tags"
      : selectedTagOptions.length === 1
        ? getTagOptionLabel(selectedTagOptions[0])
        : `${selectedTagOptions.length} tags`;
  const normalizedFolderSearch = normalizeSearchValue(folderSearchValue);
  const folderOptions = buildFolderPickerOptions(visibleFolders, selectedLibraryId);
  const displayedFolderOptions = folderOptions.filter((option) =>
    normalizeSearchValue(getFolderOptionSearchText(option)).includes(normalizedFolderSearch)
  );
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
        description: input.description,
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
        description: input.description,
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
      setSelectedFolderId(targetFolder?.id ?? null);
      setSelectedTagOptions([]);
      setDescriptionValue("");
      setIsDescriptionPreviewLoading(false);
      descriptionEditVersionRef.current = 0;
      previewRequestIdRef.current += 1;
      setFolderPickerOpen(false);
      setFolderSearchValue("");
      setTagPickerOpen(false);
      setTagInputValue("");
      lastPreviewUrlRef.current = null;
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
    setSelectedFolderId(targetFolder?.id ?? null);
    setSelectedTagOptions(targetTag ? [{ kind: "existing", tag: targetTag }] : []);
    setDescriptionValue("");
    setIsDescriptionPreviewLoading(false);
    descriptionEditVersionRef.current = 0;
    previewRequestIdRef.current += 1;
    setFolderPickerOpen(false);
    setFolderSearchValue("");
    setTagPickerOpen(false);
    setTagInputValue("");
    lastPreviewUrlRef.current = null;
  }, [isOpen, targetFolder, targetTagId, visibleTags]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusHandle = requestAnimationFrame(() => {
      urlInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(focusHandle);
  }, [isOpen]);

  useEffect(() => {
    if (!folderPickerOpen) {
      return;
    }

    const focusHandle = requestAnimationFrame(() => {
      folderSearchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(focusHandle);
  }, [folderPickerOpen]);

  useEffect(() => {
    if (!tagPickerOpen) {
      return;
    }

    const focusHandle = requestAnimationFrame(() => {
      tagSearchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(focusHandle);
  }, [tagPickerOpen]);

  const fetchDescriptionPreview = (rawUrl: string) => {
    const url = rawUrl.trim();

    if (!isValidSavedItemUrl(url) || lastPreviewUrlRef.current === url) {
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    const descriptionEditVersion = descriptionEditVersionRef.current;
    previewRequestIdRef.current = requestId;
    lastPreviewUrlRef.current = url;
    setIsDescriptionPreviewLoading(true);

    getSavedItemPreview({ url })
      .then((preview) => {
        if (
          previewRequestIdRef.current !== requestId ||
          descriptionEditVersionRef.current !== descriptionEditVersion ||
          !preview.description
        ) {
          return;
        }

        setDescriptionValue(preview.description);
      })
      .catch(() => {})
      .finally(() => {
        if (previewRequestIdRef.current === requestId) {
          setIsDescriptionPreviewLoading(false);
        }
      });
  };

  const handleUrlPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    fetchDescriptionPreview(event.clipboardData.getData("text"));
  };

  const selectFolderOption = (option: FolderPickerOption) => {
    setSelectedFolderId(option.kind === "folder" ? option.folder.id : null);
    setFolderSearchValue("");
    setFolderPickerOpen(false);
  };

  const toggleTagOption = (option: ExistingTagOption | NewTagOption | CreateTagOption) => {
    const selectedOption: ExistingTagOption | NewTagOption =
      option.kind === "create" ? { kind: "new", name: option.name } : option;
    const selectedKey = getTagOptionValue(selectedOption);

    setSelectedTagOptions((current) =>
      current.some((currentOption) => getTagOptionValue(currentOption) === selectedKey)
        ? current.filter((currentOption) => getTagOptionValue(currentOption) !== selectedKey)
        : normalizeSelectedTagOptions([...current, selectedOption])
    );
    setTagInputValue("");
  };

  const selectTypedTag = (rawTagName = tagSearchInputRef.current?.value ?? tagInputValue) => {
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

  const handleFolderSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || displayedFolderOptions.length !== 1) {
      return;
    }

    event.preventDefault();
    selectFolderOption(displayedFolderOptions[0]);
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

    const pendingTagName = normalizeTagName(tagSearchInputRef.current?.value ?? tagInputValue);
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
      description: descriptionValue.trim() || null,
      existingTagIds,
      folderId: selectedFolder?.id,
      libraryId: selectedFolder?.libraryId ?? selectedLibraryId ?? undefined,
      newTagNames,
      optimisticFolder: selectedFolder,
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
          setSelectedFolderId(targetFolder?.id ?? null);
          setFolderPickerOpen(false);
          setFolderSearchValue("");
          setTagPickerOpen(false);
          setTagInputValue("");
          setDescriptionValue("");
          setIsDescriptionPreviewLoading(false);
          descriptionEditVersionRef.current = 0;
          previewRequestIdRef.current += 1;
          lastPreviewUrlRef.current = null;
          setIsUrlInvalid(false);
          setIsUrlShaking(false);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-32px),680px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[22px] border border-[#dfe4ef] bg-white text-[#242833] shadow-[0_18px_60px_rgb(22_28_43_/_0.18)] outline-none max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-screen max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:shadow-none">
          <Dialog.Title className="sr-only">
            {targetFolder ? `Add to ${targetFolder.name}` : "Add saved item"}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Paste the page link you want to save and edit the description before saving.
          </Dialog.Description>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] max-md:top-[calc(1rem+env(safe-area-inset-top))]"
            aria-label="Close add saved item dialog"
            type="button"
          >
            <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form
            className="flex min-h-0 flex-1 flex-col"
            ref={formRef}
            noValidate
            onSubmit={submitSavedItem}
          >
            <div className="grid min-h-0 content-start gap-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-3 max-md:flex-1 max-md:px-4 max-md:pt-[calc(1rem+env(safe-area-inset-top))]">
              <label className="sr-only" htmlFor="savedItem-url">
                Page URL
              </label>
                <input
                  className={[
                    "min-h-12 rounded-xl border bg-white px-3 pr-10 text-lg font-medium text-[#242833] outline-none placeholder:text-[#7b8088] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]",
                    isUrlInvalid ? "border-[#ef4444] ring-3 ring-[#fee2e2]" : "border-transparent",
                    isUrlShaking ? "field-shake" : ""
                  ].join(" ")}
                  aria-invalid={isUrlInvalid}
                  autoComplete="url"
                  data-1p-ignore="true"
                  data-op-ignore="true"
                  id="savedItem-url"
                  inputMode="url"
                  name="url"
                  placeholder="Paste URL..."
                  ref={urlInputRef}
                  type="text"
                  onAnimationEnd={() => setIsUrlShaking(false)}
                  onChange={(event) => {
                    if (isValidSavedItemUrl(event.target.value.trim())) {
                      setIsUrlInvalid(false);
                    }
                  }}
                  onInput={(event) => {
                    const nextUrl = event.currentTarget.value.trim();

                    if (isValidSavedItemUrl(nextUrl)) {
                      setIsUrlInvalid(false);
                      fetchDescriptionPreview(nextUrl);
                    }
                  }}
                  onPaste={handleUrlPaste}
                />
              <label className="sr-only" htmlFor="savedItem-description">
                Description
              </label>
              <textarea
                className="min-h-32 resize-none rounded-xl border border-transparent bg-white px-3 py-2 text-base leading-7 text-[#4b5262] outline-none placeholder:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]"
                data-1p-ignore="true"
                data-op-ignore="true"
                id="savedItem-description"
                name="description"
                placeholder={isDescriptionPreviewLoading ? "Fetching description..." : "Description"}
                ref={descriptionTextareaRef}
                value={descriptionValue}
                onChange={(event) => {
                  descriptionEditVersionRef.current += 1;
                  setDescriptionValue(event.currentTarget.value);
                }}
                onInput={(event) => {
                  descriptionEditVersionRef.current += 1;
                  setDescriptionValue(event.currentTarget.value);
                }}
              />
              {addSavedItem.isError ? (
                <p className="m-0 rounded-lg border border-[#f0b37e] bg-[#fff8f1] px-3 py-2 text-sm font-medium text-[#9a4d0a]">
                  Saved item could not be saved.
                </p>
              ) : null}
            </div>
            <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-t border-[#eef1f6] px-5 py-3 max-md:px-4 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Popover.Root
                  open={folderPickerOpen}
                  onOpenChange={(open) => {
                    setFolderPickerOpen(open);
                    if (open) {
                      setFolderSearchValue("");
                    }
                  }}
                >
                  <Popover.Trigger
                    className="inline-flex min-h-8 max-w-[180px] items-center gap-1.5 rounded-full border border-[#dfe4ef] bg-[#f7f8fc] px-2.5 text-xs font-medium text-[#4b5262] outline-none hover:border-[#cfd6e4] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] data-[popup-open]:border-[#3b8df5] data-[popup-open]:bg-white"
                    aria-label={`Folder ${selectedFolderLabel}`}
                    type="button"
                  >
                    <span
                      className="grid shrink-0 place-items-center"
                      data-folder-picker-selected-color={selectedFolderIconColor}
                      data-folder-picker-selected-icon={selectedFolder?.id ?? "inbox"}
                      aria-hidden="true"
                    >
                      <SelectedFolderIcon
                        size={15}
                        stroke={1.7}
                        color={selectedFolderIconColor}
                        aria-hidden="true"
                        focusable="false"
                      />
                    </span>
                    <span className="min-w-0 truncate">{selectedFolderLabel}</span>
                    <IconChevronDown
                      className="shrink-0 text-[#697080]"
                      size={12}
                      stroke={1.8}
                      aria-hidden="true"
                      focusable="false"
                    />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner className="z-[80] outline-none" align="start" sideOffset={6}>
                      <Popover.Popup
                        className="w-[min(320px,var(--available-width))] overflow-hidden rounded-xl border border-[#dfe4ef] bg-white text-[#242833] shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none"
                        initialFocus={folderSearchInputRef}
                      >
                        <div className="border-b border-[#eef1f6] p-2">
                          <label className="flex min-h-9 items-center gap-2 rounded-lg bg-[#f7f8fc] px-2 text-[#697080] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#d9eaff]">
                            <IconSearch size={15} stroke={1.7} aria-hidden="true" focusable="false" />
                            <input
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]"
                              aria-label="Search folders"
                              autoComplete="off"
                              data-1p-ignore="true"
                              data-op-ignore="true"
                              placeholder="Change folder..."
                              ref={folderSearchInputRef}
                              value={folderSearchValue}
                              onChange={(event) => setFolderSearchValue(event.currentTarget.value)}
                              onKeyDown={handleFolderSearchKeyDown}
                            />
                          </label>
                        </div>
                        <div className="max-h-[min(280px,var(--available-height))] overflow-y-auto py-1">
                          {displayedFolderOptions.length > 0 ? (
                            displayedFolderOptions.map((option) => {
                              const selected =
                                option.kind === "inbox"
                                  ? selectedFolderId === null
                                  : selectedFolderId === option.folder.id;
                              const label =
                                option.kind === "inbox" ? "Inbox" : option.folder.name;

                              return (
                                <button
                                  className="grid min-h-10 w-full grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#4b5262] outline-none hover:bg-[#f0f6ff] hover:text-[#242833] focus-visible:bg-[#f0f6ff] focus-visible:text-[#242833]"
                                  data-folder-picker-option={label}
                                  key={getFolderOptionValue(option)}
                                  type="button"
                                  onClick={() => selectFolderOption(option)}
                                >
                                  <span className="text-[#3b8df5]">
                                    {selected ? (
                                      <IconCheck size={15} stroke={1.9} aria-hidden="true" focusable="false" />
                                    ) : null}
                                  </span>
                                  <span
                                    className="flex min-w-0 items-center gap-2"
                                    style={{ paddingLeft: option.kind === "folder" ? option.depth * 12 : 0 }}
                                  >
                                    <FolderPickerOptionIcon option={option} />
                                    <span className="min-w-0 truncate">{label}</span>
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2 text-sm font-medium text-[#697080]">
                              No folders found.
                            </div>
                          )}
                        </div>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>

                <Popover.Root
                  open={tagPickerOpen}
                  onOpenChange={(open) => {
                    setTagPickerOpen(open);
                    if (open) {
                      setTagInputValue("");
                    }
                  }}
                >
                  <Popover.Trigger
                    className="inline-flex min-h-8 max-w-[180px] items-center gap-1.5 rounded-full border border-[#dfe4ef] bg-[#f7f8fc] px-2.5 text-xs font-medium text-[#4b5262] outline-none hover:border-[#cfd6e4] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] data-[popup-open]:border-[#3b8df5] data-[popup-open]:bg-white"
                    aria-label={selectedTagOptions.length > 0 ? `Tags ${selectedTagLabel}` : "Tags"}
                    type="button"
                  >
                    <IconTags size={15} stroke={1.7} aria-hidden="true" focusable="false" />
                    <span className="min-w-0 truncate">{selectedTagLabel}</span>
                    <IconChevronDown
                      className="shrink-0 text-[#697080]"
                      size={12}
                      stroke={1.8}
                      aria-hidden="true"
                      focusable="false"
                    />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner className="z-[80] outline-none" align="start" sideOffset={6}>
                      <Popover.Popup
                        className="w-[min(320px,var(--available-width))] overflow-hidden rounded-xl border border-[#dfe4ef] bg-white text-[#242833] shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none"
                        initialFocus={tagSearchInputRef}
                      >
                        <div className="border-b border-[#eef1f6] p-2">
                          <label className="flex min-h-9 items-center gap-2 rounded-lg bg-[#f7f8fc] px-2 text-[#697080] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#d9eaff]">
                            <IconSearch size={15} stroke={1.7} aria-hidden="true" focusable="false" />
                            <input
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]"
                              aria-label="Search tags"
                              autoComplete="off"
                              data-1p-ignore="true"
                              data-op-ignore="true"
                              placeholder="Add tags..."
                              ref={tagSearchInputRef}
                              value={tagInputValue}
                              onChange={(event) => setTagInputValue(event.currentTarget.value)}
                              onKeyDown={handleTagInputKeyDown}
                            />
                          </label>
                        </div>
                        <div className="max-h-[min(280px,var(--available-height))] overflow-y-auto py-1">
                          {displayedTagOptions.length > 0 ? (
                            displayedTagOptions.map((option) => {
                              const selected =
                                option.kind !== "create" &&
                                selectedTagOptions.some(
                                  (selectedOption) =>
                                    getTagOptionValue(selectedOption) === getTagOptionValue(option)
                                );

                              return (
                                <button
                                  className="grid min-h-10 w-full grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#4b5262] outline-none hover:bg-[#f0f6ff] hover:text-[#242833] focus-visible:bg-[#f0f6ff] focus-visible:text-[#242833]"
                                  key={getTagOptionValue(option)}
                                  type="button"
                                  onClick={() => toggleTagOption(option)}
                                >
                                  <span className="text-[#3b8df5]">
                                    {selected ? (
                                      <IconCheck size={15} stroke={1.9} aria-hidden="true" focusable="false" />
                                    ) : null}
                                  </span>
                                  <span className="flex min-w-0 items-center gap-2">
                                    {option.kind === "existing" ? (
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: option.tag.color ?? "#697080" }}
                                        aria-hidden="true"
                                      />
                                    ) : option.kind === "create" ? (
                                      <IconPlus
                                        className="shrink-0 text-[#3b8df5]"
                                        size={15}
                                        stroke={1.8}
                                        aria-hidden="true"
                                        focusable="false"
                                      />
                                    ) : (
                                      <IconTag
                                        className="shrink-0 text-[#9aa1ad]"
                                        size={15}
                                        stroke={1.8}
                                        aria-hidden="true"
                                        focusable="false"
                                      />
                                    )}
                                    <span className="min-w-0 truncate">
                                      {option.kind === "create"
                                        ? `Create "${option.name}"`
                                        : getTagOptionLabel(option)}
                                    </span>
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2 text-sm font-medium text-[#697080]">
                              Type a tag name to create it.
                            </div>
                          )}
                        </div>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Dialog.Close
                  className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-medium text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                  disabled={addSavedItem.isPending}
                  type="button"
                >
                  Cancel
                </Dialog.Close>
                <button
                  className="min-h-10 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-4 text-sm font-medium text-white outline-none hover:bg-[#2f80ed] disabled:cursor-not-allowed disabled:border-[#91bff8] disabled:bg-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                  disabled={addSavedItem.isPending}
                  type="submit"
                >
                  {addSavedItem.isPending ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

type AddSavedItemMutationInput = {
  description: string | null;
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

type InboxFolderOption = {
  kind: "inbox";
  libraryId: string | null;
};

type ExistingFolderOption = {
  depth: number;
  folder: FolderItem;
  kind: "folder";
  path: string;
};

type FolderPickerOption = InboxFolderOption | ExistingFolderOption;

const normalizeTagName = (name: string) => name.trim().replace(/\s+/g, " ");

const normalizeSearchValue = (value: string) => normalizeTagName(value).toLowerCase();

const getTagOptionLabel = (option: TagComboboxOption) =>
  option.kind === "existing" ? option.tag.name : option.name;

const getTagOptionValue = (option: TagComboboxOption) =>
  option.kind === "existing" ? `existing:${option.tag.id}` : `${option.kind}:${option.name.toLowerCase()}`;

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

const buildFolderPickerOptions = (
  folders: FolderItem[],
  libraryId: string | null
): FolderPickerOption[] => {
  const options: FolderPickerOption[] = [{ kind: "inbox", libraryId }];

  const appendFolder = (folder: FolderNode, depth: number) => {
    options.push({
      depth,
      folder,
      kind: "folder",
      path: folderPath(folder, folders)
    });

    for (const child of folder.children ?? []) {
      appendFolder(child, depth + 1);
    }
  };

  for (const root of buildFolderTree(folders)) {
    appendFolder(root, 0);
  }

  return options;
};

const FolderPickerOptionIcon = ({ option }: { option: FolderPickerOption }) => {
  if (option.kind === "inbox") {
    return (
      <IconInbox
        className="shrink-0"
        color="#697080"
        size={16}
        stroke={1.7}
        aria-hidden="true"
        focusable="false"
      />
    );
  }

  const FolderIcon = getFolderIconComponent(option.folder.iconName);

  const iconColor = option.folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR;

  return (
    <span
      className="grid shrink-0 place-items-center"
      data-folder-picker-icon-color={iconColor}
      data-folder-picker-icon={option.folder.id}
      aria-hidden="true"
    >
      <FolderIcon
        color={iconColor}
        size={16}
        stroke={1.7}
        aria-hidden="true"
        focusable="false"
      />
    </span>
  );
};

const getFolderOptionValue = (option: FolderPickerOption) =>
  option.kind === "inbox" ? `inbox:${option.libraryId ?? "default"}` : `folder:${option.folder.id}`;

const getFolderOptionSearchText = (option: FolderPickerOption) =>
  option.kind === "inbox" ? "Inbox" : option.path;
