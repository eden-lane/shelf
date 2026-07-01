import type {
  ImportRuleItem,
  IntegrationAccountItem,
  IntegrationProvider,
  ProviderImportSettingsItem,
  SyncRunItem,
} from "@shelf/shared";
import { and, asc, desc, eq, inArray, isNull, max, ne, or, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { GitHubCredentialError } from "./github";
import { repositoryValue, ruleMatchesRepository } from "./rules";
import type { GitHubClient, GitHubRepository, ImportRuleRecord, IntegrationsStore } from "./types";

export const createDatabaseIntegrationsStore = (
  db: Database,
  githubClient: GitHubClient,
): IntegrationsStore => ({
  listAccounts: (input) => listAccounts(db, input.allowedLibraryIds),
  createOrUpdateAccount: (input) => createOrUpdateAccount(db, input),
  disconnectAccount: (input) => disconnectAccount(db, input),
  setAccountEnabled: (input) => setAccountEnabled(db, input),
  getProviderSettings: (input) => getProviderSettings(db, input),
  updateProviderSettings: (input) => updateProviderSettings(db, input),
  listImportRules: (input) => listImportRules(db, input),
  createImportRule: (input) => createImportRule(db, input),
  updateImportRule: (input) => updateImportRule(db, input),
  reorderImportRules: (input) => reorderImportRules(db, input),
  deleteImportRule: (input) => deleteImportRule(db, input),
  listSyncRuns: (input) => listSyncRuns(db, input),
  listLatestSyncRuns: (input) => listLatestSyncRuns(db, input.allowedLibraryIds),
  syncGitHubStars: (input) => syncGitHubStars(db, githubClient, input),
  syncDueGitHubStars: () => syncDueGitHubStars(db, githubClient),
});

const listAccounts = async (
  db: Database,
  allowedLibraryIds: string[],
): Promise<IntegrationAccountItem[]> => {
  if (allowedLibraryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(schema.integrationAccounts)
    .where(
      and(
        inArray(schema.integrationAccounts.libraryId, allowedLibraryIds),
        ne(schema.integrationAccounts.status, "disconnected"),
      ),
    )
    .orderBy(
      asc(schema.integrationAccounts.provider),
      asc(schema.integrationAccounts.externalAccountName),
    );

  return rows.map(serializeAccount);
};

const createOrUpdateAccount = async (
  db: Database,
  input: Parameters<IntegrationsStore["createOrUpdateAccount"]>[0],
): Promise<IntegrationAccountItem> => {
  const [existing] = await db
    .select()
    .from(schema.integrationAccounts)
    .where(
      and(
        eq(schema.integrationAccounts.libraryId, input.libraryId),
        eq(schema.integrationAccounts.provider, input.provider),
        eq(schema.integrationAccounts.providerSurface, input.providerSurface),
        eq(schema.integrationAccounts.externalAccountId, input.externalAccountId),
        ne(schema.integrationAccounts.status, "disconnected"),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.integrationAccounts)
      .set({
        accessToken: input.accessToken,
        connectedByUserId: input.connectedByUserId,
        externalAccountName: input.externalAccountName,
        status: "connected",
        updatedAt: sql`now()`,
      })
      .where(eq(schema.integrationAccounts.id, existing.id))
      .returning();

    return serializeAccount(updated ?? existing);
  }

  const [row] = await db
    .insert(schema.integrationAccounts)
    .values({
      accessToken: input.accessToken,
      connectedByUserId: input.connectedByUserId,
      externalAccountId: input.externalAccountId,
      externalAccountName: input.externalAccountName,
      libraryId: input.libraryId,
      provider: input.provider,
      providerSurface: input.providerSurface,
      status: "connected",
    })
    .returning();

  if (!row) {
    throw new Error("Unable to connect integration account");
  }

  return serializeAccount(row);
};

const disconnectAccount = async (
  db: Database,
  input: { integrationAccountId: string; allowedLibraryIds: string[] },
): Promise<IntegrationAccountItem> => {
  const [row] = await db
    .update(schema.integrationAccounts)
    .set({
      accessToken: null,
      status: "disconnected",
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(schema.integrationAccounts.id, input.integrationAccountId),
        inArray(schema.integrationAccounts.libraryId, input.allowedLibraryIds),
      ),
    )
    .returning();

  if (!row) {
    throw new Error("Integration account does not exist");
  }

  return serializeAccount(row);
};

const setAccountEnabled = async (
  db: Database,
  input: { integrationAccountId: string; allowedLibraryIds: string[]; enabled: boolean },
): Promise<IntegrationAccountItem> => {
  const [current] = await db
    .select()
    .from(schema.integrationAccounts)
    .where(
      and(
        eq(schema.integrationAccounts.id, input.integrationAccountId),
        inArray(schema.integrationAccounts.libraryId, input.allowedLibraryIds),
        ne(schema.integrationAccounts.status, "disconnected"),
      ),
    )
    .limit(1);

  if (!current) {
    throw new Error("Integration account does not exist");
  }

  if (current.status === "needs_reconnect" && input.enabled) {
    return serializeAccount(current);
  }

  const [row] = await db
    .update(schema.integrationAccounts)
    .set({
      status: input.enabled ? "connected" : "disabled",
      updatedAt: sql`now()`,
    })
    .where(eq(schema.integrationAccounts.id, current.id))
    .returning();

  return serializeAccount(row ?? current);
};

const getProviderSettings = async (
  db: Database,
  input: { libraryId: string; provider: IntegrationProvider; allowedLibraryIds: string[] },
): Promise<ProviderImportSettingsItem> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  const [row] = await db
    .insert(schema.providerImportSettings)
    .values({
      defaultFolderId: null,
      libraryId: input.libraryId,
      provider: input.provider,
    })
    .onConflictDoUpdate({
      target: [schema.providerImportSettings.libraryId, schema.providerImportSettings.provider],
      set: { updatedAt: sql`${schema.providerImportSettings.updatedAt}` },
    })
    .returning();

  if (!row) {
    throw new Error("Unable to load provider settings");
  }

  return serializeProviderSettings(row);
};

const updateProviderSettings = async (
  db: Database,
  input: Parameters<IntegrationsStore["updateProviderSettings"]>[0],
): Promise<ProviderImportSettingsItem> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  if (input.defaultFolderId) {
    const [folder] = await db
      .select({ id: schema.folders.id })
      .from(schema.folders)
      .where(
        and(
          eq(schema.folders.id, input.defaultFolderId),
          eq(schema.folders.libraryId, input.libraryId),
        ),
      )
      .limit(1);

    if (!folder) {
      throw new Error("Default folder does not exist");
    }
  }

  const [row] = await db
    .insert(schema.providerImportSettings)
    .values({
      defaultFolderId: input.defaultFolderId,
      libraryId: input.libraryId,
      provider: input.provider,
    })
    .onConflictDoUpdate({
      target: [schema.providerImportSettings.libraryId, schema.providerImportSettings.provider],
      set: {
        defaultFolderId: input.defaultFolderId,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Unable to update provider settings");
  }

  return serializeProviderSettings(row);
};

const listImportRules = async (
  db: Database,
  input: { libraryId: string; provider: IntegrationProvider; allowedLibraryIds: string[] },
): Promise<ImportRuleRecord[]> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  const rows = await db
    .select()
    .from(schema.importRules)
    .where(
      and(
        eq(schema.importRules.libraryId, input.libraryId),
        eq(schema.importRules.provider, input.provider),
      ),
    )
    .orderBy(asc(schema.importRules.sortOrder), asc(schema.importRules.createdAt));

  return rows.map(serializeImportRule);
};

const createImportRule = async (
  db: Database,
  input: Parameters<IntegrationsStore["createImportRule"]>[0],
): Promise<ImportRuleRecord> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);
  await assertActionTarget(db, input.libraryId, input.actionType, input.actionTargetId);

  const [sort] = await db
    .select({ value: max(schema.importRules.sortOrder) })
    .from(schema.importRules)
    .where(
      and(
        eq(schema.importRules.libraryId, input.libraryId),
        eq(schema.importRules.provider, input.provider),
      ),
    );
  const [row] = await db
    .insert(schema.importRules)
    .values({
      actionTargetId: input.actionTargetId,
      actionType: input.actionType,
      conditionField: input.conditionField,
      conditionOperator: input.conditionOperator,
      conditionValue: input.conditionValue,
      enabled: input.enabled,
      libraryId: input.libraryId,
      provider: input.provider,
      sortOrder: (sort?.value ?? -1) + 1,
    })
    .returning();

  if (!row) {
    throw new Error("Unable to create import rule");
  }

  return serializeImportRule(row);
};

