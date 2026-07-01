import { ORPCError, os } from "@orpc/server";
import type {
  AddSavedItemTagInput,
  CreateFolderInput,
  CreateImportRuleInput,
  CreateSavedItemInput,
  CreateTagInput,
  DeleteFolderInput,
  DeleteImportRuleInput,
  DeleteSavedItemInput,
  DeleteTagInput,
  IntegrationProvider,
  MoveFolderInput,
  MoveSavedItemsInput,
  MoveTagInput,
  ReorderImportRulesInput,
  SavedItemPreviewInput,
  SearchSavedItemsInput,
  SetIntegrationEnabledInput,
  StartGithubConnectionInput,
  UpdateFolderInput,
  UpdateImportRuleInput,
  UpdateProviderSettingsInput,
  UpdateSavedItemInput,
  UpdateTagInput,
} from "@shelf/shared";
import { hasOAuthScope, type OAuthScope } from "./auth";
import { type CurrentIdentity, getCurrentUserResponse } from "./currentUser";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";
import type { GitHubClient, IntegrationsStore } from "./integrations";
import { GitHubConfigurationError } from "./integrations";
import {
  decodeSavedItemCursor,
  fetchLinkPreviewMetadata,
  listSavedItemsPage,
  parseSavedItemsLimit,
  type SavedItemCursor,
  type SavedItemEnrichmentQueue,
  type SavedItemSearchIndex,
  type SavedItemsStore,
  searchSavedItemsPage,
} from "./savedItems";

export interface RpcRouterOptions {
  dependencies: HealthDependencies;
  currentUser?: CurrentIdentity;
  oauthScopes?: ReadonlySet<OAuthScope>;
  savedItemsStore?: SavedItemsStore;
  savedItemEnrichmentQueue?: SavedItemEnrichmentQueue;
  savedItemSearchIndex?: SavedItemSearchIndex;
  integrationsStore?: IntegrationsStore;
  githubClient?: GitHubClient;
}

