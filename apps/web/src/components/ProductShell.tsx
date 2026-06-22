import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BookmarkItem,
  BookmarksPageResponse,
  CurrentUserResponse,
  FolderItem,
  MoveFolderInput,
  TagItem
} from "@bookmarks/shared";
import {
  IconBookmark,
  IconDatabase,
  IconGripVertical,
  IconLayoutSidebarLeftExpand,
  IconLogout2,
  IconPhoto,
  IconTag
} from "@tabler/icons-react";
import {
  apiAssetUrl,
  getCurrentUser,
  getFolders,
  getTags,
  logout,
  moveFolder as moveFolderRequest,
  moveBookmarks as moveBookmarksRequest
} from "../api";
import { AddBookmarkDialog } from "../features/bookmarks/AddBookmarkDialog";
import { BookmarksWorkspace } from "../features/bookmarks/BookmarksWorkspace";
import {
  bookmarkQueryKey,
  bookmarkQueryKeysForFolder,
  hostFromUrl,
  insertBookmarkIntoPages,
  removeBookmarksFromPages
} from "../features/bookmarks/bookmarkUtils";
import {
  SearchToolbar,
  type BookmarkSearchScope
} from "../features/bookmarks/SearchToolbar";
import { FolderSidebar } from "../features/folders/FolderSidebar";
import { folderPathSegments } from "../features/folders/folderTree";
import {
  DEFAULT_FOLDER_ICON_COLOR,
  getFolderIconComponent
} from "../features/folders/folderIcons";

const STACKED_SIDEBAR_BREAKPOINT = 768;
const SIDEBAR_CLOSE_DRAG_THRESHOLD = 64;

type ActiveRoute =
  | {
      id: string;
      type: "folder";
      workspaceSlug: string | null;
    }
  | {
      type: "inbox";
      workspaceSlug: string | null;
    }
  | {
      id: string;
      type: "tag";
      workspaceSlug: string | null;
    };

type WorkspaceLibrary = CurrentUserResponse["libraries"][number];

type BookmarkSearchState = {
  query: string;
  scope: BookmarkSearchScope;
};

type SidebarTouchState = {
  mode: "pending" | "horizontal" | "vertical";
  width: number;
  x: number;
  y: number;
};

const isStackedSidebarViewport = () =>
  typeof window !== "undefined" && window.innerWidth < STACKED_SIDEBAR_BREAKPOINT;

const routeFromLocation = (): ActiveRoute => {
  if (typeof window === "undefined") {
    return { type: "inbox", workspaceSlug: null };
  }

  const segments = window.location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => safeDecodePathSegment(segment));
  const [firstSegment, secondSegment, thirdSegment] = segments;

  if (firstSegment === "folder" && secondSegment) {
    return { id: secondSegment, type: "folder", workspaceSlug: null };
  }

  if (firstSegment === "tag" && secondSegment) {
    return { id: secondSegment, type: "tag", workspaceSlug: null };
  }

  if (!firstSegment) {
    return { type: "inbox", workspaceSlug: null };
  }

  if (secondSegment === "folder" && thirdSegment) {
    return { id: thirdSegment, type: "folder", workspaceSlug: firstSegment };
  }

  if (secondSegment === "tag" && thirdSegment) {
    return { id: thirdSegment, type: "tag", workspaceSlug: firstSegment };
  }

  return { type: "inbox", workspaceSlug: firstSegment };
};

const searchStateFromLocation = (): BookmarkSearchState => {
  if (typeof window === "undefined") {
    return { query: "", scope: "current" };
  }

  const params = new URLSearchParams(window.location.search);
  const scope = params.get("scope") === "all" ? "all" : "current";

  return {
    query: params.get("q") ?? "",
    scope
  };
};

const writeLocationToHistory = (
  route: ActiveRoute,
  search: BookmarkSearchState,
  mode: "push" | "replace"
) => {
  if (typeof window === "undefined" || !["http:", "https:"].includes(window.location.protocol)) {
    return;
  }

  const path = pathForRoute(route, search);
  const currentPath = `${window.location.pathname}${window.location.search}`;

  if (currentPath === path) {
    return;
  }

  if (mode === "replace") {
    window.history.replaceState(null, "", path);
    return;
  }

  window.history.pushState(null, "", path);
};

const pathForRoute = (route: ActiveRoute, search: BookmarkSearchState = emptySearchState) => {
  const workspaceSlug = encodeURIComponent(route.workspaceSlug ?? "me");
  const searchSuffix = searchParamsForState(search);

  if (route.type === "folder") {
    return `/${workspaceSlug}/folder/${encodeURIComponent(route.id)}${searchSuffix}`;
  }

  if (route.type === "tag") {
    return `/${workspaceSlug}/tag/${encodeURIComponent(route.id)}${searchSuffix}`;
  }

  return `/${workspaceSlug}/${searchSuffix}`;
};

const emptySearchState: BookmarkSearchState = {
  query: "",
  scope: "current"
};

const searchParamsForState = (search: BookmarkSearchState) => {
  const query = search.query.trim();

  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  params.set("q", query);

  if (search.scope === "all") {
    params.set("scope", "all");
  }

  const value = params.toString();

  return value ? `?${value}` : "";
};

const safeDecodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const workspaceSlugForLibrary = (library: WorkspaceLibrary) =>
  library.kind === "personal" ? "me" : (library.organizationSlug ?? slugifyWorkspaceName(library.name));

const workspaceSlugForLibraryId = (libraries: WorkspaceLibrary[], libraryId: string | null) => {
  const library = findWorkspaceById(libraries, libraryId);

  return library ? workspaceSlugForLibrary(library) : null;
};

const findWorkspaceById = (libraries: WorkspaceLibrary[], libraryId: string | null) =>
  libraryId ? (libraries.find((library) => library.id === libraryId) ?? null) : null;

const findWorkspaceBySlug = (libraries: WorkspaceLibrary[], workspaceSlug: string | null) =>
  workspaceSlug
    ? (libraries.find((library) => workspaceSlugForLibrary(library) === workspaceSlug) ?? null)
    : null;

const slugifyWorkspaceName = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "workspace";
};

const shouldHandleBreadcrumbClick = (event: ReactMouseEvent<HTMLAnchorElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey;

export const ProductShell = () => {
  const queryClient = useQueryClient();
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const sidebarTouchStartRef = useRef<SidebarTouchState | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(() => routeFromLocation());
  const [searchState, setSearchState] = useState<BookmarkSearchState>(() =>
    searchStateFromLocation()
  );
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkTargetFolder, setBookmarkTargetFolder] = useState<FolderItem | null>(null);
  const [bookmarkTargetTag, setBookmarkTargetTag] = useState<TagItem | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => !isStackedSidebarViewport());
  const [isStackedSidebar, setIsStackedSidebar] = useState(isStackedSidebarViewport);
  const [activeBookmarkDragItem, setActiveBookmarkDragItem] = useState<BookmarkItem | null>(null);
  const [activeFolderDragId, setActiveFolderDragId] = useState<string | null>(null);
  const [moveNotification, setMoveNotification] = useState<string | null>(null);
  const [sidebarDragOffset, setSidebarDragOffset] = useState(0);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );
  const currentUser = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser
  });
  const folders = useQuery({
    enabled: currentUser.isSuccess,
    queryKey: ["folders"],
    queryFn: getFolders
  });
  const tags = useQuery({
    enabled: currentUser.isSuccess,
    queryKey: ["tags"],
    queryFn: getTags
  });
  const activeFolderId = activeRoute.type === "folder" ? activeRoute.id : null;
  const activeTagId = activeRoute.type === "tag" ? activeRoute.id : null;
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
    }
  });
  const activeFolder = folders.data?.find((folder) => folder.id === activeFolderId) ?? null;
  const activeTag = tags.data?.find((tag) => tag.id === activeTagId) ?? null;
  const workspaceFromRoute = findWorkspaceBySlug(
    currentUser.data?.libraries ?? [],
    activeRoute.workspaceSlug
  );
  const workspaceFromEntity = findWorkspaceById(
    currentUser.data?.libraries ?? [],
    activeFolder?.libraryId ?? activeTag?.libraryId ?? null
  );
  const defaultWorkspace =
    currentUser.data?.libraries.find((library) => library.kind === "personal") ??
    currentUser.data?.libraries[0] ??
    null;
  const activeWorkspace = workspaceFromEntity ?? workspaceFromRoute ?? defaultWorkspace;
  const activeWorkspaceSlug = activeWorkspace
    ? workspaceSlugForLibrary(activeWorkspace)
    : (activeRoute.workspaceSlug ?? "me");
  const activeLibraryId =
    activeWorkspace?.id ?? activeFolder?.libraryId ?? activeTag?.libraryId ?? null;
  const bookmarkTargetLibraryId =
    bookmarkTargetFolder?.libraryId ??
    bookmarkTargetTag?.libraryId ??
    activeTag?.libraryId ??
    activeLibraryId;
  const activeFolderDragItem =
    folders.data?.find((folder) => folder.id === activeFolderDragId) ?? null;
  const activeFolderPath = activeFolder ? folderPathSegments(activeFolder, folders.data ?? []) : [];
  const moveBookmarksMutation = useMutation({
    mutationFn: ({ destinationFolder, ...input }: MoveBookmarksMutationInput) =>
      moveBookmarksRequest({
        bookmarkIds: input.bookmarkIds,
        destinationFolderId: destinationFolder?.id ?? null
      }),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["bookmarks"] }),
        queryClient.cancelQueries({ queryKey: ["folders"] })
      ]);

      const previousBookmarks =
        queryClient.getQueriesData<InfiniteData<BookmarksPageResponse, string | null>>({
          queryKey: ["bookmarks"]
        });
      const previousFolders = queryClient.getQueryData<FolderItem[]>(["folders"]);
      const bookmarkIds = new Set(input.bookmarkIds);
      const movedBookmarks = new Map<string, BookmarkItem>();
      const now = new Date().toISOString();

      for (const [, data] of previousBookmarks) {
        for (const page of data?.pages ?? []) {
          for (const item of page.items) {
            if (bookmarkIds.has(item.id)) {
              movedBookmarks.set(item.id, item);
            }
          }
        }
      }

      for (const [queryKey] of previousBookmarks) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
          queryKey,
          (data) => removeBookmarksFromPages(data, bookmarkIds)
        );
      }

      const destinationFolderId = input.destinationFolder?.id ?? null;
      const destinationLibraryId = input.destinationFolder?.libraryId ?? null;
      const destinationQueryKey = bookmarkQueryKeysForFolder(
        destinationFolderId,
        destinationLibraryId
      )[0];
      const movedItems = [...movedBookmarks.values()]
        .filter((item) => item.folderId !== destinationFolderId)
        .map((item) => ({
          ...item,
          folderId: destinationFolderId,
          folderName: input.destinationFolder?.name ?? null,
          libraryId: input.destinationFolder?.libraryId ?? item.libraryId,
          updatedAt: now
        }));

      if (queryClient.getQueryState(destinationQueryKey)) {
        queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
          destinationQueryKey,
          (data) =>
            movedItems.reduce(
              (currentData, item) => insertBookmarkIntoPages(currentData, item),
              data
            )
        );
      }

      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) => {
        const countDeltas = new Map<string, number>();

        for (const item of movedItems) {
          if (item.folderId) {
            countDeltas.set(item.folderId, (countDeltas.get(item.folderId) ?? 0) + 1);
          }

          const previousFolderId = movedBookmarks.get(item.id)?.folderId;

          if (previousFolderId) {
            countDeltas.set(previousFolderId, (countDeltas.get(previousFolderId) ?? 0) - 1);
          }
        }

        if (countDeltas.size === 0) {
          return currentFolders;
        }

        return currentFolders.map((folder) => {
          const delta = countDeltas.get(folder.id) ?? 0;

          return delta === 0
            ? folder
            : {
                ...folder,
                bookmarkCount: Math.max(0, folder.bookmarkCount + delta),
                updatedAt: now
              };
        });
      });

      return {
        previousBookmarks,
        previousFolders
      };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.previousBookmarks ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      if (context?.previousFolders) {
        queryClient.setQueryData(["folders"], context.previousFolders);
      }

      setMoveNotification("Bookmark could not be moved");
    },
    onSuccess: (result) => {
      const count = result.movedBookmarkIds.length;
      setMoveNotification(count === 1 ? "Moved 1 bookmark" : `Moved ${count} bookmarks`);
    },
    onSettled: (_result, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });

      const destinationFolderId = input.destinationFolder?.id ?? null;
      const destinationLibraryId = input.destinationFolder?.libraryId ?? null;
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: bookmarkQueryKey({
          folderId: destinationFolderId,
          libraryId: destinationLibraryId,
          tagId: null
        })
      });
    }
  });
  const moveFolderMutation = useMutation({
    mutationFn: moveFolderRequest,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["folders"] });

      const previousFolders = queryClient.getQueryData<FolderItem[]>(["folders"]);

      queryClient.setQueryData<FolderItem[]>(["folders"], (currentFolders = []) =>
        applyFolderMove(currentFolders, input)
      );

      return { previousFolders };
    },
    onError: (_error, _input, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(["folders"], context.previousFolders);
      }

      setMoveNotification("Folder could not be moved");
    },
    onSuccess: (nextFolders) => {
      queryClient.setQueryData(["folders"], nextFolders);
      setMoveNotification("Folder moved");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    }
  });

  useEffect(() => {
    const syncSidebarViewport = () => setIsStackedSidebar(isStackedSidebarViewport());

    syncSidebarViewport();
    window.addEventListener("resize", syncSidebarViewport);

    return () => window.removeEventListener("resize", syncSidebarViewport);
  }, []);

  useEffect(() => {
    const syncRouteFromLocation = () => {
      setActiveRoute(routeFromLocation());
      setSearchState(searchStateFromLocation());
    };

    window.addEventListener("popstate", syncRouteFromLocation);

    return () => window.removeEventListener("popstate", syncRouteFromLocation);
  }, []);

  const navigateToRoute = useCallback((route: ActiveRoute, mode: "push" | "replace" = "push") => {
    setActiveRoute(route);
    setSearchState(emptySearchState);
    writeLocationToHistory(route, emptySearchState, mode);
  }, []);

  const updateSearchState = useCallback(
    (nextSearchState: BookmarkSearchState, mode: "push" | "replace" = "replace") => {
      setSearchState(nextSearchState);
      writeLocationToHistory(activeRoute, nextSearchState, mode);
    },
    [activeRoute]
  );

  useEffect(() => {
    if (activeRoute.type === "folder" && folders.isSuccess && !activeFolder) {
      navigateToRoute({ type: "inbox", workspaceSlug: activeWorkspaceSlug }, "replace");
    }
  }, [activeFolder, activeRoute, activeWorkspaceSlug, folders.isSuccess, navigateToRoute]);

  useEffect(() => {
    if (activeRoute.type === "tag" && tags.isSuccess && !activeTag) {
      navigateToRoute({ type: "inbox", workspaceSlug: activeWorkspaceSlug }, "replace");
    }
  }, [activeRoute, activeTag, activeWorkspaceSlug, navigateToRoute, tags.isSuccess]);

  useEffect(() => {
    if (!currentUser.data || !activeWorkspace || activeRoute.workspaceSlug === activeWorkspaceSlug) {
      return;
    }

    navigateToRoute({ ...activeRoute, workspaceSlug: activeWorkspaceSlug }, "replace");
  }, [activeRoute, activeWorkspace, activeWorkspaceSlug, currentUser.data, navigateToRoute]);

  useEffect(() => {
    if (!isSidebarVisible || !isStackedSidebar) {
      return;
    }

    const scrollY = window.scrollY;
    const { style } = document.body;
    const previousBodyStyles = {
      overflow: style.overflow,
      position: style.position,
      top: style.top,
      width: style.width
    };
    const previousRootOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";

    let touchStartX = 0;
    let touchStartY = 0;
    const preventScroll = (event: Event) => event.preventDefault();
    const captureTouchStart = (event: Event) => {
      const touch = (event as TouchEvent).touches[0];

      if (!touch) {
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };
    const containTouchMove = (event: Event) => {
      const touchEvent = event as TouchEvent;

      if (touchEvent.touches.length !== 1) {
        return;
      }

      const touch = touchEvent.touches[0];
      const scrollContainer = sidebarScrollRef.current;

      if (!touch || !scrollContainer || !(event.target instanceof Node)) {
        event.preventDefault();
        return;
      }

      if (!scrollContainer.contains(event.target)) {
        event.preventDefault();
        return;
      }

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        event.preventDefault();
        return;
      }

      const canScrollVertically = scrollContainer.scrollHeight > scrollContainer.clientHeight;

      if (!canScrollVertically) {
        event.preventDefault();
        return;
      }

      const isPullingPastTop = deltaY > 0 && scrollContainer.scrollTop <= 0;
      const isPullingPastBottom =
        deltaY < 0 &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1;

      if (isPullingPastTop || isPullingPastBottom) {
        event.preventDefault();
      }
    };

    window.addEventListener("scroll", preventScroll, { passive: false });
    document.addEventListener("touchstart", captureTouchStart, { passive: true });
    document.addEventListener("touchmove", containTouchMove, { passive: false, capture: true });

    return () => {
      window.removeEventListener("scroll", preventScroll);
      document.removeEventListener("touchstart", captureTouchStart);
      document.removeEventListener("touchmove", containTouchMove, { capture: true });
      document.documentElement.style.overflow = previousRootOverflow;
      style.overflow = previousBodyStyles.overflow;
      style.position = previousBodyStyles.position;
      style.top = previousBodyStyles.top;
      style.width = previousBodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [isSidebarVisible, isStackedSidebar]);

  useEffect(() => {
    if (!moveNotification) {
      return;
    }

    const timeout = window.setTimeout(() => setMoveNotification(null), 2200);

    return () => window.clearTimeout(timeout);
  }, [moveNotification]);

  const openBookmarkDialog = ({
    folder,
    tag
  }: {
    folder: FolderItem | null;
    tag: TagItem | null;
  }) => {
    setBookmarkTargetFolder(folder);
    setBookmarkTargetTag(tag);
    setBookmarkDialogOpen(true);
  };

  const updateBookmarkDialogOpen = (open: boolean) => {
    setBookmarkDialogOpen(open);

    if (!open) {
      setBookmarkTargetFolder(null);
      setBookmarkTargetTag(null);
    }
  };

  const selectFolder = (folderId: string | null, libraryId?: string | null) => {
    const folderWorkspaceSlug =
      folderId && folders.data
        ? workspaceSlugForLibraryId(
            currentUser.data?.libraries ?? [],
            folders.data.find((folder) => folder.id === folderId)?.libraryId ?? null
          )
        : null;
    const inboxWorkspaceSlug = workspaceSlugForLibraryId(
      currentUser.data?.libraries ?? [],
      libraryId ?? activeLibraryId
    );
    const workspaceSlug = folderWorkspaceSlug ?? inboxWorkspaceSlug ?? activeWorkspaceSlug;

    navigateToRoute(
      folderId
        ? { id: folderId, type: "folder", workspaceSlug }
        : { type: "inbox", workspaceSlug }
    );

    if (isStackedSidebar) {
      setIsSidebarVisible(false);
    }
  };

  const selectTag = (tagId: string) => {
    const workspaceSlug =
      workspaceSlugForLibraryId(
        currentUser.data?.libraries ?? [],
        tags.data?.find((tag) => tag.id === tagId)?.libraryId ?? null
      ) ?? activeWorkspaceSlug;

    navigateToRoute({ id: tagId, type: "tag", workspaceSlug });

    if (isStackedSidebar) {
      setIsSidebarVisible(false);
    }
  };

  const moveBookmarksToFolder = (bookmarkIds: string[], destinationFolder: FolderItem | null) => {
    const uniqueBookmarkIds = [...new Set(bookmarkIds)].filter(Boolean);

    if (uniqueBookmarkIds.length === 0) {
      return;
    }

    moveBookmarksMutation.mutate({
      bookmarkIds: uniqueBookmarkIds,
      destinationFolder
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;

    setActiveBookmarkDragItem(isBookmarkDragData(activeData) ? activeData.item : null);
    setActiveFolderDragId(isFolderDragData(activeData) ? activeData.folderId : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current;
    const overData = event.over?.data.current;

    setActiveFolderDragId(null);
    setActiveBookmarkDragItem(null);

    if (isBookmarkDragData(activeData) && isFolderDropData(overData)) {
      const destinationFolder = overData.folder;
      const destinationFolderId = destinationFolder?.id ?? null;

      if (activeData.sourceFolderId === destinationFolderId) {
        return;
      }

      moveBookmarksToFolder(activeData.bookmarkIds, destinationFolder);
      return;
    }

    if (!isFolderDragData(activeData) || !overData || !folders.data) {
      return;
    }

    const moveInput = buildFolderMoveInput(activeData, overData, folders.data);

    if (!moveInput) {
      return;
    }

    moveFolderMutation.mutate(moveInput);
  };

  const handleDragCancel = () => {
    setActiveFolderDragId(null);
    setActiveBookmarkDragItem(null);
  };

  const handleSidebarTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];

    if (!isStackedSidebar || !isSidebarVisible || !touch) {
      sidebarTouchStartRef.current = null;
      setSidebarDragOffset(0);
      return;
    }

    sidebarTouchStartRef.current = {
      mode: "pending",
      width: event.currentTarget.getBoundingClientRect().width || 300,
      x: touch.clientX,
      y: touch.clientY
    };
    setSidebarDragOffset(0);
  };

  const handleSidebarTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const start = sidebarTouchStartRef.current;
    const touch = event.touches[0];

    if (!isStackedSidebar || !start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (start.mode === "pending") {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
        return;
      }

      start.mode = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? "horizontal" : "vertical";
    }

    if (start.mode !== "horizontal") {
      return;
    }

    event.preventDefault();
    setSidebarDragOffset(Math.max(-start.width, Math.min(0, deltaX)));
  };

  const handleSidebarTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const start = sidebarTouchStartRef.current;
    const touch = event.changedTouches[0];
    sidebarTouchStartRef.current = null;

    if (!isStackedSidebar || !start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isLeftSwipe =
      start.mode === "horizontal" &&
      deltaX < -SIDEBAR_CLOSE_DRAG_THRESHOLD &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

    if (isLeftSwipe) {
      setIsSidebarVisible(false);
    }

    setSidebarDragOffset(0);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
    >
      <main className="min-h-dvh w-full max-w-full overflow-x-hidden bg-gray-50 font-sans text-slate-950 md:flex md:h-screen md:overflow-hidden">
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 h-dvh max-h-dvh w-[min(360px,calc(100vw-48px))] touch-pan-y overflow-hidden overscroll-contain bg-gray-50 text-slate-950 transition-[transform,opacity,width,border-color] duration-300 ease-out md:static md:h-screen md:max-h-none md:shrink-0",
          sidebarDragOffset < 0 ? "transition-none" : "",
          isSidebarVisible
            ? "translate-x-0 opacity-100 shadow-[16px_0_44px_rgb(15_23_42_/_0.14)] md:w-[340px] md:shadow-none"
            : "pointer-events-none -translate-x-full opacity-0 md:w-0"
        ].join(" ")}
        aria-label="Primary"
        aria-hidden={!isSidebarVisible}
        style={
          sidebarDragOffset < 0
            ? { transform: `translate3d(${sidebarDragOffset}px, 0, 0)` }
            : undefined
        }
        onTouchStart={handleSidebarTouchStart}
        onTouchMove={handleSidebarTouchMove}
        onTouchEnd={handleSidebarTouchEnd}
      >
        <div
          className="h-full w-[min(360px,calc(100vw-48px))] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 md:w-[340px] md:px-6 md:py-5"
          ref={sidebarScrollRef}
        >
          <FolderSidebar
            activeFolderId={activeFolderId}
            activeTagId={activeTagId}
            currentUser={currentUser.data}
            folders={folders.data ?? []}
            isError={folders.isError}
            isLoading={folders.isLoading}
            isTagsError={tags.isError}
            isTagsLoading={tags.isLoading}
            tags={tags.data ?? []}
            activeFolderDragId={activeFolderDragId}
            onAddBookmark={openBookmarkDialog}
            onHideSidebar={() => setIsSidebarVisible(false)}
            onSelectFolder={selectFolder}
            onSelectTag={selectTag}
          />
        </div>
      </aside>

      <section
        className="flex w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden p-5 md:h-screen md:flex-1 md:overflow-y-auto md:p-7"
        aria-label="Items workspace"
      >
        <header
          className={[
            "grid items-center gap-3",
            isSidebarVisible
              ? "grid-cols-[minmax(0,1fr)_2.5rem]"
              : "grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]"
          ].join(" ")}
        >
          {!isSidebarVisible ? (
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-slate-950 outline-none hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label="Show sidebar"
              title="Show sidebar"
              type="button"
              onClick={() => setIsSidebarVisible(true)}
            >
              <IconLayoutSidebarLeftExpand
                size={23}
                stroke={1.5}
                aria-hidden="true"
                focusable="false"
              />
            </button>
          ) : null}
          <div className="min-w-0">
            {activeTag ? (
              <TagBreadcrumb
                tag={activeTag}
                workspaceSlug={activeWorkspaceSlug}
                onNavigate={navigateToRoute}
              />
            ) : (
              <FolderBreadcrumbs
                folders={activeFolderPath}
                workspaceSlug={activeWorkspaceSlug}
                onNavigate={navigateToRoute}
              />
            )}
          </div>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-slate-950 outline-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label="Log out"
            title="Log out"
            type="button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            <IconLogout2 size={22} stroke={1.5} aria-hidden="true" focusable="false" />
          </button>
        </header>

        <SearchToolbar
          query={searchState.query}
          scope={searchState.scope}
          workspaceName={activeWorkspace?.name ?? "Current workspace"}
          onQueryChange={(query) =>
            updateSearchState({
              query,
              scope: searchState.scope
            })
          }
          onScopeChange={(scope) =>
            updateSearchState(
              {
                query: searchState.query,
                scope
              },
              "push"
            )
          }
        />

        <BookmarksWorkspace
          folderId={activeFolderId}
          folderName={activeFolder?.name ?? null}
          libraryId={activeLibraryId}
          searchQuery={searchState.query}
          searchScope={searchState.scope}
          tagId={activeTagId}
          tagName={activeTag?.name ?? null}
        />
      </section>
      <AddBookmarkDialog
        isOpen={bookmarkDialogOpen}
        targetFolder={bookmarkTargetFolder}
        targetLibraryId={bookmarkTargetLibraryId}
        targetTagId={bookmarkTargetTag?.id ?? activeTagId}
        tags={tags.data ?? []}
        visibleFolderId={activeFolderId}
        visibleLibraryId={activeLibraryId}
        visibleTagId={activeTagId}
        onOpenChange={updateBookmarkDialogOpen}
      />
      {moveNotification ? (
        <div
          className="fixed right-4 bottom-4 z-40 rounded-lg border border-[#dfe4ef] bg-white px-3 py-2 text-sm font-extrabold text-[#242833] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
          role="status"
          aria-live="polite"
        >
          {moveNotification}
        </div>
      ) : null}
      </main>
      <DragOverlay zIndex={1000}>
        {activeBookmarkDragItem ? <BookmarkDragPreview item={activeBookmarkDragItem} /> : null}
        {!activeBookmarkDragItem && activeFolderDragItem ? (
          <FolderDragPreview folder={activeFolderDragItem} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

type MoveBookmarksMutationInput = {
  bookmarkIds: string[];
  destinationFolder: FolderItem | null;
};

type BookmarkDragData = {
  bookmarkIds: string[];
  item: BookmarkItem;
  sourceFolderId: string | null;
  type: "bookmark";
};

type FolderDragData = {
  folderId: string;
  libraryId: string;
  parentId: string | null;
  type: "folder-drag";
};

type FolderDropData = {
  folder: FolderItem | null;
  type: "folder";
};

type FolderPositionDropData = {
  libraryId: string;
  parentId: string | null;
  position: "before" | "after";
  relativeFolderId: string;
  type: "folder-position";
};

type FolderRootDropData = {
  libraryId: string;
  type: "folder-root";
};

const isBookmarkDragData = (value: unknown): value is BookmarkDragData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as BookmarkDragData;

  return (
    data.type === "bookmark" &&
    Array.isArray(data.bookmarkIds) &&
    data.bookmarkIds.every((bookmarkId) => typeof bookmarkId === "string" && bookmarkId) &&
    isBookmarkItem(data.item) &&
    (typeof data.sourceFolderId === "string" || data.sourceFolderId === null)
  );
};

const isBookmarkItem = (value: unknown): value is BookmarkItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as BookmarkItem;

  return typeof item.id === "string" && typeof item.url === "string";
};

const isFolderDragData = (value: unknown): value is FolderDragData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as FolderDragData;

  return (
    data.type === "folder-drag" &&
    typeof data.folderId === "string" &&
    Boolean(data.folderId) &&
    typeof data.libraryId === "string" &&
    Boolean(data.libraryId) &&
    (typeof data.parentId === "string" || data.parentId === null)
  );
};

