import "./style.css";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import { DEFAULT_FOLDER_ICON_COLOR, TablerIcon } from "../../lib/folderIcons";
import { rpcCall } from "../../lib/rpc";

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

interface ActivePage {
  title: string;
  url: string;
}

type MessageTone = "error" | "neutral" | "success";
type PopupScreen = "save" | "libraries" | "folders";
type FolderNode = FolderItem & { children: FolderNode[] };

const App = () => {
  const [screen, setScreen] = createSignal<PopupScreen>("save");
  const [activePage, setActivePage] = createSignal<ActivePage | null>(null);
  const [currentUser, setCurrentUser] = createSignal<CurrentUserResponse | null>(null);
  const [folders, setFolders] = createSignal<FolderItem[]>([]);
  const [tags, setTags] = createSignal<TagItem[]>([]);
  const [savedLocations, setSavedLocations] = createSignal<SavedItemLocation[]>([]);
  const [selectedFolderId, setSelectedFolderId] = createSignal("");
  const [selectedTagIds, setSelectedTagIds] = createSignal<string[]>([]);
  const [pickerLibraryId, setPickerLibraryId] = createSignal<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = createSignal<ReadonlySet<string>>(new Set());
  const [isBusy, setIsBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageTone, setMessageTone] = createSignal<MessageTone>("neutral");
  const [status, setStatus] = createSignal("");
  const [hasLoadedPage, setHasLoadedPage] = createSignal(false);

  const isFolderSelectionDisabled = createMemo(() => !currentUser() || folders().length === 0);
  const saveDisabled = createMemo(
    () => isBusy() || !activePage() || !currentUser()
  );

  const folderById = createMemo(() => new Map(folders().map((folder) => [folder.id, folder])));
  const selectedFolder = createMemo(() => folderById().get(selectedFolderId()) ?? null);
  const libraryById = createMemo(
    () => new Map(currentUser()?.libraries.map((library) => [library.id, library]) ?? [])
  );
  const selectedFolderLabel = createMemo(() => {
    const folder = selectedFolder();

    if (folder) {
      return folderPath(folder, folders());
    }

    return "Inbox";
  });

  const folderTree = createMemo(() => buildFolderTree(folders()));
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

  const visibleTags = createMemo(() => {
    const folder = selectedFolder();

    return folder ? tags().filter((tag) => tag.libraryId === folder.libraryId) : [];
  });

  const selectedPickerLibrary = createMemo(
    () => currentUser()?.libraries.find((library) => library.id === pickerLibraryId()) ?? null
  );
  const pickerRoots = createMemo(() => {
    const libraryId = pickerLibraryId();

    return libraryId ? folderTree().filter((folder) => folder.libraryId === libraryId) : [];
  });

  onMount(async () => {
    setActivePage(await getActivePage());
    setHasLoadedPage(true);
    await loadAppData();
  });

  const loadAppData = async () => {
    setIsBusy(true);
    writeMessage("Loading folders and tags", "neutral");

    try {
      const page = activePage();
      const [userResponse, folderResponse, tagResponse, locationResponse] = await Promise.all([
        rpcCall<CurrentUserResponse>("currentUser", undefined),
        rpcCall<FolderItem[]>("folders/list", null),
        rpcCall<TagItem[]>("tags/list", null),
        page
          ? rpcCall<SavedItemLocation[]>("savedItems/locations", { url: page.url })
          : Promise.resolve([])
      ]);

      setCurrentUser(userResponse);
      setFolders(folderResponse);
      setTags(tagResponse);
      setSavedLocations(locationResponse);
      setSelectedFolderId("");
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

  const saveSavedItem = async () => {
    const page = activePage();

    if (!page) {
      writeMessage("Open a regular http or https page first.", "error");
      return;
    }

    setIsBusy(true);
    writeMessage("Saving page", "neutral");

    try {
      await rpcCall("savedItems/create", {
        folderId: selectedFolderId() || undefined,
        tagIds: selectedTagIds(),
        url: page.url
      });

      writeMessage("Saved", "success");
      setStatus("Saved");
      window.close();
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

    setPickerLibraryId(folder?.libraryId ?? firstLibrary?.id ?? null);
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

  const closeFolderPicker = () => {
    setScreen("save");
  };

  const writeMessage = (text: string, tone: MessageTone) => {
    setMessage(text);
    setMessageTone(tone);
  };

  return (
    <Show when={screen() === "save"} fallback={renderFolderPicker()}>
      <main class="popup-shell">
        <header class="popup-header">
          <div>
            <p class="eyebrow">Shelf</p>
            <h1>Save page</h1>
          </div>
          <div class="header-actions">
            <button class="icon-button" type="button" title="Settings" onClick={() => void browser.runtime.openOptionsPage()}>
              Settings
            </button>
            <Show when={status()}>
              <div class="status-pill">{status()}</div>
            </Show>
          </div>
        </header>

        <section class="page-preview" aria-label="Current page">
          <Show
            when={hasLoadedPage()}
            fallback={
              <>
                <p class="page-title">Loading current tab</p>
                <p class="page-url"></p>
              </>
            }
          >
            <Show
              when={activePage()}
              fallback={
                <>
                  <p class="page-title">This page cannot be saved</p>
                  <p class="page-url">Open a regular http or https page first.</p>
                </>
              }
            >
              {(page) => (
                <>
                  <p class="page-title">{page().title}</p>
                  <p class="page-url">{page().url}</p>
                </>
              )}
            </Show>
          </Show>
        </section>

        <Show when={savedLocationLabels().length > 0}>
          <section class="saved-locations-banner" aria-label="Existing saved locations">
            <p>Already saved in:</p>
            <ul>
              <For each={savedLocationLabels()}>{(label) => <li>{label}</li>}</For>
            </ul>
          </section>
        </Show>

        <form
          class="save-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSavedItem();
          }}
        >
          <label class="field">
            <span>Folder</span>
            <button
              class="folder-trigger"
              type="button"
              disabled={isFolderSelectionDisabled()}
              onClick={openFolderPicker}
            >
              <span class="folder-trigger-content">
                <Show when={selectedFolder()}>
                  {(folder) => (
                    <TablerIcon
                      color={folder().iconColor ?? DEFAULT_FOLDER_ICON_COLOR}
                      name={folder().iconName}
                      size={21}
                    />
                  )}
                </Show>
                <span>{selectedFolderLabel()}</span>
              </span>
              <span class="folder-trigger-icon">
                <TablerIcon name="IconChevronRight" size={16} />
              </span>
            </button>
          </label>

          <section class="field">
            <div class="field-row">
              <span>Tags</span>
              <button
                class="icon-button"
                type="button"
                title="Refresh folders and tags"
                disabled={isBusy()}
                onClick={() => void loadAppData()}
              >
                Refresh
              </button>
            </div>
            <div class="tag-list" aria-live="polite">
              <Show when={visibleTags().length > 0} fallback={<p class="empty-state">No tags in this folder library</p>}>
                <For each={visibleTags()}>
                  {(tag) => (
                    <label class="tag-option">
                      <input
                        type="checkbox"
                        name="tagIds"
                        value={tag.id}
                        checked={selectedTagIds().includes(tag.id)}
                        onChange={(event) => toggleTag(tag.id, event.currentTarget.checked)}
                      />
                      <span>{tag.name}</span>
                      <span class="tag-count">{tag.savedItemCount}</span>
                    </label>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <p class="message" data-tone={messageTone()} role="status">
            {message()}
          </p>

          <button class="save-button" type="submit" disabled={saveDisabled()}>
            Save page
          </button>
        </form>
      </main>
    </Show>
  );

  function renderFolderPicker() {
    return (
      <Show when={screen() === "libraries"} fallback={renderFolderTreePicker()}>
        <main class="popup-shell folder-picker-shell">
          <header class="popup-header">
            <div>
              <p class="eyebrow">Shelf</p>
              <h1>Choose workspace</h1>
            </div>
            <button class="icon-button" type="button" onClick={closeFolderPicker}>
              Done
            </button>
          </header>

          <div class="folder-list" aria-live="polite">
            <For each={currentUser()?.libraries ?? []}>
              {(library) => {
                const rootCount = folderTree().filter((folder) => folder.libraryId === library.id).length;

                return (
                  <button class="library-row" type="button" onClick={() => chooseLibrary(library.id)}>
                    <span class="folder-row-label">
                      <TablerIcon name="IconDatabase" size={21} />
                      <span>
                        <strong>{library.name}</strong>
                        <small>{rootCount} folders</small>
                      </span>
                    </span>
                    <span class="folder-trigger-icon">
                      <TablerIcon name="IconChevronRight" size={16} />
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </main>
      </Show>
    );
  }

  function renderFolderTreePicker() {
    return (
      <main class="popup-shell folder-picker-shell">
        <header class="popup-header">
          <div>
            <p class="eyebrow">Shelf</p>
            <h1>Choose folder</h1>
          </div>
          <button class="icon-button" type="button" onClick={closeFolderPicker}>
            Done
          </button>
        </header>

        <section class="folder-location" aria-label="Folder location">
          <button class="icon-button" type="button" onClick={() => setScreen("libraries")}>
            Back
          </button>
          <p>{selectedPickerLibrary()?.name ?? "Workspace"}</p>
        </section>

        <div class="folder-list" aria-live="polite">
          <Show
            when={pickerRoots().length > 0}
            fallback={<p class="empty-state">No folders in this workspace</p>}
          >
            <For each={pickerRoots()}>{(folder) => renderFolderNode(folder, 0)}</For>
          </Show>
        </div>
      </main>
    );
  }

  function renderFolderNode(folder: FolderNode, level: number) {
    const hasChildren = folder.children.length > 0;
    const isExpanded = () => expandedFolderIds().has(folder.id);
    const isSelected = () => selectedFolderId() === folder.id;

    return (
      <>
        <div class={["folder-tree-row", isSelected() ? "is-selected" : ""].join(" ")}>
          <button
            class="folder-disclosure-button"
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
            class="folder-tree-select-button"
            type="button"
            style={{ "padding-left": `${8 + level * 18}px` }}
            onClick={() => chooseFolder(folder)}
          >
            <TablerIcon color={folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR} name={folder.iconName} size={21} />
            <span>{folder.name}</span>
          </button>
          <span class="folder-count">{folder.savedItemCount > 0 ? folder.savedItemCount : null}</span>
        </div>
        <Show when={hasChildren && isExpanded()}>
          <For each={folder.children}>{(child) => renderFolderNode(child, level + 1)}</For>
        </Show>
      </>
    );
  }
};

const getActivePage = async (): Promise<ActivePage | null> => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
    return null;
  }

  return {
    title: tab.title?.trim() || new URL(tab.url).hostname,
    url: tab.url
  };
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

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing root element");
}

render(() => <App />, root);