export const createRpcRouter = (options: RpcRouterOptions) => ({
  health: os.handler(() => checkHealth(options.dependencies)),
  currentUser: os.handler(() => {
    if (!options.currentUser) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "No current user is configured",
      });
    }

    assertOAuthScope(options.oauthScopes, "read:saved_items");

    return getCurrentUserResponse(options.currentUser);
  }),
  savedItems: {
    addTag: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const savedItemTag = parseAddSavedItemTagInput(input);

      if (!savedItemTag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose a saved item and tag",
        });
      }

      const savedItem = await options.savedItemsStore.addSavedItemTag({
        ...savedItemTag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });

      await upsertSavedItemSearchDocuments(options.savedItemsStore, options.savedItemSearchIndex, {
        libraryIds: currentUserLibraryIds(options.currentUser),
        savedItemIds: [savedItem.id],
      });

      return savedItem;
    }),
    preview: os.handler(async ({ input }) => {
      if (!options.currentUser) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "No current user is configured",
        });
      }

      assertOAuthScope(options.oauthScopes, "write:saved_items");

      const previewInput = parseSavedItemPreviewInput(input);

      if (!previewInput) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a valid URL",
        });
      }

      try {
        const metadata = await fetchLinkPreviewMetadata(previewInput.url);

        return {
          description: metadata.description,
          faviconUrl: resolvePreviewAssetUrl(metadata.faviconCandidates[0], previewInput.url),
          imageUrl: resolvePreviewAssetUrl(metadata.imageUrl, previewInput.url),
          siteName: metadata.siteName,
          title: metadata.title,
        };
      } catch {
        throw new ORPCError("BAD_REQUEST", {
          message: "Unable to fetch page preview",
        });
      }
    }),
    create: os.handler(async ({ input }) => {
      if (!options.currentUser) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "No current user is configured",
        });
      }

      assertOAuthScope(options.oauthScopes, "write:saved_items");

      if (!options.savedItemsStore) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Saved item storage is not configured",
        });
      }

      const savedItem = parseCreateSavedItemInput(input);

      if (!savedItem) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a valid URL",
        });
      }

      const allowedLibraryIds = currentUserLibraryIds(options.currentUser);
      const folders = savedItem.folderId
        ? await options.savedItemsStore.listFolders({ libraryIds: allowedLibraryIds })
        : [];
      const targetFolder = savedItem.folderId
        ? folders.find((folder) => folder.id === savedItem.folderId)
        : null;
      const personalLibrary = options.currentUser.libraries.find(
        (library) => library.kind === "personal",
      );

      if (savedItem.folderId && !targetFolder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an available folder",
        });
      }

      if (!targetFolder && !personalLibrary) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Personal library is not configured",
        });
      }

      const targetFolderId = targetFolder?.id ?? null;
      const requestedLibraryId =
        !targetFolder && savedItem.libraryId && allowedLibraryIds.includes(savedItem.libraryId)
          ? savedItem.libraryId
          : null;
      const targetLibraryId = targetFolder?.libraryId ?? requestedLibraryId ?? personalLibrary?.id;
      const selectedTagIds = savedItem.tagIds;

      if (!targetLibraryId) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Target library is not configured",
        });
      }

      if (selectedTagIds && selectedTagIds.length > 0) {
        const tags = await options.savedItemsStore.listTags({ libraryIds: [targetLibraryId] });
        const availableTagIds = new Set(tags.map((tag) => tag.id));

        if (selectedTagIds.some((tagId) => !availableTagIds.has(tagId))) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Choose available tags",
          });
        }
      }

      const createdSavedItem = await options.savedItemsStore.createSavedItem({
        createdByUserId: options.currentUser.user.id,
        description: savedItem.description ?? null,
        folderId: targetFolderId,
        imageUrl: savedItem.imageUrl ?? null,
        libraryId: targetLibraryId,
        siteName: savedItem.siteName ?? null,
        tagIds: selectedTagIds,
        title: savedItem.title ?? null,
        url: savedItem.url,
      });

      await upsertSavedItemSearchDocuments(options.savedItemsStore, options.savedItemSearchIndex, {
        libraryIds: allowedLibraryIds,
        savedItemIds: [createdSavedItem.id],
      });

      if (createdSavedItem.metadataStatus !== "fetched") {
        await options.savedItemEnrichmentQueue
          ?.enqueueSavedItem(createdSavedItem.id)
          .catch((error: unknown) => {
            console.error("Unable to enqueue saved item enrichment", error);
          });
      }

      return createdSavedItem;
    }),
    delete: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const savedItem = parseDeleteSavedItemInput(input);

      if (!savedItem) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose a saved item to delete",
        });
      }

      const result = await options.savedItemsStore.deleteSavedItem({
        ...savedItem,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });

      await options.savedItemSearchIndex
        ?.delete([result.deletedSavedItemId])
        .catch((error: unknown) => {
          console.error("Unable to delete saved item from search index", error);
        });

      return result;
    }),
    update: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const savedItem = parseUpdateSavedItemInput(input);

      if (!savedItem) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a valid URL",
        });
      }

      const updatedSavedItem = await options.savedItemsStore.updateSavedItem({
        ...savedItem,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
        description: savedItem.description ?? null,
      });

      await upsertSavedItemSearchDocuments(options.savedItemsStore, options.savedItemSearchIndex, {
        libraryIds: currentUserLibraryIds(options.currentUser),
        savedItemIds: [updatedSavedItem.id],
      });

      if (updatedSavedItem.metadataStatus !== "fetched") {
        await options.savedItemEnrichmentQueue
          ?.enqueueSavedItem(updatedSavedItem.id)
          .catch((error: unknown) => {
            console.error("Unable to enqueue saved item enrichment", error);
          });
      }

      return updatedSavedItem;
    }),
    list: os.handler(async ({ input }) => {
      if (!options.currentUser) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "No current user is configured",
        });
      }

      assertOAuthScope(options.oauthScopes, "read:saved_items");

      if (!options.savedItemsStore) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Saved item storage is not configured",
        });
      }

      const pagination = parseSavedItemsInput(input);

      if (!pagination) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid saved item cursor",
        });
      }

      const allowedLibraryIds = currentUserLibraryIds(options.currentUser);

      if (pagination.libraryId && !allowedLibraryIds.includes(pagination.libraryId)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an available workspace",
        });
      }

      return listSavedItemsPage(options.savedItemsStore, {
        ...pagination,
        libraryIds: allowedLibraryIds,
      });
    }),
    locations: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const lookup = parseSavedItemLocationsInput(input);

      if (!lookup) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a valid URL",
        });
      }

      return options.savedItemsStore.listSavedItemLocations({
        libraryIds: currentUserLibraryIds(options.currentUser),
        url: lookup.url,
      });
    }),
    move: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const move = parseMoveSavedItemsInput(input);

      if (!move) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose saved items to move",
        });
      }

      const result = await options.savedItemsStore.moveSavedItems({
        ...move,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });

      await upsertSavedItemSearchDocuments(options.savedItemsStore, options.savedItemSearchIndex, {
        libraryIds: currentUserLibraryIds(options.currentUser),
        savedItemIds: result.movedSavedItemIds,
      });

      return result;
    }),
    search: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertSavedItemSearchIndex(options.savedItemSearchIndex);

      const search = parseSearchSavedItemsInput(input);

      if (!search) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a search query",
        });
      }

      const allowedLibraryIds = currentUserLibraryIds(options.currentUser);
      const libraryIds =
        search.scope === "all"
          ? allowedLibraryIds
          : search.libraryId && allowedLibraryIds.includes(search.libraryId)
            ? [search.libraryId]
            : null;

      if (!libraryIds) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an available workspace",
        });
      }

      const result = await searchSavedItemsPage(options.savedItemSearchIndex, {
        cursor: search.cursor,
        libraryIds,
        limit: search.limit,
        query: search.query,
      });

      if (!result) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid search cursor",
        });
      }

      return result;
    }),
  },
  integrations: {
    list: os.handler(async () => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const allowedLibraryIds = currentUserLibraryIds(options.currentUser);

      return {
        accounts: await options.integrationsStore.listAccounts({ allowedLibraryIds }),
        latestSyncRuns: await options.integrationsStore.listLatestSyncRuns({ allowedLibraryIds }),
      };
    }),
    connectGithub: {
      start: os.handler(({ input }) => {
        assertCurrentUser(options.currentUser);
        assertOAuthScope(options.oauthScopes, "write:saved_items");
        assertGitHubClient(options.githubClient);

        const start = parseStartGithubConnectionInput(input);

        if (!start || !currentUserLibraryIds(options.currentUser).includes(start.libraryId)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Choose an available workspace",
          });
        }

        try {
          return {
            authorizationUrl: options.githubClient.createAuthorizationUrl({
              libraryId: start.libraryId,
              redirectUri: start.redirectUri,
              userId: options.currentUser.user.id,
            }),
          };
        } catch (error) {
          if (error instanceof GitHubConfigurationError) {
            throw new ORPCError("BAD_REQUEST", {
              message: "GitHub OAuth is not configured",
            });
          }

          throw error;
        }
      }),
      callback: os.handler(async ({ input }) => {
        assertCurrentUser(options.currentUser);
        assertOAuthScope(options.oauthScopes, "write:saved_items");
        assertGitHubClient(options.githubClient);
        assertIntegrationsStore(options.integrationsStore);

        const callback = parseGithubConnectionCallbackInput(input);

        if (!callback) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Complete the GitHub connection",
          });
        }

        let exchanged: Awaited<ReturnType<GitHubClient["exchangeCode"]>>;

        try {
          exchanged = await options.githubClient.exchangeCode(callback);
        } catch (error) {
          if (error instanceof GitHubConfigurationError) {
            throw new ORPCError("BAD_REQUEST", {
              message: "GitHub OAuth is not configured",
            });
          }

          throw error;
        }

        if (
          exchanged.userId !== options.currentUser.user.id ||
          !currentUserLibraryIds(options.currentUser).includes(exchanged.libraryId)
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "GitHub connection state is invalid",
          });
        }

        return options.integrationsStore.createOrUpdateAccount({
          accessToken: exchanged.accessToken,
          connectedByUserId: options.currentUser.user.id,
          externalAccountId: String(exchanged.externalAccount.id),
          externalAccountName: exchanged.externalAccount.login,
          libraryId: exchanged.libraryId,
          provider: "github",
          providerSurface: "github_stars",
        });
      }),
    },
    disconnect: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const account = parseIntegrationAccountInput(input);

      if (!account) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration account",
        });
      }

      try {
        return await options.integrationsStore.disconnectAccount({
          ...account,
          allowedLibraryIds: currentUserLibraryIds(options.currentUser),
        });
      } catch (error) {
        throw integrationMutationError(error);
      }
    }),
    setEnabled: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const account = parseSetIntegrationEnabledInput(input);

      if (!account) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration account",
        });
      }

      try {
        return await options.integrationsStore.setAccountEnabled({
          ...account,
          allowedLibraryIds: currentUserLibraryIds(options.currentUser),
        });
      } catch (error) {
        throw integrationMutationError(error);
      }
    }),
    syncNow: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);
      assertIntegrationsStore(options.integrationsStore);

      const account = parseIntegrationAccountInput(input);

      if (!account) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration account",
        });
      }

      const result = await options.integrationsStore.syncGitHubStars({
        ...account,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });

      await upsertSavedItemSearchDocuments(options.savedItemsStore, options.savedItemSearchIndex, {
        libraryIds: currentUserLibraryIds(options.currentUser),
        savedItemIds: result.savedItemIds,
      });

      return result.run;
    }),
    listSyncRuns: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const account = parseIntegrationAccountInput(input);

      if (!account) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration account",
        });
      }

      return options.integrationsStore.listSyncRuns({
        ...account,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    getProviderSettings: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const provider = parseProviderInput(input);

      if (!provider) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration provider",
        });
      }

      return options.integrationsStore.getProviderSettings({
        ...provider,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    updateProviderSettings: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const provider = parseUpdateProviderSettingsInput(input);

      if (!provider) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration provider",
        });
      }

      return options.integrationsStore.updateProviderSettings({
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
        defaultFolderId: provider.defaultFolderId ?? null,
        libraryId: provider.libraryId,
        provider: provider.provider,
      });
    }),
    listImportRules: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const provider = parseProviderInput(input);

      if (!provider) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an integration provider",
        });
      }

      return options.integrationsStore.listImportRules({
        ...provider,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    createImportRule: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const rule = parseCreateImportRuleInput(input);

      if (!rule) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Complete the import rule",
        });
      }

      return options.integrationsStore.createImportRule({
        ...rule,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
        enabled: rule.enabled ?? true,
      });
    }),
    updateImportRule: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const rule = parseUpdateImportRuleInput(input);

      if (!rule) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Complete the import rule",
        });
      }

      return options.integrationsStore.updateImportRule({
        ...rule,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    reorderImportRules: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const order = parseReorderImportRulesInput(input);

      if (!order) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose import rules to reorder",
        });
      }

      return options.integrationsStore.reorderImportRules({
        ...order,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    deleteImportRule: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertIntegrationsStore(options.integrationsStore);

      const rule = parseDeleteImportRuleInput(input);

      if (!rule) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an import rule",
        });
      }

      return options.integrationsStore.deleteImportRule({
        ...rule,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
  },
  tags: {
    create: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const tag = parseCreateTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a tag name",
        });
      }

      return options.savedItemsStore.createTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    delete: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const tag = parseDeleteTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose a tag to delete",
        });
      }

      return options.savedItemsStore.deleteTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    list: os.handler(() => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      return options.savedItemsStore.listTags({
        libraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    move: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const tag = parseMoveTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose where to move this tag",
        });
      }

      return options.savedItemsStore.moveTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    update: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const tag = parseUpdateTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a tag name",
        });
      }

      return options.savedItemsStore.updateTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
  },
  folders: {
    create: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const folder = parseCreateFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a folder title",
        });
      }

      return options.savedItemsStore.createFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    delete: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const folder = parseDeleteFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose how to delete this folder",
        });
      }

      return options.savedItemsStore.deleteFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    list: os.handler(() => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "read:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      return options.savedItemsStore.listFolders({
        libraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    move: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const folder = parseMoveFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose where to move this folder",
        });
      }

      return options.savedItemsStore.moveFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
    update: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertOAuthScope(options.oauthScopes, "write:saved_items");
      assertSavedItemsStore(options.savedItemsStore);

      const folder = parseUpdateFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a folder title",
        });
      }

      return options.savedItemsStore.updateFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser),
      });
    }),
  },
});

