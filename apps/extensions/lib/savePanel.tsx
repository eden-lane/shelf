import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { browser } from "wxt/browser";
import { DEFAULT_FOLDER_ICON_COLOR, TablerIcon } from "./folderIcons";

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
type PanelScreen = "save" | "libraries" | "folders";
type FolderNode = FolderItem & { children: FolderNode[] };

export const SavePanel = (props: { initialPage: ActivePage; onClose: () => void }) => {
  const [screen, setScreen] = createSignal<PanelScreen>("save");
  const [page, setPage] = createSignal(props.initialPage);
  const [currentUser, setCurrentUser] = createSignal<CurrentUserResponse | null>(null);
  const [folders, setFolders] = createSignal<FolderItem[]>([]);
  const [tags, setTags] = createSignal<TagItem[]>([]);
  const [savedLocations, setSavedLocations] = createSignal<SavedItemLocation[]>([]);
  const [selectedFolderId, setSelectedFolderId] = createSignal("");
  const [selectedInboxLibraryId, setSelectedInboxLibraryId] = createSignal<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = createSignal<string[]>([]);
  const [pickerLibraryId, setPickerLibraryId] = createSignal<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = createSignal<ReadonlySet<string>>(new Set());
  const [isBusy, setIsBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageTone, setMessageTone] = createSignal<MessageTone>("neutral");
  const [status, setStatus] = createSignal("");

  const folderById = createMemo(() => new Map(folders().map((folder) => [folder.id, folder])));
  const selectedFolder = createMemo(() => folderById().get(selectedFolderId()) ?? null);
  const libraryById = createMemo(
    () => new Map(currentUser()?.libraries.map((library) => [library.id, library]) ?? [])
  );
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
      return folderPath(folder, folders());
    }

    const libraryName = selectedLibraryId() ? libraryById().get(selectedLibraryId()!)?.name : null;

    return libraryName && currentUser()?.libraries.length !== 1 ? `${libraryName} / Inbox` : "Inbox";
  });
  const folderTree = createMemo(() => buildFolderTree(folders()));
  const isFolderSelectionDisabled = createMemo(() => !currentUser() || folders().length === 0);
  const saveDisabled = createMemo(() => isBusy() || !currentUser());
  const previewHost = createMemo(() => new URL(page().url).hostname.replace(/^www\./, ""));
  const selectedPickerLibrary = createMemo(
    () => currentUser()?.libraries.find((library) => library.id === pickerLibraryId()) ?? null
  );
  const pickerRoots = createMemo(() => {
    const libraryId = pickerLibraryId();

    return libraryId ? folderTree().filter((folder) => folder.libraryId === libraryId) : [];
  });
  const visibleTags = createMemo(() => {
    const libraryId = selectedLibraryId();

    return libraryId ? tags().filter((tag) => tag.libraryId === libraryId) : [];
  });
  const savedLocationLabels = createMemo(() =>
    savedLocations()
      .map((location) => {
        const library = libraryById().get(location.libraryId);
        const folder = location.folderId ? folderById().get(location.folderId) : null;

        if (!library) {
          return null;
        }

        return `${library.name} / ${folder ? folderPath(folder, folders()) : "Inbox"}`;
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
      setSelectedTagIds([]);
      return;
    }

    setSelectedTagIds((current) =>
      current.filter((tagId) => visibleTags().some((tag) => tag.id === tagId))
    );
  });

  const loadAppData = async () => {
    setIsBusy(true);
    writeMessage("Loading folders and tags", "neutral");

    try {
      const [userResponse, folderResponse, tagResponse, locationResponse] = await Promise.all([
        rpcViaBackground<CurrentUserResponse>("currentUser", undefined),
        rpcViaBackground<FolderItem[]>("folders/list", null),
        rpcViaBackground<TagItem[]>("tags/list", null),
        rpcViaBackground<SavedItemLocation[]>("savedItems/locations", { url: page().url })
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
      setSelectedTagIds([]);
      setPickerLibraryId(userResponse.libraries[0]?.id ?? null);
      setExpandedFolderIds(new Set<string>());
      writeMessage("", "neutral");
      setStatus("Ready");
    } catch (error) {
      setCurrentUser(null);
      setFolders([]);
      setTags([]);
      setSavedLocations([]);
      setSelectedFolderId("");
      setSelectedInboxLibraryId(null);
      setSelectedTagIds([]);
      setPickerLibraryId(null);
      setExpandedFolderIds(new Set<string>());
      setScreen("save");
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

    const preview = await rpcViaBackground<SavedItemPreviewResponse>("savedItems/preview", {
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
      await rpcViaBackground("savedItems/create", {
        description: page().description || undefined,
        folderId: selectedFolderId() || undefined,
        libraryId: selectedFolderId() ? undefined : selectedLibraryId() ?? undefined,
        tagIds: selectedTagIds(),
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

  const toggleTag = (tagId: string, isSelected: boolean) => {
    setSelectedTagIds((current) =>
      isSelected ? [...current, tagId] : current.filter((selectedTagId) => selectedTagId !== tagId)
    );
  };

  const openFolderPicker = () => {
    if (isFolderSelectionDisabled()) {
      return;
    }

    const folder = selectedFolder();
    const firstLibrary = currentUser()?.libraries[0] ?? null;

    setPickerLibraryId(folder?.libraryId ?? selectedLibraryId() ?? firstLibrary?.id ?? null);
    setExpandedFolderIds(expandedAncestorIds(folders(), folder?.id ?? selectedFolderId()));
    setScreen("libraries");
  };

  const chooseLibrary = (libraryId: string) => {
    const folder = selectedFolder();

    setPickerLibraryId(libraryId);
    setExpandedFolderIds(
      folder?.libraryId === libraryId ? expandedAncestorIds(folders(), folder.id) : new Set<string>()
    );
    setScreen("folders");
  };

  const chooseFolder = (folder: FolderItem) => {
    setSelectedFolderId(folder.id);
    setSelectedInboxLibraryId(folder.libraryId);
    setSelectedTagIds([]);
    setScreen("save");
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
    <div class="shelf-overlay-frame" onKeyDown={(event) => event.key === "Escape" && props.onClose()}>
      <Show when={screen() === "save"} fallback={renderFolderPicker()}>
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
            <label class="shelf-field">
              <span>Folder</span>
              <button
                class="shelf-folder-trigger"
                type="button"
                disabled={isFolderSelectionDisabled()}
                onClick={openFolderPicker}
              >
                <span class="shelf-folder-trigger-content">
                  <Show when={selectedFolder()}>
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
                <TablerIcon name="IconChevronRight" size={16} />
              </button>
            </label>

            <section class="shelf-field">
              <div class="shelf-field-row">
                <span>Tags</span>
                <button
                  aria-label="Refresh folders and tags"
                  class="shelf-icon-button"
                  title="Refresh folders and tags"
                  type="button"
                  disabled={isBusy()}
                  onClick={() => void loadAppData()}
                >
                  <TablerIcon name="IconRefresh" size={16} />
                </button>
              </div>
              <div class="shelf-tag-list" aria-live="polite">
                <Show when={visibleTags().length > 0} fallback={<p class="shelf-empty-state">No tags in this workspace</p>}>
                  <For each={visibleTags()}>
                    {(tag) => (
                      <label class="shelf-tag-option" style={{ "--tag-color": tag.color ?? "#64748b" }}>
                        <input
                          type="checkbox"
                          name="tagIds"
                          value={tag.id}
                          checked={selectedTagIds().includes(tag.id)}
                          onChange={(event) => toggleTag(tag.id, event.currentTarget.checked)}
                        />
                        <span>{tag.name}</span>
                      </label>
                    )}
                  </For>
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
      </Show>
    </div>
  );

  function renderFolderPicker() {
    return (
      <Show when={screen() === "libraries"} fallback={renderFolderTreePicker()}>
        <section class="shelf-panel shelf-picker-panel" aria-label="Choose workspace">
          <header class="shelf-panel-header">
            <div>
              <p class="shelf-eyebrow">Folder</p>
              <h1>Choose workspace</h1>
            </div>
            <button class="shelf-text-button" type="button" onClick={() => setScreen("save")}>
              Done
            </button>
          </header>

          <div class="shelf-folder-list" aria-live="polite">
            <For each={currentUser()?.libraries ?? []}>
              {(library) => {
                const rootCount = folderTree().filter((folder) => folder.libraryId === library.id).length;

                return (
                  <button class="shelf-library-row" type="button" onClick={() => chooseLibrary(library.id)}>
                    <span class="shelf-folder-row-label">
                      <TablerIcon name="IconDatabase" size={21} />
                      <span>
                        <strong>{library.name}</strong>
                        <small>{rootCount} folders</small>
                      </span>
                    </span>
                    <TablerIcon name="IconChevronRight" size={16} />
                  </button>
                );
              }}
            </For>
          </div>
        </section>
      </Show>
    );
  }

  function renderFolderTreePicker() {
    return (
      <section class="shelf-panel shelf-picker-panel" aria-label="Choose folder">
        <header class="shelf-panel-header">
          <div>
            <p class="shelf-eyebrow">{selectedPickerLibrary()?.name ?? "Workspace"}</p>
            <h1>Choose folder</h1>
          </div>
          <button class="shelf-text-button" type="button" onClick={() => setScreen("save")}>
            Done
          </button>
        </header>

        <div class="shelf-picker-nav">
          <button class="shelf-text-button" type="button" onClick={() => setScreen("libraries")}>
            Back
          </button>
          <button
            class="shelf-text-button"
            type="button"
            onClick={() => {
              setSelectedFolderId("");
              setSelectedInboxLibraryId(pickerLibraryId());
              setSelectedTagIds([]);
              setScreen("save");
            }}
          >
            Use Inbox
          </button>
        </div>

        <div class="shelf-folder-list" aria-live="polite">
          <Show
            when={pickerRoots().length > 0}
            fallback={<p class="shelf-empty-state">No folders in this workspace</p>}
          >
            <For each={pickerRoots()}>{(folder) => renderFolderNode(folder, 0)}</For>
          </Show>
        </div>
      </section>
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
};

const rpcViaBackground = <T,>(path: string, input: unknown): Promise<T> =>
  browser.runtime.sendMessage({
    input,
    path,
    type: "shelf:rpc"
  });

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

const folderPath = (folder: FolderItem, allFolders: FolderItem[]) => {
  const path = [folder.name];
  let parentId = folder.parentId;

  while (parentId) {
    const parent = allFolders.find((candidate) => candidate.id === parentId);

    if (!parent) {
      break;
    }

    path.unshift(parent.name);
    parentId = parent.parentId;
  }

  return path.join(" / ");
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to connect to Shelf";
