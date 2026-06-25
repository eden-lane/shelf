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
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SavedItem,
  SavedItemsPageResponse,
  ConnectedApp,
  CurrentUserResponse,
  FolderItem,
  MoveFolderInput,
  MoveTagInput,
  TagItem
} from "@shelf/shared";
import {
  IconCards,
  IconLink,
  IconDatabase,
  IconGripVertical,
  IconLayoutList,
  IconLayoutSidebarLeftExpand,
  IconPhoto,
  IconPlugConnected,
  IconSearch,
  IconTag
} from "@tabler/icons-react";
import {
  addTagToSavedItem,
  apiAssetUrl,
  getConnectedApps,
  getCurrentUser,
  getFolders,
  getTags,
  logout,
  moveFolder as moveFolderRequest,
  moveSavedItems as moveSavedItemsRequest,
  moveTag as moveTagRequest,
  revokeConnectedApp
} from "../api";
import { AddSavedItemDialog } from "../features/savedItems/AddSavedItemDialog";
import { SavedItemsWorkspace } from "../features/savedItems/SavedItemsWorkspace";
import type { SavedItemsViewMode } from "../features/savedItems/SavedItemRow";
import {
  savedItemQueryKey,
  savedItemQueryKeysForFolder,
  fallbackFaviconUrl,
  hostFromUrl,
  insertSavedItemIntoPages,
  removeSavedItemsFromPages
} from "../features/savedItems/savedItemUtils";
import {
  SearchScopeControl,
  type SavedItemSearchScope
} from "../features/savedItems/SearchScopeControl";
import { FolderSidebar } from "../features/folders/FolderSidebar";
import { folderPathSegments } from "../features/folders/folderTree";
import {
  DEFAULT_FOLDER_ICON_COLOR,
  getFolderIconComponent
} from "../features/folders/folderIcons";

const STACKED_SIDEBAR_BREAKPOINT = 768;
const SIDEBAR_CLOSE_DRAG_THRESHOLD = 64;
const SAVED_ITEMS_VIEW_MODE_STORAGE_KEY = "savedItems.viewMode";

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
      type: "search";
      workspaceSlug: string | null;
    }
  | {
      id: string;
      type: "tag";
      workspaceSlug: string | null;
    };

type WorkspaceLibrary = CurrentUserResponse["libraries"][number];