const isFolderDropData = (value: unknown): value is FolderDropData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as FolderDropData;

  return data.type === "folder" && (data.folder === null || typeof data.folder.id === "string");
};

const isFolderPositionDropData = (value: unknown): value is FolderPositionDropData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as FolderPositionDropData;

  return (
    data.type === "folder-position" &&
    typeof data.libraryId === "string" &&
    (typeof data.parentId === "string" || data.parentId === null) &&
    typeof data.relativeFolderId === "string" &&
    (data.position === "before" || data.position === "after")
  );
};

const isFolderRootDropData = (value: unknown): value is FolderRootDropData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as FolderRootDropData;

  return data.type === "folder-root" && typeof data.libraryId === "string";
};

const buildFolderMoveInput = (
  activeData: FolderDragData,
  overData: unknown,
  folders: FolderItem[]
): MoveFolderInput | null => {
  const draggedFolder = folders.find((folder) => folder.id === activeData.folderId);

  if (!draggedFolder) {
    return null;
  }

  if (isFolderDropData(overData) && overData.folder) {
    const destinationParentId = overData.folder.id;

    if (destinationParentId === draggedFolder.parentId || destinationParentId === draggedFolder.id) {
      return null;
    }

    return {
      folderId: draggedFolder.id,
      orderedSiblingIds: appendFolderToSiblings(folders, draggedFolder, destinationParentId),
      parentId: destinationParentId
    };
  }

  if (isFolderRootDropData(overData)) {
    if (overData.libraryId !== draggedFolder.libraryId) {
      return null;
    }

    return {
      folderId: draggedFolder.id,
      orderedSiblingIds: appendFolderToSiblings(folders, draggedFolder, null),
      parentId: null
    };
  }

  if (isFolderPositionDropData(overData)) {
    if (
      overData.libraryId !== draggedFolder.libraryId ||
      overData.relativeFolderId === draggedFolder.id
    ) {
      return null;
    }

    return {
      folderId: draggedFolder.id,
      orderedSiblingIds: insertFolderNearSibling(folders, draggedFolder, overData),
      parentId: overData.parentId
    };
  }

  return null;
};

