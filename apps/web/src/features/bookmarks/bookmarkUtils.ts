import type { InfiniteData } from "@tanstack/react-query";
import type { BookmarkItem, BookmarksPageResponse } from "@bookmarks/shared";

export type BookmarkFilter = {
  folderId: string | null;
  libraryId: string | null;
  tagId: string | null;
};

export const copyBookmarkLink = async (url: string) => {
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

export const isValidBookmarkUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

export const formatBookmarkDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));

export const insertBookmarkIntoPages = (
  data: InfiniteData<BookmarksPageResponse, string | null> | undefined,
  bookmark: BookmarkItem,
  replacementId?: string
): InfiniteData<BookmarksPageResponse, string | null> => {
  if (!data) {
    return {
      pageParams: [null],
      pages: [
        {
          items: [bookmark],
          nextCursor: null
        }
      ]
    };
  }

  const pagesWithoutDuplicate = data.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== bookmark.id && item.id !== replacementId)
  }));
  const [firstPage, ...restPages] = pagesWithoutDuplicate;

  return {
    ...data,
    pages: [
      {
        ...(firstPage ?? { nextCursor: null }),
        items: [bookmark, ...(firstPage?.items ?? [])]
      },
      ...restPages
    ]
  };
};

export const removeBookmarksFromPages = (
  data: InfiniteData<BookmarksPageResponse, string | null> | undefined,
  bookmarkIds: ReadonlySet<string>
): InfiniteData<BookmarksPageResponse, string | null> | undefined => {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => !bookmarkIds.has(item.id))
    }))
  };
};

export const bookmarkQueryKey = (filter: BookmarkFilter): ["bookmarks", BookmarkFilter] => [
  "bookmarks",
  filter
];

export const bookmarkQueryKeysForFolder = (
  folderId: string | null,
  libraryId: string | null = null
): Array<["bookmarks", BookmarkFilter]> =>
  folderId
    ? [bookmarkQueryKey({ folderId, libraryId, tagId: null })]
    : [bookmarkQueryKey({ folderId: null, libraryId, tagId: null })];

export const bookmarkQueryKeysForTag = (
  tagId: string,
  libraryId: string | null = null
): Array<["bookmarks", BookmarkFilter]> => [
  bookmarkQueryKey({ folderId: null, libraryId, tagId })
];
