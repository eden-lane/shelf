import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { browser } from "wxt/browser";
import { DEFAULT_FOLDER_ICON_COLOR, TablerIcon } from "./folderIcons";
import { rpcCall } from "./rpc";

interface CurrentUserResponse {
  libraries: Array<{
    id: string;
    kind: "personal" | "organization";
    name: string;
  }>;
}

interface FolderItem {
  id: string;
  libraryId: string;
  parentId: string | null;
  name: string;
  iconName: string | null;
  iconColor: string | null;
  savedItemCount: number;
}

interface TagItem {
  id: string;
  libraryId: string;
  name: string;
  color: string | null;
  savedItemCount: number;
}

interface SavedItemLocation {
  id: string;
  libraryId: string;
  folderId: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface SavedItemPreviewResponse {
  description: string | null;
}

export interface ActivePage {
  description: string;
  faviconUrl: string | null;
  imageUrl: string | null;
  title: string;
  url: string;
}

type MessageTone = "error" | "neutral" | "success";
type FolderNode = FolderItem & { children: FolderNode[] };
type ExistingTagOption = { kind: "existing"; tag: TagItem };
type NewTagOption = { kind: "new"; name: string };
type CreateTagOption = { kind: "create"; name: string };
type TagOption = ExistingTagOption | NewTagOption | CreateTagOption;

export const SavePanel = (props: { initialPage: ActivePage; onClose: () => void }) => {
  const [page, setPage] = createSignal(props.initialPage);
  const [currentUser, setCurrentUser] = createSignal<CurrentUserResponse | null>(null);
  const [folders, setFolders] = createSignal<FolderItem[]>([]);
  const [tags, setTags] = createSignal<TagItem[]>([]);
  const [savedLocations, setSavedLocations] = createSignal<SavedItemLocation[]>([]);
  const [selectedFolderId, setSelectedFolderId] = createSignal("");
  const [selectedInboxLibraryId, setSelectedInboxLibraryId] = createSignal<string | null>(null);
  const [selectedTagOptions, setSelectedTagOptions] = createSignal<Array<ExistingTagOption | NewTagOption>>([]);
  const [tagInputValue, setTagInputValue] = createSignal("");
  const [isFolderPickerOpen, setIsFolderPickerOpen] = createSignal(false);
  const [isTagPickerOpen, setIsTagPickerOpen] = createSignal(false);
  const [expandedFolderIds, setExpandedFolderIds] = createSignal<ReadonlySet<string>>(new Set());
  const [isBusy, setIsBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageTone, setMessageTone] = createSignal<MessageTone>("neutral");
  const [status, setStatus] = createSignal("");

  const folderById = createMemo(() => new Map(folders().map((folder) => [folder.id, folder])));
  const selectedFolder = createMemo(() => folderById().get(selectedFolderId()) ?? null);
  const selectedLibraryId = createMemo(() => {
    const folder = selectedFolder();

    if (folder) {
      return folder.libraryId;
    }

    return (
      selectedInboxLibraryId() ??
      currentUser()?.libraries.find((library) => library.kind === "personal")?.id ??
      currentUser()?.libraries[0]?.id ??
      null
    );
  });
  const selectedFolderLabel = createMemo(() => {
    const folder = selectedFolder();

    if (folder) {
      return folder.name;
    }

    return "Inbox";
  });
  const folderTree = createMemo(() => buildFolderTree(folders()));
  const isFolderSelectionDisabled = createMemo(() => !currentUser());
  const saveDisabled = createMemo(() => isBusy() || !currentUser());
  const previewHost = createMemo(() => new URL(page().url).hostname.replace(/^www\./, ""));
  const visibleTags = createMemo(() => {
    const libraryId = selectedLibraryId();

    return libraryId ? tags().filter((tag) => tag.libraryId === libraryId) : [];
  });
  const selectedExistingTagIds = createMemo(() =>
    selectedTagOptions().flatMap((option) => (option.kind === "existing" ? [option.tag.id] : []))
  );
  const selectedNewTagNames = createMemo(() =>
    selectedTagOptions().flatMap((option) => (option.kind === "new" ? [option.name] : []))
  );
  const normalizedTagInput = createMemo(() => normalizeTagName(tagInputValue()));
  const tagOptions = createMemo(() => {
    const input = normalizedTagInput();
    const searchNeedle = input.toLowerCase();
    const selectedKeys = new Set(selectedTagOptions().map(getTagOptionValue));
    const matchingExistingTag = visibleTags().find(
      (tag) => normalizeTagName(tag.name).toLowerCase() === searchNeedle
    );
    const options: TagOption[] = visibleTags()
      .filter((tag) => !searchNeedle || normalizeTagName(tag.name).toLowerCase().includes(searchNeedle))
      .map((tag) => ({ kind: "existing", tag }));

    if (input && !matchingExistingTag && !selectedKeys.has(`new:${input.toLowerCase()}`)) {
      options.push({ kind: "create", name: input });
    }

    return options;
  });
  const savedLocationLabels = createMemo(() =>
    savedLocations()
      .map((location) => {
        const folder = location.folderId ? folderById().get(location.folderId) : null;

        return folder ? folder.name : "Inbox";
      })
      .filter((label): label is string => Boolean(label))
      .sort((left, right) => left.localeCompare(right))
  );

  onMount(() => {
    void loadAppData();
    void loadPreviewDescription();
  });

  createEffect(() => {
    if (!selectedLibraryId()) {
      setSelectedTagOptions([]);
      return;
    }

    setSelectedTagOptions((current) =>
      current.filter(
        (option) =>
          option.kind === "new" || visibleTags().some((tag) => tag.id === option.tag.id)
      )
    );
  });

  const loadAppData = async () => {
    setIsBusy(true);
    writeMessage("Loading folders and tags", "neutral");

    try {
      const [userResponse, folderResponse, tagResponse, locationResponse] = await Promise.all([
        rpcCall<CurrentUserResponse>("currentUser", undefined),
        rpcCall<FolderItem[]>("folders/list", null),
        rpcCall<TagItem[]>("tags/list", null),
        rpcCall<SavedItemLocation[]>("savedItems/locations", { url: page().url })
      ]);

      setCurrentUser(userResponse);
      setFolders(folderResponse);
      setTags(tagResponse);
      setSavedLocations(locationResponse);
      setSelectedFolderId("");
      setSelectedInboxLibraryId(
        userResponse.libraries.find((library) => library.kind === "personal")?.id ??
          userResponse.libraries[0]?.id ??
          null
      );
      setSelectedTagOptions([]);
      setTagInputValue("");
      setIsFolderPickerOpen(false);
      setIsTagPickerOpen(false);
      setExpandedFolderIds(defaultExpandedFolderIds(folderResponse));
      writeMessage("", "neutral");
      setStatus("Ready");
    } catch (error) {
      setCurrentUser(null);
      setFolders([]);
      setTags([]);
      setSavedLocations([]);
      setSelectedFolderId("");
      setSelectedInboxLibraryId(null);
      setSelectedTagOptions([]);
      setTagInputValue("");
      setIsFolderPickerOpen(false);
      setIsTagPickerOpen(false);
      setExpandedFolderIds(new Set<string>());
      writeMessage(errorMessage(error), "error");
      setStatus("Offline");
    } finally {
      setIsBusy(false);
    }
  };

  const loadPreviewDescription = async () => {
    if (page().description) {
      return;
    }

    const preview = await rpcCall<SavedItemPreviewResponse>("savedItems/preview", {
      url: page().url
    }).catch(() => null);

    if (preview?.description) {
      setPage((current) => ({ ...current, description: preview.description ?? "" }));
    }
  };

  const saveSavedItem = async () => {
    setIsBusy(true);
    writeMessage("Saving page", "neutral");

    try {
      const libraryId = selectedLibraryId();
      const createdTags =
        selectedNewTagNames().length > 0 && libraryId
          ? await Promise.all(
              selectedNewTagNames().map((name) =>
                rpcCall<TagItem>("tags/create", {
                  libraryId,
                  name
                })
              )
            )
          : [];
      const tagIds = [...selectedExistingTagIds(), ...createdTags.map((tag) => tag.id)];

      if (createdTags.length > 0) {
        setTags((current) => [...current, ...createdTags]);
        setSelectedTagOptions((current) =>
          current.map((option) => {
            if (option.kind === "existing") {
              return option;
            }

            const createdTag = createdTags.find(
              (tag) => normalizeTagName(tag.name).toLowerCase() === option.name.toLowerCase()
            );

            return createdTag ? { kind: "existing", tag: createdTag } : option;
          })
        );
      }

      await rpcCall("savedItems/create", {
        description: page().description || undefined,
        folderId: selectedFolderId() || undefined,
        libraryId: selectedFolderId() ? undefined : selectedLibraryId() ?? undefined,
        tagIds,
        url: page().url
      });

      writeMessage("Saved", "success");
      setStatus("Saved");
      window.setTimeout(props.onClose, 450);
    } catch (error) {
      writeMessage(errorMessage(error), "error");
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleTagOption = (option: TagOption) => {
    if (option.kind === "create") {
      setSelectedTagOptions((current) => mergeTagOptions(current, { kind: "new", name: option.name }));
      setTagInputValue("");
      setIsFolderPickerOpen(false);
      setIsTagPickerOpen(true);
      return;
    }

    const value = getTagOptionValue(option);

    setSelectedTagOptions((current) =>
      current.some((selectedOption) => getTagOptionValue(selectedOption) === value)
        ? current.filter((selectedOption) => getTagOptionValue(selectedOption) !== value)
        : mergeTagOptions(current, option)
    );
    setTagInputValue("");
    setIsFolderPickerOpen(false);
    setIsTagPickerOpen(true);
  };

  const removeTagOption = (option: ExistingTagOption | NewTagOption) => {
    const value = getTagOptionValue(option);

    setSelectedTagOptions((current) =>
      current.filter((selectedOption) => getTagOptionValue(selectedOption) !== value)
    );
  };

  const handleTagInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const option = tagOptions()[0];

      if (option) {
        toggleTagOption(option);
      }
    }

    if (event.key === "Backspace" && !tagInputValue()) {
      setSelectedTagOptions((current) => current.slice(0, -1));
    }

    if (event.key === "Escape") {
      event.stopPropagation();
      setIsTagPickerOpen(false);
    }
  };

  const openFolderPicker = () => {
    if (isFolderSelectionDisabled()) {
      return;
    }

    const folder = selectedFolder();

    setExpandedFolderIds((current) => {
      const next = new Set(current);

      for (const id of expandedAncestorIds(folders(), folder?.id ?? selectedFolderId())) {
        next.add(id);
      }

      return next;
    });
    setIsTagPickerOpen(false);
    setIsFolderPickerOpen((current) => !current);
  };

  const chooseFolder = (folder: FolderItem) => {
    setSelectedFolderId(folder.id);
    setSelectedInboxLibraryId(folder.libraryId);
    setSelectedTagOptions([]);
    setTagInputValue("");
    setIsFolderPickerOpen(false);
    setIsTagPickerOpen(false);
  };

  const chooseInbox = (libraryId: string | null) => {
    setSelectedFolderId("");
    setSelectedInboxLibraryId(libraryId);
    setSelectedTagOptions([]);
    setTagInputValue("");
    setIsFolderPickerOpen(false);
    setIsTagPickerOpen(false);
  };

  const drillIntoFolder = (folder: FolderItem) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);

      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        next.add(folder.id);
      }

      return next;
    });
  };

  const writeMessage = (text: string, tone: MessageTone) => {
    setMessage(text);
    setMessageTone(tone);
  };

  return (
    <div
      class="shelf-panel-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          props.onClose();
          return;
        }

        const path = event.composedPath();

        if (isFolderPickerOpen() && !path.some((target) => isElementWithClass(target, "shelf-folder-combobox"))) {
          setIsFolderPickerOpen(false);
        }

        if (isTagPickerOpen() && !path.some((target) => isElementWithClass(target, "shelf-tag-combobox"))) {
          setIsTagPickerOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") {
          return;
        }

        if (isFolderPickerOpen() || isTagPickerOpen()) {
          event.stopPropagation();
          setIsFolderPickerOpen(false);
          setIsTagPickerOpen(false);
          return;
        }

        props.onClose();
      }}
    >
      <div class="shelf-overlay-frame">
        <section class="shelf-panel" aria-label="Save page to Shelf">
          <header class="shelf-panel-header">
            <div class="shelf-brand">
              <span class="shelf-brand-mark">S</span>
              <div>
                <p class="shelf-eyebrow">Shelf</p>
                <h1>Save page</h1>
              </div>
            </div>
            <div class="shelf-header-actions">
              <button
                aria-label="Open Settings"
                class="shelf-icon-button"
                title="Settings"
                type="button"
                onClick={() => void browser.runtime.sendMessage({ type: "shelf:open-options" })}
              >
                <TablerIcon name="IconSettings" size={18} />
              </button>
              <button
                aria-label="Close"
                class="shelf-icon-button"
                title="Close"
                type="button"
                onClick={props.onClose}
              >
                <TablerIcon name="IconX" size={18} />
              </button>
            </div>
          </header>

          <section class="shelf-page-card" aria-label="Current page preview">
            <div class="shelf-preview-media">
              <Show
                when={page().imageUrl}
                fallback={
                  <div class="shelf-preview-fallback">
                    <Show when={page().faviconUrl}>
                      {(faviconUrl) => <img alt="" src={faviconUrl()} />}
                    </Show>
                    <span>{previewHost()}</span>
                  </div>
                }
              >
                {(imageUrl) => <img alt="" src={imageUrl()} />}
              </Show>
            </div>
            <div class="shelf-page-copy">
              <p class="shelf-page-title">{page().title}</p>
              <p class="shelf-page-url">{previewHost()}</p>
              <p class="shelf-page-description">
                {page().description || "No description found for this page yet."}
              </p>
            </div>
          </section>

          <Show when={savedLocationLabels().length > 0}>
            <section class="shelf-saved-banner" aria-label="Existing saved locations">
              <p>Already saved in</p>
              <For each={savedLocationLabels()}>{(label) => <span>{label}</span>}</For>
            </section>
          </Show>

          <form
            class="shelf-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSavedItem();
            }}
          >
            <div class="shelf-field">
              <span>Folder</span>
              <div class="shelf-folder-combobox">
                <button
                  class="shelf-folder-trigger"
                  type="button"
                  aria-expanded={isFolderPickerOpen()}
                  disabled={isFolderSelectionDisabled()}
                  onClick={openFolderPicker}
                >
                  <span class="shelf-folder-trigger-content">
                    <Show
                      when={selectedFolder()}
                      fallback={<TablerIcon color={DEFAULT_FOLDER_ICON_COLOR} name="IconInbox" size={20} />}
                    >
                      {(folder) => (
                        <TablerIcon
                          color={folder().iconColor ?? DEFAULT_FOLDER_ICON_COLOR}
                          name={folder().iconName}
                          size={20}
                        />
                      )}
                    </Show>
                    <span>{selectedFolderLabel()}</span>
                  </span>
                  <TablerIcon name={isFolderPickerOpen() ? "IconChevronUp" : "IconChevronDown"} size={16} />
                </button>
                <Show when={isFolderPickerOpen()}>{renderFolderDropdown()}</Show>
              </div>
            </div>

            <section class="shelf-field">
              <span>Tags</span>
              <div class="shelf-tag-combobox">
                <div
                  class="shelf-tag-input-wrap"
                  onClick={() => {
                    setIsFolderPickerOpen(false);
                    setIsTagPickerOpen(true);
                  }}
                >
                  <For each={selectedTagOptions()}>
                    {(option) => (
                      <button
                        class="shelf-tag-token"
                        style={{ "--tag-color": option.kind === "existing" ? (option.tag.color ?? "#64748b") : "#64748b" }}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeTagOption(option);
                        }}
                      >
                        <span>{getTagOptionLabel(option)}</span>
                        <TablerIcon name="IconX" size={13} />
                      </button>
                    )}
                  </For>
                  <input
                    aria-label="Search or create tags"
                    autocomplete="off"
                    data-1p-ignore="true"
                    data-op-ignore="true"
                    placeholder={selectedTagOptions().length > 0 ? "" : "Search or create tags"}
                    value={tagInputValue()}
                    onFocus={() => {
                      setIsFolderPickerOpen(false);
                      setIsTagPickerOpen(true);
                    }}
                    onInput={(event) => {
                      setTagInputValue(event.currentTarget.value);
                      setIsTagPickerOpen(true);
                    }}
                    onKeyDown={handleTagInputKeyDown}
                  />
                </div>
                <Show when={isTagPickerOpen()}>
                  <div class="shelf-tag-menu" role="listbox">
                    <Show
                      when={tagOptions().length > 0}
                      fallback={<p class="shelf-empty-state">Type a tag name to create it.</p>}
                    >
                      <For each={tagOptions()}>
                        {(option) => {
                          const isSelected = () =>
                            option.kind !== "create" &&
                            selectedTagOptions().some(
                              (selectedOption) => getTagOptionValue(selectedOption) === getTagOptionValue(option)
                            );

                          return (
                            <button
                              class="shelf-tag-menu-option"
                              type="button"
                              role="option"
                              aria-selected={isSelected()}
                              onClick={() => toggleTagOption(option)}
                            >
                              <span class="shelf-tag-menu-check">
                                <Show when={isSelected()}>
                                  <TablerIcon name="IconCheck" size={14} />
                                </Show>
                              </span>
                              <span
                                class="shelf-tag-dot"
                                style={{
                                  "--tag-color":
                                    option.kind === "existing"
                                      ? (option.tag.color ?? "#64748b")
                                      : "#64748b"
                                }}
                              />
                              <span>
                                {option.kind === "create" ? `Create "${option.name}"` : getTagOptionLabel(option)}
                              </span>
                            </button>
                          );
                        }}
                      </For>
                    </Show>
                  </div>
                </Show>
              </div>
            </section>

            <p class="shelf-message" data-tone={messageTone()} role="status">
              {message() || status()}
            </p>

            <button class="shelf-save-button" type="submit" disabled={saveDisabled()}>
              Save to Shelf
            </button>
          </form>
        </section>
      </div>
    </div>
  );

  function renderFolderDropdown() {
    return (
      <div class="shelf-folder-list" aria-live="polite">
        <For each={currentUser()?.libraries ?? []}>
          {(library) => (
            <section class="shelf-folder-group">
              <Show when={(currentUser()?.libraries.length ?? 0) > 1}>
                <p class="shelf-folder-group-label">{library.name}</p>
              </Show>
              {renderInboxFolderRow(library.id)}
              <For each={folderTree().filter((folder) => folder.libraryId === library.id)}>
                {(folder) => renderFolderNode(folder, 0)}
              </For>
            </section>
          )}
        </For>
      </div>
    );
  }

  function renderFolderNode(folder: FolderNode, level: number) {
    const hasChildren = folder.children.length > 0;
    const isExpanded = () => expandedFolderIds().has(folder.id);
    const isSelected = () => selectedFolderId() === folder.id;

    return (
      <>
        <div class={["shelf-folder-tree-row", isSelected() ? "is-selected" : ""].join(" ")}>
          <button
            class="shelf-disclosure-button"
            type="button"
            disabled={!hasChildren}
            aria-expanded={hasChildren ? isExpanded() : undefined}
            aria-label={`${isExpanded() ? "Collapse" : "Expand"} ${folder.name}`}
            onClick={() => drillIntoFolder(folder)}
          >
            <Show when={hasChildren}>
              <TablerIcon name={isExpanded() ? "IconChevronDown" : "IconChevronRight"} size={16} />
            </Show>
          </button>
          <button
            class="shelf-folder-select-button"
            type="button"
            style={{ "padding-left": `${8 + level * 18}px` }}
            onClick={() => chooseFolder(folder)}
          >
            <TablerIcon color={folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR} name={folder.iconName} size={20} />
            <span>{folder.name}</span>
          </button>
          <span class="shelf-folder-count">{folder.savedItemCount > 0 ? folder.savedItemCount : null}</span>
        </div>
        <Show when={hasChildren && isExpanded()}>
          <For each={folder.children}>{(child) => renderFolderNode(child, level + 1)}</For>
        </Show>
      </>
    );
  }

  function renderInboxFolderRow(libraryId: string) {
    const isSelectedInbox = () => !selectedFolderId() && selectedInboxLibraryId() === libraryId;

    return (
      <div class={["shelf-folder-tree-row", isSelectedInbox() ? "is-selected" : ""].join(" ")}>
        <span class="shelf-disclosure-placeholder" />
        <button class="shelf-folder-select-button" type="button" onClick={() => chooseInbox(libraryId)}>
          <TablerIcon color={DEFAULT_FOLDER_ICON_COLOR} name="IconInbox" size={20} />
          <span>Inbox</span>
        </button>
        <span class="shelf-folder-count" />
      </div>
    );
  }
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