type SavedItemSearchState = {
  query: string;
  scope: SavedItemSearchScope;
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

  if (firstSegment === "search") {
    return { type: "search", workspaceSlug: null };
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

  if (secondSegment === "search") {
    return { type: "search", workspaceSlug: firstSegment };
  }

  return { type: "inbox", workspaceSlug: firstSegment };
};

const searchStateFromLocation = (): SavedItemSearchState => {
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

const savedItemsViewModeFromStorage = (): SavedItemsViewMode => {
  if (typeof window === "undefined") {
    return "list";
  }

  return window.localStorage.getItem(SAVED_ITEMS_VIEW_MODE_STORAGE_KEY) === "cards"
    ? "cards"
    : "list";
};

const writeLocationToHistory = (
  route: ActiveRoute,
  search: SavedItemSearchState,
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

const pathForRoute = (route: ActiveRoute, search: SavedItemSearchState = emptySearchState) => {
  const workspaceSlug = encodeURIComponent(route.workspaceSlug ?? "me");
  const searchSuffix = searchParamsForState(search);

  if (route.type === "folder") {
    return `/${workspaceSlug}/folder/${encodeURIComponent(route.id)}`;
  }

  if (route.type === "tag") {
    return `/${workspaceSlug}/tag/${encodeURIComponent(route.id)}`;
  }

  if (route.type === "search") {
    return `/${workspaceSlug}/search${searchSuffix}`;
  }

  return `/${workspaceSlug}/`;
};

const emptySearchState: SavedItemSearchState = {
  query: "",
  scope: "current"
};

const searchParamsForState = (search: SavedItemSearchState) => {
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
  const [searchState, setSearchState] = useState<SavedItemSearchState>(() =>
    searchStateFromLocation()
  );
  const [savedItemsViewMode, setSavedItemsViewMode] = useState<SavedItemsViewMode>(() =>
    savedItemsViewModeFromStorage()
  );
  const [savedItemDialogOpen, setSavedItemDialogOpen] = useState(false);
  const [savedItemTargetFolder, setSavedItemTargetFolder] = useState<FolderItem | null>(null);
  const [savedItemTargetTag, setSavedItemTargetTag] = useState<TagItem | null>(null);
  const [editingSavedItem, setEditingSavedItem] = useState<SavedItem | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => !isStackedSidebarViewport());
  const [isStackedSidebar, setIsStackedSidebar] = useState(isStackedSidebarViewport);
  const [activeSavedItemDragItem, setActiveSavedItemDragItem] = useState<SavedItem | null>(null);
  const [activeFolderDragId, setActiveFolderDragId] = useState<string | null>(null);
  const [activeTagDragId, setActiveTagDragId] = useState<string | null>(null);
  const [moveNotification, setMoveNotification] = useState<string | null>(null);
  const [sidebarDragOffset, setSidebarDragOffset] = useState(0);
  const [isConnectedAppsOpen, setIsConnectedAppsOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeData = args.active.data.current;

    if (isFolderDragData(activeData) || isTagDragData(activeData)) {
      const collisions = pointerWithin(args);
      const positionPrefix = isFolderDragData(activeData) ? "folder-position:" : "tag-position:";
      const positionCollisions = collisions.filter(({ id }) =>
        String(id).startsWith(positionPrefix)
      );

      if (positionCollisions.length > 0) {
        return positionCollisions;
      }

      if (collisions.length > 0) {
        return collisions;
      }
    }

    if (isSavedItemDragData(activeData)) {
      const collisions = pointerWithin(args);

      if (collisions.length > 0) {
        return collisions;
      }
    }

    return rectIntersection(args);
  }, []);
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
  const connectedApps = useQuery({
    enabled: currentUser.isSuccess && isConnectedAppsOpen,
    queryKey: ["connected-apps"],
    queryFn: getConnectedApps
  });
  const activeFolderId = activeRoute.type === "folder" ? activeRoute.id : null;
  const activeTagId = activeRoute.type === "tag" ? activeRoute.id : null;
  const isSearchRoute = activeRoute.type === "search";
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
    }
  });
  const revokeConnectedAppMutation = useMutation({
    mutationFn: revokeConnectedApp,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connected-apps"] });
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
  const savedItemTargetLibraryId =
    savedItemTargetFolder?.libraryId ??
    savedItemTargetTag?.libraryId ??
    activeTag?.libraryId ??
    activeLibraryId;
  const savedItemDialogFolder =
    savedItemTargetFolder ?? (savedItemTargetTag ? null : activeFolder);
  const savedItemDialogTagId =
    savedItemTargetTag?.id ?? (savedItemTargetFolder ? null : activeTagId);
  const activeFolderDragItem =
    folders.data?.find((folder) => folder.id === activeFolderDragId) ?? null;
  const activeTagDragItem = tags.data?.find((tag) => tag.id === activeTagDragId) ?? null;
  const activeFolderPath = activeFolder ? folderPathSegments(activeFolder, folders.data ?? []) : [];
  const moveSavedItemsMutation = useMutation({
    mutationFn: ({ destinationFolder, ...input }: MoveSavedItemsMutationInput) =>
      moveSavedItemsRequest({
        savedItemIds: input.savedItemIds,
        destinationFolderId: destinationFolder?.id ?? null
      }),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["savedItems"] }),
        queryClient.cancelQueries({ queryKey: ["folders"] })
      ]);

      const previousSavedItems =
        queryClient.getQueriesData<InfiniteData<SavedItemsPageResponse, string | null>>({
          queryKey: ["savedItems"]
        });
      const previousFolders = queryClient.getQueryData<FolderItem[]>(["folders"]);
      const savedItemIds = new Set(input.savedItemIds);
      const movedSavedItems = new Map<string, SavedItem>();
      const now = new Date().toISOString();

      for (const [, data] of previousSavedItems) {
        for (const page of data?.pages ?? []) {
          for (const item of page.items) {
            if (savedItemIds.has(item.id)) {
              movedSavedItems.set(item.id, item);
            }
          }
        }
      }

      for (const [queryKey] of previousSavedItems) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
          queryKey,
          (data) => removeSavedItemsFromPages(data, savedItemIds)
        );
      }

      const destinationFolderId = input.destinationFolder?.id ?? null;
      const destinationLibraryId = input.destinationFolder?.libraryId ?? null;
      const destinationQueryKey = savedItemQueryKeysForFolder(
        destinationFolderId,
        destinationLibraryId
      )[0];
      const movedItems = [...movedSavedItems.values()]
        .filter((item) => item.folderId !== destinationFolderId)
        .map((item) => ({
          ...item,
          folderId: destinationFolderId,
          folderName: input.destinationFolder?.name ?? null,
          libraryId: input.destinationFolder?.libraryId ?? item.libraryId,
          updatedAt: now
        }));

      if (queryClient.getQueryState(destinationQueryKey)) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
          destinationQueryKey,
          (data) =>
            movedItems.reduce(
              (currentData, item) => insertSavedItemIntoPages(currentData, item),
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

          const previousFolderId = movedSavedItems.get(item.id)?.folderId;

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
                savedItemCount: Math.max(0, folder.savedItemCount + delta),
                updatedAt: now
              };
        });
      });

      return {
        previousSavedItems,
        previousFolders
      };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.previousSavedItems ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      if (context?.previousFolders) {
        queryClient.setQueryData(["folders"], context.previousFolders);
      }

      setMoveNotification("Saved item could not be moved");
    },
    onSuccess: (result) => {
      const count = result.movedSavedItemIds.length;
      setMoveNotification(count === 1 ? "Moved 1 saved item" : `Moved ${count} saved items`);
    },
    onSettled: (_result, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: ["savedItems"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });

      const destinationFolderId = input.destinationFolder?.id ?? null;
      const destinationLibraryId = input.destinationFolder?.libraryId ?? null;
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: savedItemQueryKey({
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
      void queryClient.invalidateQueries({ queryKey: ["savedItems"] });
    }
  });
  const moveTagMutation = useMutation({
    mutationFn: moveTagRequest,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["tags"] });

      const previousTags = queryClient.getQueryData<TagItem[]>(["tags"]);

      queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) =>
        applyTagMove(currentTags, input)
      );

      return { previousTags };
    },
    onError: (_error, _input, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(["tags"], context.previousTags);
      }

      setMoveNotification("Tag could not be moved");
    },
    onSuccess: (nextTags) => {
      queryClient.setQueryData(["tags"], nextTags);
      setMoveNotification("Tag moved");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    }
  });
  const addSavedItemTagMutation = useMutation({
    mutationFn: ({ savedItem, tag }: AddSavedItemTagMutationInput) =>
      addTagToSavedItem({
        savedItemId: savedItem.id,
        tagId: tag.id
      }),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["savedItems"] }),
        queryClient.cancelQueries({ queryKey: ["tags"] })
      ]);

      const previousSavedItems =
        queryClient.getQueriesData<InfiniteData<SavedItemsPageResponse, string | null>>({
          queryKey: ["savedItems"]
        });
      const previousTags = queryClient.getQueryData<TagItem[]>(["tags"]);
      const tag = {
        id: input.tag.id,
        name: input.tag.name,
        color: input.tag.color
      };
      const now = new Date().toISOString();

      for (const [queryKey] of previousSavedItems) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
          queryKey,
          (data) => addTagToSavedItemsPages(data, input.savedItem.id, tag, now)
        );
      }

      queryClient.setQueryData<TagItem[]>(["tags"], (currentTags = []) =>
        currentTags.map((currentTag) =>
          currentTag.id === input.tag.id
            ? {
                ...currentTag,
                savedItemCount: currentTag.savedItemCount + 1,
                updatedAt: now
              }
            : currentTag
        )
      );

      return { previousSavedItems, previousTags };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.previousSavedItems ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      if (context?.previousTags) {
        queryClient.setQueryData(["tags"], context.previousTags);
      }

      setMoveNotification("Tag could not be added");
    },
    onSuccess: (savedItem, input) => {
      const tagName =
        savedItem.tags?.find((tag) => tag.id === input.tag.id)?.name ?? input.tag.name;

      for (const [queryKey] of queryClient.getQueriesData<
        InfiniteData<SavedItemsPageResponse, string | null>
      >({
        queryKey: ["savedItems"]
      })) {
        queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
          queryKey,
          (data) => replaceSavedItemInPages(data, savedItem)
        );
      }

      setMoveNotification(`Added ${tagName}`);
    },
    onSettled: (_savedItem, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: ["savedItems"] });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: savedItemQueryKey({
          folderId: null,
          libraryId: input.tag.libraryId,
          tagId: input.tag.id
        })
      });
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

  useEffect(() => {
    window.localStorage.setItem(SAVED_ITEMS_VIEW_MODE_STORAGE_KEY, savedItemsViewMode);
  }, [savedItemsViewMode]);

  const navigateToRoute = useCallback((route: ActiveRoute, mode: "push" | "replace" = "push") => {
    setActiveRoute(route);
    setSearchState(emptySearchState);
    writeLocationToHistory(route, emptySearchState, mode);
  }, []);

  const updateSearchState = useCallback(
    (nextSearchState: SavedItemSearchState, mode: "push" | "replace" = "replace") => {
      const query = nextSearchState.query.trim();
      const nextRoute: ActiveRoute = query
        ? { type: "search", workspaceSlug: activeWorkspaceSlug }
        : isSearchRoute
          ? { type: "inbox", workspaceSlug: activeWorkspaceSlug }
          : activeRoute;
      const nextState = query ? nextSearchState : emptySearchState;

      setActiveRoute(nextRoute);
      setSearchState(nextState);
      writeLocationToHistory(nextRoute, nextState, mode);
    },
    [activeRoute, activeWorkspaceSlug, isSearchRoute]
  );

  useEffect(() => {
    if (activeRoute.type === "search" && searchState.query.trim().length === 0) {
      navigateToRoute({ type: "inbox", workspaceSlug: activeWorkspaceSlug }, "replace");
    }
  }, [activeRoute, activeWorkspaceSlug, navigateToRoute, searchState.query]);

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

    const nextRoute = { ...activeRoute, workspaceSlug: activeWorkspaceSlug } satisfies ActiveRoute;
    const nextSearchState = activeRoute.type === "search" ? searchState : emptySearchState;

    setActiveRoute(nextRoute);
    setSearchState(nextSearchState);
    writeLocationToHistory(nextRoute, nextSearchState, "replace");
  }, [activeRoute, activeWorkspace, activeWorkspaceSlug, currentUser.data, searchState]);

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

  const openSavedItemDialog = ({
    folder,
    tag
  }: {
    folder: FolderItem | null;
    tag: TagItem | null;
  }) => {
    setEditingSavedItem(null);
    setSavedItemTargetFolder(folder);
    setSavedItemTargetTag(tag);
    setSavedItemDialogOpen(true);
  };

  const openEditSavedItemDialog = (item: SavedItem) => {
    setEditingSavedItem(item);
    setSavedItemTargetFolder(null);
    setSavedItemTargetTag(null);
    setSavedItemDialogOpen(true);
  };

  const updateSavedItemDialogOpen = (open: boolean) => {
    setSavedItemDialogOpen(open);

    if (!open) {
      setSavedItemTargetFolder(null);
      setSavedItemTargetTag(null);
      setEditingSavedItem(null);
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

  const moveSavedItemsToFolder = (savedItemIds: string[], destinationFolder: FolderItem | null) => {
    const uniqueSavedItemIds = [...new Set(savedItemIds)].filter(Boolean);

    if (uniqueSavedItemIds.length === 0) {
      return;
    }

    moveSavedItemsMutation.mutate({
      savedItemIds: uniqueSavedItemIds,
      destinationFolder
    });
  };

  const addTagToDraggedSavedItem = (savedItem: SavedItem, tag: TagItem) => {
    if (savedItem.libraryId !== tag.libraryId) {
      setMoveNotification("Tags can only be added inside the same workspace");
      return;
    }

    if ((savedItem.tags ?? []).some((itemTag) => itemTag.id === tag.id)) {
      setMoveNotification("Tag already added");
      return;
    }

    addSavedItemTagMutation.mutate({ savedItem, tag });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;

    setActiveSavedItemDragItem(isSavedItemDragData(activeData) ? activeData.item : null);
    setActiveFolderDragId(isFolderDragData(activeData) ? activeData.folderId : null);
    setActiveTagDragId(isTagDragData(activeData) ? activeData.tagId : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current;
    const overData = event.over?.data.current;

    setActiveFolderDragId(null);
    setActiveSavedItemDragItem(null);
    setActiveTagDragId(null);

    if (isSavedItemDragData(activeData) && isFolderDropData(overData)) {
      const destinationFolder = overData.folder;
      const destinationFolderId = destinationFolder?.id ?? null;

      if (activeData.sourceFolderId === destinationFolderId) {
        return;
      }

      moveSavedItemsToFolder(activeData.savedItemIds, destinationFolder);
      return;
    }

    if (isSavedItemDragData(activeData) && isTagDropData(overData)) {
      addTagToDraggedSavedItem(activeData.item, overData.tag);
      return;
    }

    if (isTagDragData(activeData) && overData && tags.data) {
      const moveInput = buildTagMoveInput(activeData, overData, tags.data);

      if (moveInput) {
        moveTagMutation.mutate(moveInput);
      }

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
    setActiveSavedItemDragItem(null);
    setActiveTagDragId(null);
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

  const activeSearchQuery = isSearchRoute ? searchState.query : "";

  return (
    <DndContext
      collisionDetection={collisionDetection}
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
          className="stable-scrollbar-gutter h-full w-[min(360px,calc(100vw-48px))] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 md:w-[340px] md:px-6 md:py-5"
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
            searchQuery={activeSearchQuery}
            tags={tags.data ?? []}
            activeFolderDragId={activeFolderDragId}
            activeTagDragId={activeTagDragId}
            activeSavedItemDragItem={activeSavedItemDragItem}
            isSigningOut={logoutMutation.isPending}
            onAddSavedItem={openSavedItemDialog}
            onHideSidebar={() => setIsSidebarVisible(false)}
            onOpenConnectedApps={() => setIsConnectedAppsOpen(true)}
            onSignOut={() => logoutMutation.mutate()}
            onSearchQueryChange={(query) =>
              updateSearchState({
                query,
                scope: searchState.scope
              })
            }
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
              ? "grid-cols-[minmax(0,1fr)_auto]"
              : "grid-cols-[2.5rem_minmax(0,1fr)_auto]"
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
            {isSearchRoute ? (
              <SearchBreadcrumb workspaceSlug={activeWorkspaceSlug} onNavigate={navigateToRoute} />
            ) : activeTag ? (
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
          <SavedItemsViewModeToggle
            viewMode={savedItemsViewMode}
            onViewModeChange={setSavedItemsViewMode}
          />
        </header>

        {isSearchRoute && searchState.query.trim().length > 0 ? (
          <SearchScopeControl
            scope={searchState.scope}
            workspaceName={activeWorkspace?.name ?? "Current workspace"}
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
        ) : null}

        <SavedItemsWorkspace
          folderId={activeFolderId}
          folderName={activeFolder?.name ?? null}
          libraryId={activeLibraryId}
          searchQuery={activeSearchQuery}
          searchScope={searchState.scope}
          tagId={activeTagId}
          tagName={activeTag?.name ?? null}
          viewMode={savedItemsViewMode}
          onEditSavedItem={openEditSavedItemDialog}
        />
      </section>
      <AddSavedItemDialog
        editingItem={editingSavedItem}
        folders={folders.data ?? []}
        isOpen={savedItemDialogOpen}
        targetFolder={savedItemDialogFolder}
        targetLibraryId={savedItemTargetLibraryId}
        targetTagId={savedItemDialogTagId}
        tags={tags.data ?? []}
        visibleFolderId={activeFolderId}
        visibleLibraryId={activeLibraryId}
        visibleTagId={activeTagId}
        onOpenChange={updateSavedItemDialogOpen}
      />
      {moveNotification ? (
        <div
          className="fixed right-4 bottom-4 z-40 rounded-lg border border-[#dfe4ef] bg-white px-3 py-2 text-sm font-medium text-[#242833] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
          role="status"
          aria-live="polite"
        >
          {moveNotification}
        </div>
      ) : null}
      {isConnectedAppsOpen ? (
        <ConnectedAppsModal
          apps={connectedApps.data ?? []}
          isLoading={connectedApps.isLoading}
          isRevoking={revokeConnectedAppMutation.isPending}
          onClose={() => setIsConnectedAppsOpen(false)}
          onRevoke={(grantId) => revokeConnectedAppMutation.mutate(grantId)}
        />
      ) : null}
      </main>
      <DragOverlay zIndex={1000}>
        {activeSavedItemDragItem ? <SavedItemDragPreview item={activeSavedItemDragItem} /> : null}
        {!activeSavedItemDragItem && activeFolderDragItem ? (
          <FolderDragPreview folder={activeFolderDragItem} />
        ) : null}
        {!activeSavedItemDragItem && !activeFolderDragItem && activeTagDragItem ? (
          <TagDragPreview tag={activeTagDragItem} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

const ConnectedAppsModal = ({
  apps,
  isLoading,
  isRevoking,
  onClose,
  onRevoke
}: {
  apps: ConnectedApp[];
  isLoading: boolean;
  isRevoking: boolean;
  onClose: () => void;
  onRevoke: (grantId: string) => void;
}) => (
  <div
    className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 px-4"
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <section
      className="max-h-[min(680px,calc(100dvh-48px))] w-full max-w-[560px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-[0_24px_70px_rgb(15_23_42_/_0.22)]"
      aria-label="Connected apps"
      role="dialog"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-slate-950">
            <IconPlugConnected size={19} stroke={1.6} aria-hidden="true" focusable="false" />
            <h2 className="m-0 text-[17px] leading-6 font-medium">Connected apps</h2>
          </div>
          <p className="m-0 text-sm leading-5 text-gray-500">
            Revoke clients without signing out of this browser.
          </p>
        </div>
        <button
          className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 outline-none hover:bg-gray-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {isLoading ? (
        <p className="m-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Loading connected apps
        </p>
      ) : apps.length === 0 ? (
        <p className="m-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          No connected apps.
        </p>
      ) : (
        <div className="grid gap-2">
          {apps.map((app) => (
            <article
              className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={app.id}
            >
              <div className="min-w-0">
                <h3 className="m-0 truncate text-sm font-medium text-slate-950">
                  {connectedAppTitle(app)}
                </h3>
                <p className="m-0 mt-1 text-xs leading-5 text-gray-500">
                  {app.scopes.join(", ")} · Connected {formatDate(app.createdAt)}
                  {app.lastUsedAt ? ` · Last used ${formatDate(app.lastUsedAt)}` : ""}
                </p>
              </div>
              <button
                className="h-8 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 outline-none hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                disabled={isRevoking}
                type="button"
                onClick={() => onRevoke(app.id)}
              >
                Revoke
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  </div>
);

const connectedAppTitle = (app: ConnectedApp) => {
  const details = [app.browser, app.platform, app.deviceName].filter(Boolean);

  return details.length > 0 ? `${app.clientName} on ${details.join(" / ")}` : app.clientName;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));

type MoveSavedItemsMutationInput = {
  savedItemIds: string[];
  destinationFolder: FolderItem | null;
};

type AddSavedItemTagMutationInput = {
  savedItem: SavedItem;
  tag: TagItem;
};

type SavedItemDragData = {
  savedItemIds: string[];
  item: SavedItem;
  sourceFolderId: string | null;
  type: "savedItem";
};

type FolderDragData = {
  folderId: string;
  libraryId: string;
  parentId: string | null;
  type: "folder-drag";
};

type TagDragData = {
  libraryId: string;
  tagId: string;
  type: "tag-drag";
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

type TagPositionDropData = {
  libraryId: string;
  position: "before" | "after";
  relativeTagId: string;
  type: "tag-position";
};

type TagDropData = {
  tag: TagItem;
  type: "tag";
};

const isSavedItemDragData = (value: unknown): value is SavedItemDragData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as SavedItemDragData;

  return (
    data.type === "savedItem" &&
    Array.isArray(data.savedItemIds) &&
    data.savedItemIds.every((savedItemId) => typeof savedItemId === "string" && savedItemId) &&
    isSavedItem(data.item) &&
    (typeof data.sourceFolderId === "string" || data.sourceFolderId === null)
  );
};

const isSavedItem = (value: unknown): value is SavedItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as SavedItem;

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

const isTagDragData = (value: unknown): value is TagDragData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as TagDragData;

  return (
    data.type === "tag-drag" &&
    typeof data.tagId === "string" &&
    Boolean(data.tagId) &&
    typeof data.libraryId === "string" &&
    Boolean(data.libraryId)
  );
};

const isTagDropData = (value: unknown): value is TagDropData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as TagDropData;

  return data.type === "tag" && isTag(data.tag);
};

const isTag = (value: unknown): value is TagItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const tag = value as TagItem;

  return (
    typeof tag.id === "string" &&
    Boolean(tag.id) &&
    typeof tag.libraryId === "string" &&
    Boolean(tag.libraryId) &&
    typeof tag.name === "string"
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

const isTagPositionDropData = (value: unknown): value is TagPositionDropData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as TagPositionDropData;

  return (
    data.type === "tag-position" &&
    typeof data.libraryId === "string" &&
    typeof data.relativeTagId === "string" &&
    (data.position === "before" || data.position === "after")
  );
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

const addTagToSavedItemsPages = (
  data: InfiniteData<SavedItemsPageResponse, string | null> | undefined,
  savedItemId: string,
  tag: NonNullable<SavedItem["tags"]>[number],
  updatedAt: string
) => {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => {
        if (
          item.id !== savedItemId ||
          (item.tags ?? []).some((itemTag) => itemTag.id === tag.id)
        ) {
          return item;
        }

        return {
          ...item,
          tags: [...(item.tags ?? []), tag],
          updatedAt
        };
      })
    }))
  };
};

const replaceSavedItemInPages = (
  data: InfiniteData<SavedItemsPageResponse, string | null> | undefined,
  savedItem: SavedItem
) => {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === savedItem.id ? savedItem : item))
    }))
  };
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

const buildTagMoveInput = (
  activeData: TagDragData,
  overData: unknown,
  tags: TagItem[]
): MoveTagInput | null => {
  const draggedTag = tags.find((tag) => tag.id === activeData.tagId);

  if (!draggedTag || !isTagPositionDropData(overData)) {
    return null;
  }

  if (
    overData.libraryId !== draggedTag.libraryId ||
    overData.relativeTagId === draggedTag.id
  ) {
    return null;
  }

  return {
    orderedTagIds: insertTagNearSibling(tags, draggedTag, overData),
    tagId: draggedTag.id
  };
};

const insertTagNearSibling = (
  tags: TagItem[],
  draggedTag: TagItem,
  drop: TagPositionDropData
) => {
  const tagIds = tags
    .filter((tag) => tag.libraryId === draggedTag.libraryId && tag.id !== draggedTag.id)
    .sort(compareTags)
    .map((tag) => tag.id);
  const relativeIndex = tagIds.indexOf(drop.relativeTagId);

  if (relativeIndex < 0) {
    return [...tagIds, draggedTag.id];
  }

  tagIds.splice(drop.position === "before" ? relativeIndex : relativeIndex + 1, 0, draggedTag.id);

  return tagIds;
};

const applyTagMove = (tags: TagItem[], input: MoveTagInput): TagItem[] => {
  const sortOrderById = new Map(input.orderedTagIds.map((tagId, index) => [tagId, index]));
  const now = new Date().toISOString();

  return tags.map((tag) => {
    const sortOrder = sortOrderById.get(tag.id);

    return typeof sortOrder === "number"
      ? {
          ...tag,
          sortOrder,
          updatedAt: now
        }
      : tag;
  });
};

const compareFolders = (left: FolderItem, right: FolderItem) =>
  left.sortOrder - right.sortOrder ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);

const compareTags = (left: TagItem, right: TagItem) =>
  left.sortOrder - right.sortOrder ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);

const SavedItemsViewModeToggle = ({
  onViewModeChange,
  viewMode
}: {
  onViewModeChange: (viewMode: SavedItemsViewMode) => void;
  viewMode: SavedItemsViewMode;
}) => (
  <div
    className="grid grid-cols-2 rounded-lg border border-[#cbccc9] bg-[#f2f3f0] p-1 text-[#666666]"
    role="group"
    aria-label="Saved items view"
  >
    <button
      className={savedItemsViewModeButtonClass(viewMode === "cards")}
      aria-label="Card view"
      aria-pressed={viewMode === "cards"}
      title="Card view"
      type="button"
      onClick={() => onViewModeChange("cards")}
    >
      <IconCards size={17} stroke={1.5} aria-hidden="true" focusable="false" />
    </button>
    <button
      className={savedItemsViewModeButtonClass(viewMode === "list")}
      aria-label="List view"
      aria-pressed={viewMode === "list"}
      title="List view"
      type="button"
      onClick={() => onViewModeChange("list")}
    >
      <IconLayoutList size={17} stroke={1.5} aria-hidden="true" focusable="false" />
    </button>
  </div>
);

const savedItemsViewModeButtonClass = (active: boolean) =>
  [
    "grid h-8 w-8 place-items-center rounded-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8400]",
    active
      ? "bg-white text-[#111111] shadow-[0_6px_18px_rgb(0_0_0_/_0.08)]"
      : "text-[#666666] hover:bg-white/70 hover:text-[#111111]"
  ].join(" ");

const SavedItemDragPreview = ({ item }: { item: SavedItem }) => {
  const host = hostFromUrl(item.url);
  const title = item.title || host || item.url;
  const faviconSrc = item.faviconUrl ? apiAssetUrl(item.faviconUrl) : fallbackFaviconUrl(item.url);

  return (
    <article className="w-[min(760px,calc(100vw-24px))] overflow-hidden rounded-lg border border-[#3b8df5] bg-white p-4 opacity-95 shadow-[0_24px_80px_rgb(22_28_43_/_0.24)]">
      <div className="grid min-w-0 grid-cols-[1.25rem_144px_minmax(0,1fr)] items-start gap-3">
        <div className="flex h-8 w-8 -translate-x-1 -translate-y-1 items-center justify-center rounded-lg text-[#9aa1ad]">
          <IconGripVertical size={17} stroke={1.5} aria-hidden="true" focusable="false" />
        </div>
        <div className="h-24 w-36 overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#f3f5f9]">
          {item.imageUrl ? (
            <img
              className="h-full w-full object-contain"
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
            {faviconSrc ? (
              <img
                className="h-5 w-5 object-contain"
                src={faviconSrc}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <IconLink size={19} stroke={1.5} aria-hidden="true" focusable="false" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="m-0 truncate text-lg leading-[1.25] font-medium">{title}</h2>
            <p className="mt-1 mb-0 truncate text-sm font-medium text-[#2f80ed]">{item.url}</p>
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
      <span className="grid h-9 place-items-center text-xs font-medium text-gray-400">
        {folder.savedItemCount > 0 ? folder.savedItemCount : null}
      </span>
      <span aria-hidden="true" />
    </div>
  );
};

const TagDragPreview = ({ tag }: { tag: TagItem }) => (
  <div className="grid w-[min(260px,calc(100vw-32px))] grid-cols-[minmax(0,1fr)_1.75rem_2rem] items-center gap-1 rounded-xl border border-blue-500 bg-white py-0.5 text-slate-950 opacity-95 shadow-[0_24px_80px_rgb(15_23_42_/_0.24)]">
    <div className="flex min-h-9 min-w-0 items-center gap-1">
      <span className="grid h-7 w-6 shrink-0 place-items-center text-gray-400" aria-hidden="true">
        <IconGripVertical size={15} stroke={1.5} aria-hidden="true" focusable="false" />
      </span>
      <span className="flex min-h-9 min-w-0 flex-1 items-center gap-2 pr-2.5 text-sm font-medium">
        <IconTag
          size={18}
          stroke={1.5}
          color={tag.color ?? "#697080"}
          aria-hidden="true"
          focusable="false"
        />
        <span className="truncate">{tag.name}</span>
      </span>
    </div>
    <span className="grid h-9 place-items-center text-xs font-medium text-gray-400">
      {tag.savedItemCount > 0 ? tag.savedItemCount : null}
    </span>
    <span aria-hidden="true" />
  </div>
);

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
      className="m-0 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5 font-medium"
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
          <IconLink
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
    className="m-0 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5 font-medium"
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

const SearchBreadcrumb = ({
  workspaceSlug,
  onNavigate
}: {
  workspaceSlug: string;
  onNavigate: (route: ActiveRoute) => void;
}) => (
  <h1
    className="m-0 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5 font-medium"
    aria-label="Search"
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
    <BreadcrumbLink route={{ type: "search", workspaceSlug }} isCurrent onNavigate={onNavigate}>
      <IconSearch
        className="shrink-0 text-[#3b8df5]"
        size={16}
        stroke={1.5}
        aria-hidden="true"
        focusable="false"
      />
      <span className="min-w-0 truncate">Search</span>
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