export type RpcRouter = ReturnType<typeof createRpcRouter>;

const parseSavedItemsInput = (
  input: unknown,
): {
  limit: number;
  cursor?: SavedItemCursor;
  folderId?: string;
  inbox?: boolean;
  libraryId?: string;
  tagId?: string;
} | null => {
  if (!isRecord(input)) {
    return {
      limit: parseSavedItemsLimit(null),
    };
  }

  const cursorValue = typeof input.cursor === "string" ? input.cursor : null;
  const cursor = cursorValue ? decodeSavedItemCursor(cursorValue) : undefined;

  if (cursorValue && !cursor) {
    return null;
  }

  return {
    cursor: cursor ?? undefined,
    folderId: typeof input.folderId === "string" && input.folderId ? input.folderId : undefined,
    inbox: input.inbox === true,
    libraryId: typeof input.libraryId === "string" && input.libraryId ? input.libraryId : undefined,
    limit: parseSavedItemsLimit(typeof input.limit === "number" ? String(input.limit) : null),
    tagId: typeof input.tagId === "string" && input.tagId ? input.tagId : undefined,
  };
};

const parseSearchSavedItemsInput = (
  input: unknown,
): {
  cursor?: string;
  libraryId?: string;
  limit: number;
  query: string;
  scope: SearchSavedItemsInput["scope"];
} | null => {
  if (!isRecord(input) || typeof input.query !== "string") {
    return null;
  }

  const query = input.query.trim();

  if (!query) {
    return null;
  }

  if (input.scope !== "current" && input.scope !== "all") {
    return null;
  }

  return {
    cursor: typeof input.cursor === "string" && input.cursor ? input.cursor : undefined,
    libraryId: typeof input.libraryId === "string" && input.libraryId ? input.libraryId : undefined,
    limit: parseSavedItemsLimit(typeof input.limit === "number" ? String(input.limit) : null),
    query,
    scope: input.scope,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCreateSavedItemInput = (input: unknown): CreateSavedItemInput | null => {
  if (!isRecord(input) || typeof input.url !== "string") {
    return null;
  }

  const url = parseHttpUrl(input.url);

  if (!url) {
    return null;
  }

  return {
    description: normalizeOptionalText(input.description),
    folderId: typeof input.folderId === "string" && input.folderId ? input.folderId : undefined,
    imageUrl: resolvePreviewAssetUrl(
      typeof input.imageUrl === "string" ? input.imageUrl : null,
      url,
    ),
    libraryId: typeof input.libraryId === "string" && input.libraryId ? input.libraryId : undefined,
    siteName: normalizeOptionalText(input.siteName),
    tagIds: parseSelectedTagIds(input.tagIds),
    title: normalizeOptionalText(input.title),
    url,
  };
};

const parseSavedItemPreviewInput = (input: unknown): SavedItemPreviewInput | null => {
  if (!isRecord(input) || typeof input.url !== "string") {
    return null;
  }

  const url = parseHttpUrl(input.url);

  return url ? { url } : null;
};

const resolvePreviewAssetUrl = (
  value: string | null | undefined,
  pageUrl: string,
): string | null => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, pageUrl);

    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const parseSavedItemLocationsInput = (input: unknown): { url: string } | null => {
  if (!isRecord(input) || typeof input.url !== "string") {
    return null;
  }

  const url = parseHttpUrl(input.url);

  return url ? { url } : null;
};

const parseHttpUrl = (value: string) => {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const parseDeleteSavedItemInput = (input: unknown): DeleteSavedItemInput | null => {
  if (!isRecord(input) || typeof input.savedItemId !== "string" || !input.savedItemId) {
    return null;
  }

  return {
    savedItemId: input.savedItemId,
  };
};

const parseUpdateSavedItemInput = (input: unknown): UpdateSavedItemInput | null => {
  if (
    !isRecord(input) ||
    typeof input.savedItemId !== "string" ||
    !input.savedItemId ||
    typeof input.url !== "string"
  ) {
    return null;
  }

  const url = parseHttpUrl(input.url);

  if (!url) {
    return null;
  }

  return {
    description: normalizeOptionalText(input.description),
    folderId:
      typeof input.folderId === "string" && input.folderId
        ? input.folderId
        : input.folderId === null
          ? null
          : undefined,
    savedItemId: input.savedItemId,
    tagIds: parseSelectedTagIds(input.tagIds),
    url,
  };
};

const parseMoveSavedItemsInput = (input: unknown): MoveSavedItemsInput | null => {
  if (!isRecord(input) || !Array.isArray(input.savedItemIds)) {
    return null;
  }

  const savedItemIds = new Set<string>();

  for (const savedItemId of input.savedItemIds) {
    if (typeof savedItemId !== "string" || !savedItemId) {
      return null;
    }

    savedItemIds.add(savedItemId);
  }

  if (savedItemIds.size === 0) {
    return null;
  }

  return {
    savedItemIds: [...savedItemIds].slice(0, 100),
    destinationFolderId:
      typeof input.destinationFolderId === "string" && input.destinationFolderId
        ? input.destinationFolderId
        : null,
  };
};

const parseAddSavedItemTagInput = (input: unknown): AddSavedItemTagInput | null => {
  if (
    !isRecord(input) ||
    typeof input.savedItemId !== "string" ||
    !input.savedItemId ||
    typeof input.tagId !== "string" ||
    !input.tagId
  ) {
    return null;
  }

  return {
    savedItemId: input.savedItemId,
    tagId: input.tagId,
  };
};

const parseCreateFolderInput = (input: unknown): CreateFolderInput | null => {
  if (!isRecord(input) || typeof input.libraryId !== "string") {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    iconColor: parseFolderIconColor(input.iconColor),
    iconName: parseFolderIconName(input.iconName),
    libraryId: input.libraryId,
    name,
    parentId: typeof input.parentId === "string" && input.parentId ? input.parentId : null,
  };
};

const parseUpdateFolderInput = (input: unknown): UpdateFolderInput | null => {
  if (!isRecord(input) || typeof input.folderId !== "string") {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    folderId: input.folderId,
    iconColor: parseFolderIconColor(input.iconColor),
    iconName: parseFolderIconName(input.iconName),
    name,
  };
};

const parseCreateTagInput = (input: unknown): CreateTagInput | null => {
  if (!isRecord(input) || typeof input.libraryId !== "string") {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    color: parseFolderIconColor(input.color),
    libraryId: input.libraryId,
    name,
  };
};

const parseUpdateTagInput = (input: unknown): UpdateTagInput | null => {
  if (!isRecord(input) || typeof input.tagId !== "string" || !input.tagId) {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    color: parseFolderIconColor(input.color),
    name,
    tagId: input.tagId,
  };
};

const parseMoveTagInput = (input: unknown): MoveTagInput | null => {
  if (!isRecord(input) || typeof input.tagId !== "string" || !input.tagId) {
    return null;
  }

  if (!Array.isArray(input.orderedTagIds)) {
    return null;
  }

  const orderedTagIds = new Set<string>();

  for (const tagId of input.orderedTagIds) {
    if (typeof tagId !== "string" || !tagId) {
      return null;
    }

    orderedTagIds.add(tagId);
  }

  if (orderedTagIds.size === 0) {
    return null;
  }

  return {
    orderedTagIds: [...orderedTagIds].slice(0, 200),
    tagId: input.tagId,
  };
};

const parseDeleteTagInput = (input: unknown): DeleteTagInput | null => {
  if (!isRecord(input) || typeof input.tagId !== "string" || !input.tagId) {
    return null;
  }

  return {
    tagId: input.tagId,
  };
};

const parseMoveFolderInput = (input: unknown): MoveFolderInput | null => {
  if (!isRecord(input) || typeof input.folderId !== "string" || !input.folderId) {
    return null;
  }

  if (!Array.isArray(input.orderedSiblingIds)) {
    return null;
  }

  const orderedSiblingIds = new Set<string>();

  for (const folderId of input.orderedSiblingIds) {
    if (typeof folderId !== "string" || !folderId) {
      return null;
    }

    orderedSiblingIds.add(folderId);
  }

  if (orderedSiblingIds.size === 0) {
    return null;
  }

  return {
    folderId: input.folderId,
    orderedSiblingIds: [...orderedSiblingIds].slice(0, 200),
    parentId: typeof input.parentId === "string" && input.parentId ? input.parentId : null,
  };
};

const parseDeleteFolderInput = (input: unknown): DeleteFolderInput | null => {
  if (!isRecord(input) || typeof input.folderId !== "string") {
    return null;
  }

  if (input.mode !== "move" && input.mode !== "delete") {
    return null;
  }

  return {
    destinationFolderId:
      typeof input.destinationFolderId === "string" && input.destinationFolderId
        ? input.destinationFolderId
        : null,
    folderId: input.folderId,
    mode: input.mode,
  };
};

const parseStartGithubConnectionInput = (input: unknown): StartGithubConnectionInput | null => {
  if (!isRecord(input) || typeof input.libraryId !== "string" || !input.libraryId) {
    return null;
  }

  return {
    libraryId: input.libraryId,
    redirectUri:
      typeof input.redirectUri === "string" && input.redirectUri ? input.redirectUri : null,
  };
};

const parseGithubConnectionCallbackInput = (
  input: unknown,
): { code: string; state: string } | null => {
  if (
    !isRecord(input) ||
    typeof input.code !== "string" ||
    !input.code ||
    typeof input.state !== "string" ||
    !input.state
  ) {
    return null;
  }

  return {
    code: input.code,
    state: input.state,
  };
};

const parseIntegrationAccountInput = (input: unknown): { integrationAccountId: string } | null => {
  if (
    !isRecord(input) ||
    typeof input.integrationAccountId !== "string" ||
    !input.integrationAccountId
  ) {
    return null;
  }

  return {
    integrationAccountId: input.integrationAccountId,
  };
};

const parseSetIntegrationEnabledInput = (input: unknown): SetIntegrationEnabledInput | null => {
  const account = parseIntegrationAccountInput(input);

  if (!account || !isRecord(input) || typeof input.enabled !== "boolean") {
    return null;
  }

  return {
    ...account,
    enabled: input.enabled,
  };
};

const parseProviderInput = (
  input: unknown,
): { libraryId: string; provider: IntegrationProvider } | null => {
  if (
    !isRecord(input) ||
    typeof input.libraryId !== "string" ||
    !input.libraryId ||
    input.provider !== "github"
  ) {
    return null;
  }

  return {
    libraryId: input.libraryId,
    provider: input.provider,
  };
};

const parseUpdateProviderSettingsInput = (input: unknown): UpdateProviderSettingsInput | null => {
  const provider = parseProviderInput(input);

  if (!provider || !isRecord(input)) {
    return null;
  }

  return {
    ...provider,
    defaultFolderId:
      typeof input.defaultFolderId === "string" && input.defaultFolderId
        ? input.defaultFolderId
        : null,
  };
};

const parseCreateImportRuleInput = (input: unknown): CreateImportRuleInput | null => {
  const provider = parseProviderInput(input);

  if (!provider || !isRecord(input)) {
    return null;
  }

  const conditionField = parseRuleField(input.conditionField);
  const conditionOperator = parseRuleOperator(input.conditionOperator);
  const actionType = parseRuleActionType(input.actionType);
  const conditionValue = parseRuleValue(input.conditionValue);

  if (
    !conditionField ||
    !conditionOperator ||
    conditionValue === null ||
    !actionType ||
    typeof input.actionTargetId !== "string" ||
    !input.actionTargetId
  ) {
    return null;
  }

  return {
    ...provider,
    actionTargetId: input.actionTargetId,
    actionType,
    conditionField,
    conditionOperator,
    conditionValue,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
  };
};

const parseUpdateImportRuleInput = (input: unknown): UpdateImportRuleInput | null => {
  if (!isRecord(input) || typeof input.importRuleId !== "string" || !input.importRuleId) {
    return null;
  }

  const update: UpdateImportRuleInput = {
    importRuleId: input.importRuleId,
  };

  if (input.conditionField !== undefined) {
    const value = parseRuleField(input.conditionField);
    if (!value) return null;
    update.conditionField = value;
  }

  if (input.conditionOperator !== undefined) {
    const value = parseRuleOperator(input.conditionOperator);
    if (!value) return null;
    update.conditionOperator = value;
  }

  if (input.conditionValue !== undefined) {
    const value = parseRuleValue(input.conditionValue);
    if (value === null) return null;
    update.conditionValue = value;
  }

  if (input.actionType !== undefined) {
    const value = parseRuleActionType(input.actionType);
    if (!value) return null;
    update.actionType = value;
  }

  if (input.actionTargetId !== undefined) {
    if (typeof input.actionTargetId !== "string" || !input.actionTargetId) return null;
    update.actionTargetId = input.actionTargetId;
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") return null;
    update.enabled = input.enabled;
  }

  return update;
};

const parseReorderImportRulesInput = (input: unknown): ReorderImportRulesInput | null => {
  const provider = parseProviderInput(input);

  if (!provider || !isRecord(input) || !Array.isArray(input.orderedImportRuleIds)) {
    return null;
  }

  const orderedImportRuleIds = new Set<string>();

  for (const id of input.orderedImportRuleIds) {
    if (typeof id !== "string" || !id) {
      return null;
    }

    orderedImportRuleIds.add(id);
  }

  return {
    ...provider,
    orderedImportRuleIds: [...orderedImportRuleIds],
  };
};

const parseDeleteImportRuleInput = (input: unknown): DeleteImportRuleInput | null => {
  if (!isRecord(input) || typeof input.importRuleId !== "string" || !input.importRuleId) {
    return null;
  }

  return {
    importRuleId: input.importRuleId,
  };
};

const parseRuleField = (value: unknown): CreateImportRuleInput["conditionField"] | null => {
  if (
    value === "language" ||
    value === "topics" ||
    value === "name" ||
    value === "stargazers_count" ||
    value === "forks_count" ||
    value === "private" ||
    value === "archived"
  ) {
    return value;
  }

  return null;
};

const parseRuleOperator = (value: unknown): CreateImportRuleInput["conditionOperator"] | null => {
  if (
    value === "is" ||
    value === "contains" ||
    value === ">" ||
    value === ">=" ||
    value === "<" ||
    value === "<=" ||
    value === "=="
  ) {
    return value;
  }

  return null;
};

const parseRuleActionType = (value: unknown): CreateImportRuleInput["actionType"] | null => {
  if (value === "add_tag" || value === "move_to_folder") {
    return value;
  }

  return null;
};

const parseRuleValue = (value: unknown): string | number | boolean | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return null;
};

const parseFolderName = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();

  return name ? name : null;
};