const updateImportRule = async (
  db: Database,
  input: Parameters<IntegrationsStore["updateImportRule"]>[0],
): Promise<ImportRuleRecord> => {
  const [current] = await db
    .select()
    .from(schema.importRules)
    .where(
      and(
        eq(schema.importRules.id, input.importRuleId),
        inArray(schema.importRules.libraryId, input.allowedLibraryIds),
      ),
    )
    .limit(1);

  if (!current) {
    throw new Error("Import rule does not exist");
  }

  const nextActionType = input.actionType ?? current.actionType;
  const nextActionTargetId = input.actionTargetId ?? current.actionTargetId;
  await assertActionTarget(db, current.libraryId, nextActionType, nextActionTargetId);

  const [row] = await db
    .update(schema.importRules)
    .set({
      actionTargetId: nextActionTargetId,
      actionType: nextActionType,
      conditionField: input.conditionField ?? current.conditionField,
      conditionOperator: input.conditionOperator ?? current.conditionOperator,
      conditionValue: input.conditionValue ?? current.conditionValue,
      enabled: input.enabled ?? current.enabled,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.importRules.id, current.id))
    .returning();

  return serializeImportRule(row ?? current);
};

const reorderImportRules = async (
  db: Database,
  input: Parameters<IntegrationsStore["reorderImportRules"]>[0],
): Promise<ImportRuleRecord[]> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  const rules = await listImportRules(db, input);
  const ruleIds = new Set(rules.map((rule) => rule.id));

  if (input.orderedImportRuleIds.some((id) => !ruleIds.has(id))) {
    throw new Error("Choose available import rules");
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of input.orderedImportRuleIds.entries()) {
      await tx
        .update(schema.importRules)
        .set({ sortOrder: index, updatedAt: sql`now()` })
        .where(eq(schema.importRules.id, id));
    }
  });

  return listImportRules(db, input);
};

