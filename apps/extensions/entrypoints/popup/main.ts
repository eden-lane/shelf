import "./style.css";
import { browser } from "wxt/browser";

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

const defaultApiUrl = "http://localhost:3000";
const storageKey = "apiBaseUrl";

const pageTitle = document.querySelector<HTMLParagraphElement>("#page-title");
const pageUrl = document.querySelector<HTMLParagraphElement>("#page-url");
const apiUrlInput = document.querySelector<HTMLInputElement>("#api-url");
const folderSelect = document.querySelector<HTMLSelectElement>("#folder-select");
const tagList = document.querySelector<HTMLDivElement>("#tag-list");
const form = document.querySelector<HTMLFormElement>("#save-form");
const saveButton = document.querySelector<HTMLButtonElement>("#save-button");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button");
const message = document.querySelector<HTMLParagraphElement>("#message");
const statusPill = document.querySelector<HTMLDivElement>("#status-pill");

let activePage: ActivePage | null = null;
let folders: FolderItem[] = [];
let tags: TagItem[] = [];
let currentUser: CurrentUserResponse | null = null;

const requireElement = <T extends Element>(element: T | null, name: string): T => {
  if (!element) {
    throw new Error(`Missing ${name}`);
  }

  return element;
};

const elements = {
  apiUrlInput: requireElement(apiUrlInput, "api URL input"),
  folderSelect: requireElement(folderSelect, "folder select"),
  form: requireElement(form, "save form"),
  message: requireElement(message, "message"),
  pageTitle: requireElement(pageTitle, "page title"),
  pageUrl: requireElement(pageUrl, "page URL"),
  refreshButton: requireElement(refreshButton, "refresh button"),
  saveButton: requireElement(saveButton, "save button"),
  statusPill: requireElement(statusPill, "status pill"),
  tagList: requireElement(tagList, "tag list")
};

const initialize = async () => {
  elements.saveButton.disabled = true;
  activePage = await getActivePage();
  renderActivePage();

  const savedApiUrl = await browser.storage.local.get(storageKey);
  elements.apiUrlInput.value =
    typeof savedApiUrl[storageKey] === "string" ? savedApiUrl[storageKey] : defaultApiUrl;

  await loadAppData();
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

const renderActivePage = () => {
  if (!activePage) {
    elements.pageTitle.textContent = "This page cannot be saved";
    elements.pageUrl.textContent = "Open a regular http or https page first.";
    return;
  }

  elements.pageTitle.textContent = activePage.title;
  elements.pageUrl.textContent = activePage.url;
};

const loadAppData = async () => {
  setBusy(true);
  setMessage("Loading folders and tags", "neutral");

  try {
    const apiUrl = normalizeApiUrl(elements.apiUrlInput.value);
    await browser.storage.local.set({ [storageKey]: apiUrl });

    const [userResponse, folderResponse, tagResponse] = await Promise.all([
      rpcCall<CurrentUserResponse>(apiUrl, "currentUser", undefined),
      rpcCall<FolderItem[]>(apiUrl, "folders/list", null),
      rpcCall<TagItem[]>(apiUrl, "tags/list", null)
    ]);

    currentUser = userResponse;
    folders = folderResponse;
    tags = tagResponse;
    renderFolders();
    renderTags();
    setMessage("", "neutral");
    setStatus("Ready");
  } catch (error) {
    setMessage(errorMessage(error), "error");
    setStatus("Offline");
  } finally {
    setBusy(false);
  }
};

const renderFolders = () => {
  elements.folderSelect.replaceChildren();

  if (!currentUser || folders.length === 0) {
    elements.folderSelect.append(new Option("No folders found", ""));
    elements.folderSelect.disabled = true;
    return;
  }

  elements.folderSelect.disabled = false;
  const foldersByLibrary = new Map<string, FolderItem[]>();

  for (const folder of folders) {
    foldersByLibrary.set(folder.libraryId, [...(foldersByLibrary.get(folder.libraryId) ?? []), folder]);
  }

  for (const library of currentUser.libraries) {
    const libraryFolders = foldersByLibrary.get(library.id) ?? [];

    if (libraryFolders.length === 0) {
      continue;
    }

    const group = document.createElement("optgroup");
    group.label = library.name;

    for (const folder of sortFoldersForSelect(libraryFolders)) {
      group.append(new Option(folderPath(folder, folders), folder.id));
    }

    elements.folderSelect.append(group);
  }

  const inboxFolderId = currentUser.libraries[0]?.inboxFolderId;

  if (inboxFolderId) {
    elements.folderSelect.value = inboxFolderId;
  }
};

const renderTags = () => {
  elements.tagList.replaceChildren();
  const selectedFolder = folders.find((folder) => folder.id === elements.folderSelect.value) ?? null;
  const visibleTags = selectedFolder
    ? tags.filter((tag) => tag.libraryId === selectedFolder.libraryId)
    : [];

  if (visibleTags.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No tags in this folder library";
    elements.tagList.append(empty);
    return;
  }

  for (const tag of visibleTags) {
    const label = document.createElement("label");
    label.className = "tag-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "tagIds";
    input.value = tag.id;

    const text = document.createElement("span");
    text.textContent = tag.name;

    const count = document.createElement("span");
    count.className = "tag-count";
    count.textContent = String(tag.bookmarkCount);

    label.append(input, text, count);
    elements.tagList.append(label);
  }
};

const saveBookmark = async () => {
  if (!activePage) {
    setMessage("Open a regular http or https page first.", "error");
    return;
  }

  setBusy(true);
  setMessage("Saving bookmark", "neutral");

  try {
    const apiUrl = normalizeApiUrl(elements.apiUrlInput.value);
    await browser.storage.local.set({ [storageKey]: apiUrl });

    const tagIds = Array.from(
      elements.tagList.querySelectorAll<HTMLInputElement>('input[name="tagIds"]:checked')
    ).map((input) => input.value);

    await rpcCall(apiUrl, "bookmarks/create", {
      folderId: elements.folderSelect.value || undefined,
      tagIds,
      url: activePage.url
    });

    setMessage("Saved", "success");
    setStatus("Saved");
  } catch (error) {
    setMessage(errorMessage(error), "error");
    setStatus("Error");
  } finally {
    setBusy(false);
  }
};

const rpcCall = async <T>(apiUrl: string, path: string, input: unknown): Promise<T> => {
  const response = await fetch(`${apiUrl}/rpc/${path}`, {
    body: JSON.stringify({ json: input }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readRpcError(body) ?? `Request failed with ${response.status}`);
  }

  return body?.json as T;
};

const normalizeApiUrl = (value: string) => {
  const url = new URL(value || defaultApiUrl);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
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

const readRpcError = (body: unknown) => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const error = "error" in body ? body.error : null;

  if (!error || typeof error !== "object") {
    return null;
  }

  const message = "message" in error ? error.message : null;

  return typeof message === "string" ? message : null;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to connect to Bookmarks";

const setBusy = (isBusy: boolean) => {
  elements.saveButton.disabled = isBusy || !activePage || elements.folderSelect.disabled;
  elements.refreshButton.disabled = isBusy;
  elements.apiUrlInput.disabled = isBusy;
};

const setMessage = (text: string, tone: "error" | "neutral" | "success") => {
  elements.message.textContent = text;
  elements.message.dataset.tone = tone;
};

const setStatus = (text: string) => {
  elements.statusPill.hidden = false;
  elements.statusPill.textContent = text;
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveBookmark();
});

elements.refreshButton.addEventListener("click", () => {
  void loadAppData();
});

elements.folderSelect.addEventListener("change", () => {
  renderTags();
});

void initialize();