const parseFolderIconName = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const iconName = value.trim();

  return /^Icon[A-Za-z0-9]+$/.test(iconName) ? iconName : null;
};

const parseFolderIconColor = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const color = value.trim();

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null;
};

const parseSelectedTagIds = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tagIds = new Set<string>();

  for (const tagId of value) {
    if (typeof tagId !== "string" || !tagId) {
      return undefined;
    }

    tagIds.add(tagId);
  }

  return [...tagIds].slice(0, 50);
};

const currentUserLibraryIds = (currentUser: CurrentIdentity) =>
  currentUser.libraries.map((library) => library.id);

function assertCurrentUser(
  currentUser: CurrentIdentity | undefined,
): asserts currentUser is CurrentIdentity {
  if (!currentUser) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "No current user is configured",
    });
  }
}

function assertSavedItemsStore(
  savedItemsStore: SavedItemsStore | undefined,
): asserts savedItemsStore is SavedItemsStore {
  if (!savedItemsStore) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Saved item storage is not configured",
    });
  }
}

function assertSavedItemSearchIndex(
  savedItemSearchIndex: SavedItemSearchIndex | undefined,
): asserts savedItemSearchIndex is SavedItemSearchIndex {
  if (!savedItemSearchIndex) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Search index is not configured",
    });
  }
}