const deleteImportRule = async (
  db: Database,
  input: { importRuleId: string; allowedLibraryIds: string[] },
): Promise<{ deletedImportRuleId: string }> => {
  const [row] = await db
    .delete(schema.importRules)
    .where(
      and(
        eq(schema.importRules.id, input.importRuleId),
        inArray(schema.importRules.libraryId, input.allowedLibraryIds),
      ),
    )
    .returning({ id: schema.importRules.id });

  if (!row) {
    throw new Error("Import rule does not exist");
  }

  return { deletedImportRuleId: row.id };
};

const listSyncRuns = async (
  db: Database,
  input: { integrationAccountId: string; allowedLibraryIds: string[] },
): Promise<SyncRunItem[]> => {
  const [account] = await db
    .select({ id: schema.integrationAccounts.id })
    .from(schema.integrationAccounts)
    .where(
      and(
        eq(schema.integrationAccounts.id, input.integrationAccountId),
        inArray(schema.integrationAccounts.libraryId, input.allowedLibraryIds),
      ),
    )
    .limit(1);

  if (!account) {
    throw new Error("Integration account does not exist");
  }

  const rows = await db
    .select()
    .from(schema.syncRuns)
    .where(eq(schema.syncRuns.integrationAccountId, account.id))
    .orderBy(desc(schema.syncRuns.createdAt))
    .limit(10);

  return rows.map(serializeSyncRun);
};