const appendFolderToSiblings = (
  folders: FolderItem[],
  draggedFolder: FolderItem,
  parentId: string | null
) => [
  ...folders
    .filter(
      (folder) =>
        folder.libraryId === draggedFolder.libraryId &&
        folder.parentId === parentId &&
        folder.id !== draggedFolder.id
    )
    .sort(compareFolders)
    .map((folder) => folder.id),
  draggedFolder.id
];

const insertFolderNearSibling = (
  folders: FolderItem[],
  draggedFolder: FolderItem,
  drop: FolderPositionDropData
) => {
  const siblingIds = folders
    .filter(
      (folder) =>
        folder.libraryId === draggedFolder.libraryId &&
        folder.parentId === drop.parentId &&
        folder.id !== draggedFolder.id
    )
    .sort(compareFolders)
    .map((folder) => folder.id);
  const relativeIndex = siblingIds.indexOf(drop.relativeFolderId);

  if (relativeIndex < 0) {
    return appendFolderToSiblings(folders, draggedFolder, drop.parentId);
  }

  siblingIds.splice(drop.position === "before" ? relativeIndex : relativeIndex + 1, 0, draggedFolder.id);

  return siblingIds;
};

const applyFolderMove = (folders: FolderItem[], input: MoveFolderInput): FolderItem[] => {
  const sortOrderById = new Map(input.orderedSiblingIds.map((folderId, index) => [folderId, index]));
  const now = new Date().toISOString();

  return folders.map((folder) => {
    if (folder.id === input.folderId) {
      return {
        ...folder,
        parentId: input.parentId ?? null,
        sortOrder: sortOrderById.get(folder.id) ?? folder.sortOrder,
        updatedAt: now
      };
    }

    const sortOrder = sortOrderById.get(folder.id);

    return typeof sortOrder === "number"
      ? {
          ...folder,
          sortOrder,
          updatedAt: now
        }
      : folder;
  });
};