const expandedAncestorIds = (folders: FolderItem[], folderId: string) => {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const ids = new Set<string>();
  let parentId = folderById.get(folderId)?.parentId ?? null;

  while (parentId) {
    ids.add(parentId);
    parentId = folderById.get(parentId)?.parentId ?? null;
  }

  return ids;
};

const defaultExpandedFolderIds = (folders: FolderItem[]) => {
  const folderIdsWithChildren = new Set(
    folders.flatMap((folder) => (folder.parentId ? [folder.parentId] : []))
  );

  return folderIdsWithChildren;
};

const normalizeTagName = (name: string) => name.trim().replace(/\s+/g, " ");

const getTagOptionLabel = (option: ExistingTagOption | NewTagOption | CreateTagOption) =>
  option.kind === "existing" ? option.tag.name : option.name;

const getTagOptionValue = (option: ExistingTagOption | NewTagOption | CreateTagOption) =>
  option.kind === "existing" ? `existing:${option.tag.id}` : `${option.kind}:${option.name.toLowerCase()}`;

const mergeTagOptions = (
  options: Array<ExistingTagOption | NewTagOption>,
  nextOption: ExistingTagOption | NewTagOption
) => {
  const next = [...options];
  const values = new Set(next.map(getTagOptionValue));
  const value = getTagOptionValue(nextOption);

  if (!values.has(value)) {
    next.push(nextOption);
  }

  return next;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to connect to Shelf";

const isElementWithClass = (value: EventTarget, className: string) =>
  value instanceof HTMLElement && value.classList.contains(className);