const listLatestSyncRuns = async (
  db: Database,
  allowedLibraryIds: string[],
): Promise<SyncRunItem[]> => {
  if (allowedLibraryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      syncRun: schema.syncRuns,
    })
    .from(schema.syncRuns)
    .innerJoin(
      schema.integrationAccounts,
      eq(schema.syncRuns.integrationAccountId, schema.integrationAccounts.id),
    )
    .where(inArray(schema.integrationAccounts.libraryId, allowedLibraryIds))
    .orderBy(desc(schema.syncRuns.createdAt))
    .limit(20);

  return rows.map((row) => serializeSyncRun(row.syncRun));
};

const syncDueGitHubStars = async (
  db: Database,
  githubClient: GitHubClient,
): Promise<Awaited<ReturnType<IntegrationsStore["syncDueGitHubStars"]>>> => {
  const rows = await db
    .select({ id: schema.integrationAccounts.id })
    .from(schema.integrationAccounts)
    .where(
      and(
        eq(schema.integrationAccounts.provider, "github"),
        eq(schema.integrationAccounts.providerSurface, "github_stars"),
        eq(schema.integrationAccounts.status, "connected"),
        or(
          isNull(schema.integrationAccounts.lastSyncFinishedAt),
          sql`${schema.integrationAccounts.lastSyncFinishedAt} < now() - interval '6 hours'`,
        ),
      ),
    )
    .limit(5);

  const results = [];

  for (const row of rows) {
    try {
      results.push(await syncGitHubStars(db, githubClient, { integrationAccountId: row.id }));
    } catch (error) {
      console.error("Scheduled GitHub stars sync failed", error);
    }
  }

  return results;
};

const syncGitHubStars = async (
  db: Database,
  githubClient: GitHubClient,
  input: { integrationAccountId: string; allowedLibraryIds?: string[] },
) => {
  const account = await loadSyncableAccount(
    db,
    input.integrationAccountId,
    input.allowedLibraryIds,
  );

  if (!account) {
    throw new Error("Integration account is not available for sync");
  }

  const existingRun = await findActiveRun(db, account.id);

  if (existingRun) {
    return {
      run: serializeSyncRun(existingRun),
      savedItemIds: [],
    };
  }

  const [createdRun] = await db
    .insert(schema.syncRuns)
    .values({
      integrationAccountId: account.id,
      status: "queued",
    })
    .returning();

  if (!createdRun) {
    throw new Error("Unable to create sync run");
  }

  let run = createdRun;
  const savedItemIds = new Set<string>();
  let createdCount = 0;
  let attachedCount = 0;
  let failedCount = 0;
  let cursor = createdRun.checkpoint;

  try {
    run = await markRunRunning(db, run.id, account.id);

    while (true) {
      const page = await githubClient.listStars(account.accessToken, cursor);

      for (const repository of page.repositories) {
        try {
          const result = await importGitHubRepository(db, account, repository);
          savedItemIds.add(result.savedItemId);

          if (result.created) {
            createdCount += 1;
          } else {
            attachedCount += 1;
          }
        } catch (error) {
          failedCount += 1;
          console.error("Unable to import GitHub starred repository", error);
        }
      }

      cursor = page.nextCursor;
      run = await updateRunProgress(db, run.id, {
        attachedCount,
        checkpoint: cursor,
        createdCount,
        failedCount,
      });

      if (!cursor) {
        break;
      }
    }

    run = await finishRun(db, run.id, account.id, {
      attachedCount,
      checkpoint: cursor,
      createdCount,
      failedCount,
      status: failedCount > 0 ? "failed" : "succeeded",
      lastError: failedCount > 0 ? `${failedCount} repositories failed to import` : null,
    });
  } catch (error) {
    const needsReconnect = error instanceof GitHubCredentialError;
    const message = error instanceof Error ? error.message : "GitHub sync failed";

    if (needsReconnect) {
      await db
        .update(schema.integrationAccounts)
        .set({ status: "needs_reconnect", updatedAt: sql`now()` })
        .where(eq(schema.integrationAccounts.id, account.id));
    }

    run = await finishRun(db, run.id, account.id, {
      attachedCount,
      checkpoint: cursor,
      createdCount,
      failedCount,
      lastError: message,
      status: "failed",
    });
  }

  return {
    run: serializeSyncRun(run),
    savedItemIds: [...savedItemIds],
  };
};