const compareFolders = (left: FolderItem, right: FolderItem) =>
  left.sortOrder - right.sortOrder ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);

const BookmarkDragPreview = ({ item }: { item: BookmarkItem }) => {
  const host = hostFromUrl(item.url);
  const title = item.title || host || item.url;

  return (
    <article className="w-[min(620px,calc(100vw-24px))] overflow-hidden rounded-lg border border-[#3b8df5] bg-white p-4 opacity-95 shadow-[0_24px_80px_rgb(22_28_43_/_0.24)]">
      <div className="grid min-w-0 grid-cols-[1.25rem_72px_minmax(0,1fr)] gap-3">
        <div className="flex h-full min-h-10 items-center justify-center text-[#9aa1ad]">
          <IconGripVertical size={17} stroke={1.5} aria-hidden="true" focusable="false" />
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#f3f5f9]">
          {item.imageUrl ? (
            <img
              className="h-full w-full object-cover"
              src={item.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[#f7f8fc] text-[#9aa1ad]">
              <IconPhoto size={24} stroke={1.5} aria-hidden="true" focusable="false" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#fbfcff]">
            {item.faviconUrl ? (
              <img
                className="h-5 w-5 object-contain"
                src={apiAssetUrl(item.faviconUrl)}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <IconBookmark size={19} stroke={1.5} aria-hidden="true" focusable="false" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="m-0 truncate text-lg leading-[1.25] font-extrabold">{title}</h2>
            <p className="mt-1 mb-0 truncate text-sm font-semibold text-[#2f80ed]">{item.url}</p>
          </div>
        </div>
      </div>
    </article>
  );
};

const FolderDragPreview = ({ folder }: { folder: FolderItem }) => {
  const FolderIcon = getFolderIconComponent(folder.iconName);
  const folderIconColor = folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR;

  return (
    <div className="grid w-[min(280px,calc(100vw-32px))] grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center gap-1 rounded-xl border border-blue-500 bg-white py-0.5 text-slate-950 opacity-95 shadow-[0_24px_80px_rgb(15_23_42_/_0.24)]">
      <div className="flex min-h-9 min-w-0 items-center gap-1">
        <span className="grid h-7 w-6 shrink-0 place-items-center text-gray-400" aria-hidden="true">
          <IconGripVertical size={15} stroke={1.5} aria-hidden="true" focusable="false" />
        </span>
        <span className="flex min-h-9 min-w-0 flex-1 items-center gap-2 pr-2.5 text-sm font-medium">
          <FolderIcon
            size={21}
            stroke={1.5}
            color={folderIconColor}
            aria-hidden="true"
            focusable="false"
          />
          <span className="truncate">{folder.name}</span>
        </span>
      </div>
      <span className="grid h-9 place-items-center text-xs font-extrabold text-gray-400">
        {folder.bookmarkCount > 0 ? folder.bookmarkCount : null}
      </span>
      <span aria-hidden="true" />
    </div>
  );
};

const FolderBreadcrumbs = ({
  folders,
  workspaceSlug,
  onNavigate
}: {
  folders: FolderItem[];
  workspaceSlug: string;
  onNavigate: (route: ActiveRoute) => void;
}) => {
  const label = folders.length > 0 ? folders.map((folder) => folder.name).join(" / ") : "Inbox";
  const inboxRoute = { type: "inbox", workspaceSlug } satisfies ActiveRoute;

  return (
    <h1
      className="m-0 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5 font-semibold"
      aria-label={label}
    >
      <BreadcrumbLink route={inboxRoute} title="Inbox" onNavigate={onNavigate}>
        <IconDatabase
          className="shrink-0 text-gray-500"
          size={16}
          stroke={1.5}
          aria-hidden="true"
          focusable="false"
        />
      </BreadcrumbLink>
      <BreadcrumbSeparator />
      {folders.length > 0 ? (
        folders.map((folder, index) => (
          <BreadcrumbFolder
            folder={folder}
            key={folder.id}
            isLast={index === folders.length - 1}
            workspaceSlug={workspaceSlug}
            onNavigate={onNavigate}
          />
        ))
      ) : (
        <BreadcrumbLink route={inboxRoute} isCurrent onNavigate={onNavigate}>
          <IconBookmark
            className="shrink-0 text-[#3b8df5]"
            size={16}
            stroke={1.5}
            aria-hidden="true"
            focusable="false"
          />
          <span className="min-w-0 truncate">Inbox</span>
        </BreadcrumbLink>
      )}
    </h1>
  );
};

const TagBreadcrumb = ({
  tag,
  workspaceSlug,
  onNavigate
}: {
  tag: TagItem;
  workspaceSlug: string;
  onNavigate: (route: ActiveRoute) => void;
}) => (
  <h1
    className="m-0 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5 font-semibold"
    aria-label={tag.name}
  >
    <BreadcrumbLink
      route={{ type: "inbox", workspaceSlug }}
      title="Inbox"
      onNavigate={onNavigate}
    >
      <IconDatabase
        className="shrink-0 text-gray-500"
        size={16}
        stroke={1.5}
        aria-hidden="true"
        focusable="false"
      />
    </BreadcrumbLink>
    <BreadcrumbSeparator />
    <BreadcrumbLink route={{ id: tag.id, type: "tag", workspaceSlug }} isCurrent onNavigate={onNavigate}>
      <IconTag
        className="shrink-0"
        size={16}
        stroke={1.5}
        color={tag.color ?? "#697080"}
        aria-hidden="true"
        focusable="false"
      />
      <span className="min-w-0 truncate">{tag.name}</span>
    </BreadcrumbLink>
  </h1>
);

const BreadcrumbFolder = ({
  folder,
  isLast,
  workspaceSlug,
  onNavigate
}: {
  folder: FolderItem;
  isLast: boolean;
  workspaceSlug: string;
  onNavigate: (route: ActiveRoute) => void;
}) => {
  const FolderIcon = getFolderIconComponent(folder.iconName);
  const route = { id: folder.id, type: "folder", workspaceSlug } satisfies ActiveRoute;

  return (
    <>
      <BreadcrumbLink route={route} isCurrent={isLast} onNavigate={onNavigate}>
        <FolderIcon
          className="shrink-0"
          size={16}
          stroke={1.5}
          color={folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR}
          aria-hidden="true"
          focusable="false"
        />
        <span className="min-w-0 truncate">{folder.name}</span>
      </BreadcrumbLink>
      {isLast ? null : <BreadcrumbSeparator />}
    </>
  );
};

const BreadcrumbLink = ({
  children,
  isCurrent = false,
  route,
  title,
  onNavigate
}: {
  children: ReactNode;
  isCurrent?: boolean;
  route: ActiveRoute;
  title?: string;
  onNavigate: (route: ActiveRoute) => void;
}) => (
  <a
    className="inline-flex min-w-0 items-center gap-1 rounded-md text-inherit no-underline outline-none hover:text-[#2f80ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    aria-current={isCurrent ? "page" : undefined}
    href={pathForRoute(route)}
    title={title}
    onClick={(event) => {
      if (shouldHandleBreadcrumbClick(event)) {
        event.preventDefault();
        onNavigate(route);
      }
    }}
  >
    {children}
  </a>
);

const BreadcrumbSeparator = () => (
  <span className="shrink-0 text-sm leading-none font-medium text-gray-300" aria-hidden="true">
    /
  </span>
);
