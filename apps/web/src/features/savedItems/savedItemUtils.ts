import type { InfiniteData } from "@tanstack/react-query";
import type { SavedItem, SavedItemsPageResponse } from "@shelf/shared";

export type SavedItemFilter = {
  folderId: string | null;
  libraryId: string | null;
  tagId: string | null;
};

export const copySavedItemLink = async (url: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

export const hostFromUrl = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

export const isValidSavedItemUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

export const formatSavedItemDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));

export const insertSavedItemIntoPages = (
  data: InfiniteData<SavedItemsPageResponse, string | null> | undefined,
  savedItem: SavedItem,
  replacementId?: string
): InfiniteData<SavedItemsPageResponse, string | null> => {
  if (!data) {
    return {
      pageParams: [null],
      pages: [
        {
          items: [savedItem],
          nextCursor: null
        }
      ]
    };
  }

  const pagesWithoutDuplicate = data.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== savedItem.id && item.id !== replacementId)
  }));
  const [firstPage, ...restPages] = pagesWithoutDuplicate;

  return {
    ...data,
    pages: [
      {
        ...(firstPage ?? { nextCursor: null }),
        items: [savedItem, ...(firstPage?.items ?? [])]
      },
      ...restPages
    ]
  };
};

export const removeSavedItemsFromPages = (
  data: InfiniteData<SavedItemsPageResponse, string | null> | undefined,
  savedItemIds: ReadonlySet<string>
): InfiniteData<SavedItemsPageResponse, string | null> | undefined => {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => !savedItemIds.has(item.id))
    }))
  };
};

export const savedItemQueryKey = (filter: SavedItemFilter): ["savedItems", SavedItemFilter] => [
  "savedItems",
  filter
];

export const savedItemQueryKeysForFolder = (
  folderId: string | null,
  libraryId: string | null = null
): Array<["savedItems", SavedItemFilter]> =>
  folderId
    ? [savedItemQueryKey({ folderId, libraryId, tagId: null })]
    : [savedItemQueryKey({ folderId: null, libraryId, tagId: null })];

export const savedItemQueryKeysForTag = (
  tagId: string,
  libraryId: string | null = null
): Array<["savedItems", SavedItemFilter]> => [
  savedItemQueryKey({ folderId: null, libraryId, tagId })
];