const importGitHubRepository = async (
  db: Database,
  account: { id: string; libraryId: string; connectedByUserId: string },
  repository: GitHubRepository,
): Promise<{ savedItemId: string; created: boolean }> =>
  db.transaction(async (tx) => {
    const url = canonicalGitHubRepositoryUrl(repository);
    const existingItem = await tx
      .select({ id: schema.savedItems.id })
      .from(schema.savedItems)
      .where(
        and(eq(schema.savedItems.libraryId, account.libraryId), eq(schema.savedItems.url, url)),
      )
      .limit(1);
    let savedItemId = existingItem[0]?.id;
    let created = false;

    if (!savedItemId) {
      const settings = await tx
        .select({ defaultFolderId: schema.providerImportSettings.defaultFolderId })
        .from(schema.providerImportSettings)
        .where(
          and(
            eq(schema.providerImportSettings.libraryId, account.libraryId),
            eq(schema.providerImportSettings.provider, "github"),
          ),
        )
        .limit(1);
      const [savedItem] = await tx
        .insert(schema.savedItems)
        .values({
          createdByUserId: account.connectedByUserId,
          description: repository.description,
          folderId: settings[0]?.defaultFolderId ?? null,
          imageUrl: null,
          libraryId: account.libraryId,
          metadataFetchedAt: null,
          metadataStatus: "pending",
          siteName: "GitHub",
          title: repository.full_name,
          url,
        })
        .returning({ id: schema.savedItems.id });

      if (!savedItem) {
        throw new Error("Unable to create saved item");
      }

      savedItemId = savedItem.id;
      created = true;
    }

    const [externalItem] = await tx
      .insert(schema.externalItems)
      .values({
        externalId: String(repository.id),
        externalUrl: repository.html_url,
        integrationAccountId: account.id,
        libraryId: account.libraryId,
        metadataStatus: "complete",
        presenceStatus: "present",
        provider: "github",
        providerMetadata: repository as unknown as Record<string, unknown>,
        providerSurface: "github_stars",
        savedItemId,
      })
      .onConflictDoUpdate({
        target: [
          schema.externalItems.integrationAccountId,
          schema.externalItems.providerSurface,
          schema.externalItems.externalId,
        ],
        set: {
          externalUrl: repository.html_url,
          lastSeenAt: sql`now()`,
          metadataStatus: "complete",
          missingSince: null,
          presenceStatus: "present",
          providerMetadata: repository as unknown as Record<string, unknown>,
          savedItemId,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: schema.externalItems.id });

    if (!externalItem) {
      throw new Error("Unable to upsert external item");
    }

    await applySystemLabel(tx, account.libraryId, savedItemId, "github_stars", "GitHub Stars");

    if (created) {
      await applyImportRules(tx, account.libraryId, savedItemId, externalItem.id, repository);
    }

    return { created, savedItemId };
  });

const applySystemLabel = async (
  db: Database,
  libraryId: string,
  savedItemId: string,
  key: string,
  name: string,
) => {
  const [label] = await db
    .insert(schema.systemLabels)
    .values({ key, libraryId, name })
    .onConflictDoUpdate({
      target: [schema.systemLabels.libraryId, schema.systemLabels.key],
      set: { name, updatedAt: sql`now()` },
    })
    .returning({ id: schema.systemLabels.id });

  if (!label) {
    throw new Error("Unable to upsert system label");
  }

  await db
    .insert(schema.savedItemSystemLabels)
    .values({
      libraryId,
      savedItemId,
      systemLabelId: label.id,
    })
    .onConflictDoNothing();
};

const applyImportRules = async (
  db: Database,
  libraryId: string,
  savedItemId: string,
  externalItemId: string,
  repository: GitHubRepository,
) => {
  const rules = await db
    .select()
    .from(schema.importRules)
    .where(
      and(
        eq(schema.importRules.libraryId, libraryId),
        eq(schema.importRules.provider, "github"),
        eq(schema.importRules.enabled, true),
      ),
    )
    .orderBy(asc(schema.importRules.sortOrder), asc(schema.importRules.createdAt));
  let destinationFolderId: string | null | undefined;

  for (const row of rules) {
    const rule = serializeImportRule(row);

    if (!ruleMatchesRepository(rule, repository)) {
      continue;
    }

    if (rule.actionType === "add_tag") {
      const [tag] = await db
        .select({ id: schema.tags.id })
        .from(schema.tags)
        .where(and(eq(schema.tags.id, rule.actionTargetId), eq(schema.tags.libraryId, libraryId)))
        .limit(1);

      if (tag) {
        await db
          .insert(schema.savedItemTags)
          .values({ libraryId, savedItemId, tagId: tag.id })
          .onConflictDoNothing();
      }
    } else if (rule.actionType === "move_to_folder") {
      if (rule.actionTargetId === "inbox") {
        destinationFolderId = null;
      } else {
        const [folder] = await db
          .select({ id: schema.folders.id })
          .from(schema.folders)
          .where(
            and(
              eq(schema.folders.id, rule.actionTargetId),
              eq(schema.folders.libraryId, libraryId),
            ),
          )
          .limit(1);

        if (folder) {
          destinationFolderId = folder.id;
        }
      }
    }

    await db.insert(schema.ruleApplications).values({
      actionTargetId: rule.actionTargetId,
      actionType: rule.actionType,
      externalItemId,
      importRuleId: rule.id,
      libraryId,
      matchedField: rule.conditionField,
      matchedValue: repositoryValue(rule.conditionField, repository),
      savedItemId,
    });
  }

  if (destinationFolderId !== undefined) {
    await db
      .update(schema.savedItems)
      .set({ folderId: destinationFolderId, updatedAt: sql`now()` })
      .where(
        and(eq(schema.savedItems.id, savedItemId), eq(schema.savedItems.libraryId, libraryId)),
      );
  }
};

const loadSyncableAccount = async (
  db: Database,
  integrationAccountId: string,
  allowedLibraryIds?: string[],
) => {
  const where = [
    eq(schema.integrationAccounts.id, integrationAccountId),
    eq(schema.integrationAccounts.provider, "github"),
    eq(schema.integrationAccounts.providerSurface, "github_stars"),
    eq(schema.integrationAccounts.status, "connected"),
  ];

  if (allowedLibraryIds) {
    where.push(inArray(schema.integrationAccounts.libraryId, allowedLibraryIds));
  }

  const [row] = await db
    .select()
    .from(schema.integrationAccounts)
    .where(and(...where))
    .limit(1);

  if (!row?.accessToken) {
    return null;
  }

  return {
    accessToken: row.accessToken,
    connectedByUserId: row.connectedByUserId,
    id: row.id,
    libraryId: row.libraryId,
  };
};

const findActiveRun = async (db: Database, integrationAccountId: string) => {
  const [row] = await db
    .select()
    .from(schema.syncRuns)
    .where(
      and(
        eq(schema.syncRuns.integrationAccountId, integrationAccountId),
        inArray(schema.syncRuns.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(schema.syncRuns.createdAt))
    .limit(1);

  return row ?? null;
};

const markRunRunning = async (db: Database, runId: string, integrationAccountId: string) => {
  const [row] = await db
    .update(schema.syncRuns)
    .set({ startedAt: new Date(), status: "running", updatedAt: sql`now()` })
    .where(eq(schema.syncRuns.id, runId))
    .returning();

  await db
    .update(schema.integrationAccounts)
    .set({ lastSyncStartedAt: new Date(), lastSyncStatus: "running", updatedAt: sql`now()` })
    .where(eq(schema.integrationAccounts.id, integrationAccountId));

  if (!row) {
    throw new Error("Unable to start sync run");
  }

  return row;
};

const updateRunProgress = async (
  db: Database,
  runId: string,
  input: {
    attachedCount: number;
    checkpoint: string | null;
    createdCount: number;
    failedCount: number;
  },
) => {
  const [row] = await db
    .update(schema.syncRuns)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(schema.syncRuns.id, runId))
    .returning();

  if (!row) {
    throw new Error("Unable to update sync run");
  }

  return row;
};

const finishRun = async (
  db: Database,
  runId: string,
  integrationAccountId: string,
  input: {
    attachedCount: number;
    checkpoint: string | null;
    createdCount: number;
    failedCount: number;
    lastError: string | null;
    status: "succeeded" | "failed";
  },
) => {
  const finishedAt = new Date();
  const [row] = await db
    .update(schema.syncRuns)
    .set({ ...input, finishedAt, updatedAt: sql`now()` })
    .where(eq(schema.syncRuns.id, runId))
    .returning();

  await db
    .update(schema.integrationAccounts)
    .set({
      lastSyncFinishedAt: finishedAt,
      lastSyncStatus: input.status,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.integrationAccounts.id, integrationAccountId));

  if (!row) {
    throw new Error("Unable to finish sync run");
  }

  return row;
};

const assertActionTarget = async (
  db: Database,
  libraryId: string,
  actionType: ImportRuleItem["actionType"],
  actionTargetId: string,
) => {
  if (actionType === "move_to_folder" && actionTargetId === "inbox") {
    return;
  }

  const table = actionType === "add_tag" ? schema.tags : schema.folders;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, actionTargetId), eq(table.libraryId, libraryId)))
    .limit(1);

  if (!row) {
    throw new Error("Rule action target does not exist");
  }
};

