import "./style.css";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import { rpcCall } from "../../lib/rpc";
import { getApiBaseUrl } from "../../lib/settings";

interface CurrentUserResponse {
  libraries: Array<{
    id: string;
    kind: "personal" | "organization";
    name: string;
    inboxFolderId: string;
  }>;
}

interface FolderItem {
  id: string;
  libraryId: string;
  parentId: string | null;
  name: string;
  bookmarkCount: number;
}

interface TagItem {
  id: string;
  libraryId: string;
  name: string;
  bookmarkCount: number;
}

interface ActivePage {
  title: string;
  url: string;
}

type MessageTone = "error" | "neutral" | "success";

const App = () => {
  const [activePage, setActivePage] = createSignal<ActivePage | null>(null);
  const [currentUser, setCurrentUser] = createSignal<CurrentUserResponse | null>(null);
  const [folders, setFolders] = createSignal<FolderItem[]>([]);
  const [tags, setTags] = createSignal<TagItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = createSignal("");
  const [selectedTagIds, setSelectedTagIds] = createSignal<string[]>([]);
  const [isBusy, setIsBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [messageTone, setMessageTone] = createSignal<MessageTone>("neutral");
  const [status, setStatus] = createSignal("");
  const [hasLoadedPage, setHasLoadedPage] = createSignal(false);

  const isFolderSelectDisabled = createMemo(() => !currentUser() || folders().length === 0);
  const saveDisabled = createMemo(() => isBusy() || !activePage() || isFolderSelectDisabled());

  const foldersByLibrary = createMemo(() => {
    const grouped = new Map<string, FolderItem[]>();

    for (const folder of folders()) {
      grouped.set(folder.libraryId, [...(grouped.get(folder.libraryId) ?? []), folder]);
    }

    return grouped;
  });

  const visibleTags = createMemo(() => {
    const selectedFolder = folders().find((folder) => folder.id === selectedFolderId()) ?? null;

    return selectedFolder ? tags().filter((tag) => tag.libraryId === selectedFolder.libraryId) : [];
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
      const apiUrl = await getApiBaseUrl();

      const [userResponse, folderResponse, tagResponse] = await Promise.all([
        rpcCall<CurrentUserResponse>(apiUrl, "currentUser", undefined),
        rpcCall<FolderItem[]>(apiUrl, "folders/list", null),
        rpcCall<TagItem[]>(apiUrl, "tags/list", null)
      ]);

      setCurrentUser(userResponse);
      setFolders(folderResponse);
      setTags(tagResponse);
      setSelectedFolderId(userResponse.libraries[0]?.inboxFolderId ?? "");
      setSelectedTagIds([]);
      writeMessage("", "neutral");
      setStatus("Ready");
    } catch (error) {
      setCurrentUser(null);
      setFolders([]);
      setTags([]);
      setSelectedFolderId("");
      setSelectedTagIds([]);
      writeMessage(errorMessage(error), "error");
      setStatus("Offline");
    } finally {
      setIsBusy(false);
    }
  };

  const saveBookmark = async () => {
    const page = activePage();

    if (!page) {
      writeMessage("Open a regular http or https page first.", "error");
      return;
    }

    setIsBusy(true);
    writeMessage("Saving bookmark", "neutral");

    try {
      const apiUrl = await getApiBaseUrl();

      await rpcCall(apiUrl, "bookmarks/create", {
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

  const writeMessage = (text: string, tone: MessageTone) => {
    setMessage(text);
    setMessageTone(tone);
  };

  return (
    <main class="popup-shell">
      <header class="popup-header">
        <div>
          <p class="eyebrow">Bookmarks</p>
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

      <form
        class="save-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveBookmark();
        }}
      >
        <label class="field">
          <span>Folder</span>
          <select
            name="folderId"
            value={selectedFolderId()}
            disabled={isFolderSelectDisabled()}
            onChange={(event) => {
              setSelectedFolderId(event.currentTarget.value);
              setSelectedTagIds([]);
            }}
          >
            <Show when={!isFolderSelectDisabled()} fallback={<option value="">No folders found</option>}>
              <For each={currentUser()?.libraries ?? []}>
                {(library) => {
                  const libraryFolders = foldersByLibrary().get(library.id) ?? [];

                  return (
                    <Show when={libraryFolders.length > 0}>
                      <optgroup label={library.name}>
                        <For each={sortFoldersForSelect(libraryFolders)}>
                          {(folder) => <option value={folder.id}>{folderPath(folder, folders())}</option>}
                        </For>
                      </optgroup>
                    </Show>
                  );
                }}
              </For>
            </Show>
          </select>
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
                    <span class="tag-count">{tag.bookmarkCount}</span>
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
          Save bookmark
        </button>
      </form>
    </main>
  );
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

const sortFoldersForSelect = (libraryFolders: FolderItem[]) =>
  [...libraryFolders].sort((left, right) =>
    folderPath(left, libraryFolders).localeCompare(folderPath(right, libraryFolders))
  );

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
  error instanceof Error ? error.message : "Unable to connect to Bookmarks";

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing root element");
}

render(() => <App />, root);