function assertIntegrationsStore(
  integrationsStore: IntegrationsStore | undefined,
): asserts integrationsStore is IntegrationsStore {
  if (!integrationsStore) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Integration storage is not configured",
    });
  }
}

function assertGitHubClient(
  githubClient: GitHubClient | undefined,
): asserts githubClient is GitHubClient {
  if (!githubClient) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "GitHub integration is not configured",
    });
  }
}

function integrationMutationError(error: unknown) {
  if (error instanceof Error && error.message.includes("does not exist")) {
    return new ORPCError("NOT_FOUND", {
      message: error.message,
    });
  }

  if (error instanceof Error && error.message.includes("Choose an available")) {
    return new ORPCError("BAD_REQUEST", {
      message: error.message,
    });
  }

  return new ORPCError("INTERNAL_SERVER_ERROR", {
    message: error instanceof Error ? error.message : "Integration request failed",
  });
}

function assertOAuthScope(
  availableScopes: ReadonlySet<OAuthScope> | undefined,
  requiredScope: OAuthScope,
) {
  if (!hasOAuthScope(availableScopes, requiredScope)) {
    throw new ORPCError("FORBIDDEN", {
      message: `Missing OAuth scope: ${requiredScope}`,
    });
  }
}

async function upsertSavedItemSearchDocuments(
  savedItemsStore: SavedItemsStore,
  savedItemSearchIndex: SavedItemSearchIndex | undefined,
  input: Parameters<SavedItemsStore["listSavedItemSearchDocuments"]>[0],
) {
  if (!savedItemSearchIndex) {
    return;
  }

  const documents = await savedItemsStore.listSavedItemSearchDocuments(input);

  if (documents.length === 0) {
    return;
  }

  await savedItemSearchIndex.upsert(documents).catch((error: unknown) => {
    console.error("Unable to upsert saved items into search index", error);
  });
}