const assertAllowedLibrary = (libraryId: string, allowedLibraryIds: string[]) => {
  if (!allowedLibraryIds.includes(libraryId)) {
    throw new Error("Choose an available workspace");
  }
};

const canonicalGitHubRepositoryUrl = (repository: GitHubRepository) => {
  const fullName = repository.full_name || `${repository.owner.login}/${repository.name}`;

  return `https://github.com/${fullName}`;
};

const serializeAccount = (
  row: typeof schema.integrationAccounts.$inferSelect,
): IntegrationAccountItem => ({
  createdAt: row.createdAt.toISOString(),
  externalAccountId: row.externalAccountId,
  externalAccountName: row.externalAccountName,
  id: row.id,
  lastSyncFinishedAt: row.lastSyncFinishedAt?.toISOString() ?? null,
  lastSyncStartedAt: row.lastSyncStartedAt?.toISOString() ?? null,
  lastSyncStatus: row.lastSyncStatus,
  libraryId: row.libraryId,
  provider: row.provider,
  providerSurface: row.providerSurface,
  status: row.status,
  updatedAt: row.updatedAt.toISOString(),
});

const serializeSyncRun = (row: typeof schema.syncRuns.$inferSelect): SyncRunItem => ({
  attachedCount: row.attachedCount,
  checkpoint: row.checkpoint,
  createdAt: row.createdAt.toISOString(),
  createdCount: row.createdCount,
  failedCount: row.failedCount,
  finishedAt: row.finishedAt?.toISOString() ?? null,
  id: row.id,
  integrationAccountId: row.integrationAccountId,
  lastError: row.lastError,
  skippedCount: row.skippedCount,
  startedAt: row.startedAt?.toISOString() ?? null,
  status: row.status,
  updatedAt: row.updatedAt.toISOString(),
});

const serializeProviderSettings = (
  row: typeof schema.providerImportSettings.$inferSelect,
): ProviderImportSettingsItem => ({
  createdAt: row.createdAt.toISOString(),
  defaultFolderId: row.defaultFolderId,
  id: row.id,
  libraryId: row.libraryId,
  provider: row.provider,
  updatedAt: row.updatedAt.toISOString(),
});

const serializeImportRule = (row: typeof schema.importRules.$inferSelect): ImportRuleRecord => ({
  actionTargetId: row.actionTargetId,
  actionType: row.actionType,
  conditionField: row.conditionField,
  conditionOperator: row.conditionOperator,
  conditionValue: row.conditionValue,
  enabled: row.enabled,
  id: row.id,
  libraryId: row.libraryId,
  provider: row.provider,
  sortOrder: row.sortOrder,
});
