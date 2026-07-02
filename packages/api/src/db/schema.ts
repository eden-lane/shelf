import type { Buffer } from "node:buffer";
import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", ["owner", "member"]);
export const libraryKind = pgEnum("library_kind", ["personal", "organization"]);
export const metadataStatus = pgEnum("metadata_status", ["pending", "fetched", "failed"]);
export const faviconStatus = pgEnum("favicon_status", ["pending", "fetched", "failed"]);
export const integrationProvider = pgEnum("integration_provider", ["github"]);
export const providerSurface = pgEnum("provider_surface", ["github_stars"]);
export const integrationAccountStatus = pgEnum("integration_account_status", [
  "connected",
  "disabled",
  "needs_reconnect",
  "disconnected",
]);
export const externalItemPresenceStatus = pgEnum("external_item_presence_status", [
  "present",
  "missing",
]);
export const externalItemMetadataStatus = pgEnum("external_item_metadata_status", [
  "complete",
  "partial",
  "failed",
]);
export const importRuleConditionField = pgEnum("import_rule_condition_field", [
  "language",
  "topics",
  "name",
  "stargazers_count",
  "forks_count",
  "private",
  "archived",
]);
export const importRuleConditionOperator = pgEnum("import_rule_condition_operator", [
  "is",
  "contains",
  ">",
  ">=",
  "<",
  "<=",
  "==",
]);
export const importRuleActionType = pgEnum("import_rule_action_type", [
  "add_tag",
  "move_to_folder",
]);
export const syncRunStatus = pgEnum("sync_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: text("name"),
    username: text("username"),
    avatarUrl: text("avatar_url"),
    billingCustomerId: text("billing_customer_id"),
    locale: text("locale"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique_idx").on(sql`lower(${table.email})`),
    uniqueIndex("users_username_unique_idx")
      .on(sql`lower(${table.username})`)
      .where(sql`${table.username} is not null`),
    uniqueIndex("users_billing_customer_unique_idx")
      .on(table.billingCustomerId)
      .where(sql`${table.billingCustomerId} is not null`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    uniqueIndex("sessions_token_hash_unique_idx").on(table.tokenHash),
  ],
);

export const oauthGrants = pgTable(
  "oauth_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    deviceName: text("device_name"),
    platform: text("platform"),
    browser: text("browser"),
    scopes: text("scopes").notNull(),
    compromisedAt: timestamp("compromised_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("oauth_grants_user_idx").on(table.userId),
    index("oauth_grants_user_client_idx").on(table.userId, table.clientId),
  ],
);

export const oauthAuthorizationCodes = pgTable(
  "oauth_authorization_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => oauthGrants.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeHash: text("code_hash").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    scopes: text("scopes").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("oauth_authorization_codes_grant_idx").on(table.grantId),
    uniqueIndex("oauth_authorization_codes_hash_unique_idx").on(table.codeHash),
  ],
);

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => oauthGrants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    scopes: text("scopes").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("oauth_access_tokens_grant_idx").on(table.grantId),
    uniqueIndex("oauth_access_tokens_hash_unique_idx").on(table.tokenHash),
  ],
);

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => oauthGrants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    rotatedFromId: uuid("rotated_from_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("oauth_refresh_tokens_grant_idx").on(table.grantId),
    uniqueIndex("oauth_refresh_tokens_hash_unique_idx").on(table.tokenHash),
    foreignKey({
      columns: [table.rotatedFromId],
      foreignColumns: [table.id],
      name: "oauth_refresh_tokens_rotated_from_fk",
    }),
  ],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organizations_slug_unique_idx").on(sql`lower(${table.slug})`)],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: organizationRole("role").notNull().default("member"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.organizationId],
      name: "organization_memberships_pkey",
    }),
  ],
);

export const libraries = pgTable(
  "libraries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: libraryKind("kind").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "libraries_exactly_one_owner_check",
      sql`(
        ${table.kind} = 'personal'
        and ${table.userId} is not null
        and ${table.organizationId} is null
      ) or (
        ${table.kind} = 'organization'
        and ${table.userId} is null
        and ${table.organizationId} is not null
      )`,
    ),
    uniqueIndex("libraries_personal_user_unique_idx")
      .on(table.userId)
      .where(sql`${table.kind} = 'personal'`),
    uniqueIndex("libraries_organization_unique_idx")
      .on(table.organizationId)
      .where(sql`${table.kind} = 'organization'`),
  ],
);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    iconName: text("icon_name"),
    iconColor: text("icon_color"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("folders_library_idx").on(table.libraryId),
    index("folders_library_parent_sort_idx").on(table.libraryId, table.parentId, table.sortOrder),
    uniqueIndex("folders_id_library_unique_idx").on(table.id, table.libraryId),
    uniqueIndex("folders_library_parent_name_unique_idx").on(
      table.libraryId,
      sql`coalesce(${table.parentId}::text, '')`,
      sql`lower(${table.name})`,
    ),
  ],
);

export const favicons = pgTable(
  "favicons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    origin: text("origin").notNull(),
    sourceUrl: text("source_url"),
    contentType: text("content_type"),
    imageBytes: bytea("image_bytes"),
    status: faviconStatus("status").notNull().default("pending"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("favicons_origin_unique_idx").on(table.origin)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    siteName: text("site_name"),
    imageUrl: text("image_url"),
    metadataStatus: metadataStatus("metadata_status").notNull().default("pending"),
    metadataFetchedAt: timestamp("metadata_fetched_at", { withTimezone: true }),
    faviconId: uuid("favicon_id").references(() => favicons.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("saved_items_library_idx").on(table.libraryId),
    index("saved_items_folder_idx").on(table.folderId),
    index("saved_items_library_created_at_id_idx").on(table.libraryId, table.createdAt, table.id),
    uniqueIndex("saved_items_id_library_unique_idx").on(table.id, table.libraryId),
    foreignKey({
      columns: [table.folderId, table.libraryId],
      foreignColumns: [folders.id, folders.libraryId],
      name: "saved_items_folder_library_fk",
    }),
    uniqueIndex("saved_items_library_url_unique_idx").on(table.libraryId, table.url),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("tags_library_idx").on(table.libraryId),
    index("tags_library_sort_idx").on(table.libraryId, table.sortOrder),
    uniqueIndex("tags_id_library_unique_idx").on(table.id, table.libraryId),
    uniqueIndex("tags_library_name_unique_idx").on(table.libraryId, sql`lower(${table.name})`),
  ],
);

export const savedItemTags = pgTable(
  "saved_item_tags",
  {
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    savedItemId: uuid("saved_item_id")
      .notNull()
      .references(() => savedItems.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.savedItemId, table.tagId],
      name: "saved_item_tags_pkey",
    }),
    foreignKey({
      columns: [table.savedItemId, table.libraryId],
      foreignColumns: [savedItems.id, savedItems.libraryId],
      name: "saved_item_tags_saved_item_library_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tagId, table.libraryId],
      foreignColumns: [tags.id, tags.libraryId],
      name: "saved_item_tags_tag_library_fk",
    }).onDelete("cascade"),
  ],
);

export const systemLabels = pgTable(
  "system_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    index("system_labels_library_idx").on(table.libraryId),
    uniqueIndex("system_labels_id_library_unique_idx").on(table.id, table.libraryId),
    uniqueIndex("system_labels_library_key_unique_idx").on(table.libraryId, table.key),
  ],
);

export const savedItemSystemLabels = pgTable(
  "saved_item_system_labels",
  {
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    savedItemId: uuid("saved_item_id")
      .notNull()
      .references(() => savedItems.id, { onDelete: "cascade" }),
    systemLabelId: uuid("system_label_id").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.savedItemId, table.systemLabelId],
      name: "saved_item_system_labels_pkey",
    }),
    foreignKey({
      columns: [table.savedItemId, table.libraryId],
      foreignColumns: [savedItems.id, savedItems.libraryId],
      name: "saved_item_system_labels_saved_item_library_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.systemLabelId, table.libraryId],
      foreignColumns: [systemLabels.id, systemLabels.libraryId],
      name: "saved_item_system_labels_system_label_library_fk",
    }).onDelete("cascade"),
  ],
);

export const integrationAccounts = pgTable(
  "integration_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    providerSurface: providerSurface("provider_surface").notNull(),
    connectedByUserId: uuid("connected_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    externalAccountId: text("external_account_id").notNull(),
    externalAccountName: text("external_account_name").notNull(),
    status: integrationAccountStatus("status").notNull().default("connected"),
    accessToken: text("access_token"),
    lastSyncStartedAt: timestamp("last_sync_started_at", { withTimezone: true }),
    lastSyncFinishedAt: timestamp("last_sync_finished_at", { withTimezone: true }),
    lastSyncStatus: syncRunStatus("last_sync_status"),
    ...timestamps,
  },
  (table) => [
    index("integration_accounts_library_provider_status_idx").on(
      table.libraryId,
      table.provider,
      table.status,
    ),
    uniqueIndex("integration_accounts_active_unique_idx")
      .on(table.libraryId, table.provider, table.providerSurface, table.externalAccountId)
      .where(sql`${table.status} != 'disconnected'`),
  ],
);

export const externalItems = pgTable(
  "external_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    savedItemId: uuid("saved_item_id").notNull(),
    integrationAccountId: uuid("integration_account_id")
      .notNull()
      .references(() => integrationAccounts.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    providerSurface: providerSurface("provider_surface").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url").notNull(),
    presenceStatus: externalItemPresenceStatus("presence_status").notNull().default("present"),
    providerMetadata: jsonb("provider_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    metadataStatus: externalItemMetadataStatus("metadata_status").notNull().default("complete"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    missingSince: timestamp("missing_since", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("external_items_saved_item_idx").on(table.savedItemId),
    index("external_items_library_provider_surface_idx").on(
      table.libraryId,
      table.provider,
      table.providerSurface,
    ),
    uniqueIndex("external_items_provider_external_unique_idx").on(
      table.integrationAccountId,
      table.providerSurface,
      table.externalId,
    ),
    foreignKey({
      columns: [table.savedItemId, table.libraryId],
      foreignColumns: [savedItems.id, savedItems.libraryId],
      name: "external_items_saved_item_library_fk",
    }).onDelete("cascade"),
  ],
);

export const importRules = pgTable(
  "import_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    conditionField: importRuleConditionField("condition_field").notNull(),
    conditionOperator: importRuleConditionOperator("condition_operator").notNull(),
    conditionValue: jsonb("condition_value").$type<string | number | boolean>().notNull(),
    actionType: importRuleActionType("action_type").notNull(),
    actionTargetId: text("action_target_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("import_rules_library_provider_sort_idx").on(
      table.libraryId,
      table.provider,
      table.sortOrder,
    ),
  ],
);

export const providerImportSettings = pgTable(
  "provider_import_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    defaultFolderId: uuid("default_folder_id"),
    defaultTagIds: jsonb("default_tag_ids").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("provider_import_settings_library_provider_unique_idx").on(
      table.libraryId,
      table.provider,
    ),
    foreignKey({
      columns: [table.defaultFolderId, table.libraryId],
      foreignColumns: [folders.id, folders.libraryId],
      name: "provider_import_settings_default_folder_library_fk",
    }).onDelete("set null"),
  ],
);

export const ruleApplications = pgTable(
  "rule_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    savedItemId: uuid("saved_item_id").notNull(),
    externalItemId: uuid("external_item_id")
      .notNull()
      .references(() => externalItems.id, { onDelete: "cascade" }),
    importRuleId: uuid("import_rule_id")
      .notNull()
      .references(() => importRules.id, { onDelete: "cascade" }),
    actionType: importRuleActionType("action_type").notNull(),
    actionTargetId: text("action_target_id").notNull(),
    matchedField: text("matched_field").notNull(),
    matchedValue: jsonb("matched_value").$type<unknown>().notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rule_applications_saved_item_idx").on(table.savedItemId),
    foreignKey({
      columns: [table.savedItemId, table.libraryId],
      foreignColumns: [savedItems.id, savedItems.libraryId],
      name: "rule_applications_saved_item_library_fk",
    }).onDelete("cascade"),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationAccountId: uuid("integration_account_id")
      .notNull()
      .references(() => integrationAccounts.id, { onDelete: "cascade" }),
    status: syncRunStatus("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdCount: integer("created_count").notNull().default(0),
    attachedCount: integer("attached_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    lastError: text("last_error"),
    checkpoint: text("checkpoint"),
    ...timestamps,
  },
  (table) => [
    index("sync_runs_integration_account_idx").on(table.integrationAccountId),
    uniqueIndex("sync_runs_active_unique_idx")
      .on(table.integrationAccountId)
      .where(sql`${table.status} in ('queued', 'running')`),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMemberships),
  libraries: many(libraries),
  createdSavedItems: many(savedItems),
  oauthGrants: many(oauthGrants),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const oauthGrantsRelations = relations(oauthGrants, ({ many, one }) => ({
  user: one(users, {
    fields: [oauthGrants.userId],
    references: [users.id],
  }),
  authorizationCodes: many(oauthAuthorizationCodes),
  accessTokens: many(oauthAccessTokens),
  refreshTokens: many(oauthRefreshTokens),
}));

export const oauthAuthorizationCodesRelations = relations(oauthAuthorizationCodes, ({ one }) => ({
  grant: one(oauthGrants, {
    fields: [oauthAuthorizationCodes.grantId],
    references: [oauthGrants.id],
  }),
}));

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one }) => ({
  grant: one(oauthGrants, {
    fields: [oauthAccessTokens.grantId],
    references: [oauthGrants.id],
  }),
}));

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one }) => ({
  grant: one(oauthGrants, {
    fields: [oauthRefreshTokens.grantId],
    references: [oauthGrants.id],
  }),
  rotatedFrom: one(oauthRefreshTokens, {
    fields: [oauthRefreshTokens.rotatedFromId],
    references: [oauthRefreshTokens.id],
    relationName: "oauthRefreshTokenRotation",
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships),
  libraries: many(libraries),
}));

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  user: one(users, {
    fields: [organizationMemberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
}));

export const librariesRelations = relations(libraries, ({ many, one }) => ({
  user: one(users, {
    fields: [libraries.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [libraries.organizationId],
    references: [organizations.id],
  }),
  folders: many(folders),
  savedItems: many(savedItems),
  tags: many(tags),
  systemLabels: many(systemLabels),
  integrationAccounts: many(integrationAccounts),
  importRules: many(importRules),
  providerImportSettings: many(providerImportSettings),
}));

export const faviconsRelations = relations(favicons, ({ many }) => ({
  savedItems: many(savedItems),
}));

export const foldersRelations = relations(folders, ({ many, one }) => ({
  library: one(libraries, {
    fields: [folders.libraryId],
    references: [libraries.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "folderHierarchy",
  }),
  children: many(folders, {
    relationName: "folderHierarchy",
  }),
  savedItems: many(savedItems),
}));

export const savedItemsRelations = relations(savedItems, ({ many, one }) => ({
  library: one(libraries, {
    fields: [savedItems.libraryId],
    references: [libraries.id],
  }),
  folder: one(folders, {
    fields: [savedItems.folderId],
    references: [folders.id],
  }),
  createdBy: one(users, {
    fields: [savedItems.createdByUserId],
    references: [users.id],
  }),
  favicon: one(favicons, {
    fields: [savedItems.faviconId],
    references: [favicons.id],
  }),
  tags: many(savedItemTags),
  systemLabels: many(savedItemSystemLabels),
  externalItems: many(externalItems),
}));

export const tagsRelations = relations(tags, ({ many, one }) => ({
  library: one(libraries, {
    fields: [tags.libraryId],
    references: [libraries.id],
  }),
  savedItems: many(savedItemTags),
}));

export const savedItemTagsRelations = relations(savedItemTags, ({ one }) => ({
  savedItem: one(savedItems, {
    fields: [savedItemTags.savedItemId],
    references: [savedItems.id],
  }),
  tag: one(tags, {
    fields: [savedItemTags.tagId],
    references: [tags.id],
  }),
}));

export const systemLabelsRelations = relations(systemLabels, ({ many, one }) => ({
  library: one(libraries, {
    fields: [systemLabels.libraryId],
    references: [libraries.id],
  }),
  savedItems: many(savedItemSystemLabels),
}));

export const savedItemSystemLabelsRelations = relations(savedItemSystemLabels, ({ one }) => ({
  savedItem: one(savedItems, {
    fields: [savedItemSystemLabels.savedItemId],
    references: [savedItems.id],
  }),
  systemLabel: one(systemLabels, {
    fields: [savedItemSystemLabels.systemLabelId],
    references: [systemLabels.id],
  }),
}));

export const integrationAccountsRelations = relations(integrationAccounts, ({ many, one }) => ({
  library: one(libraries, {
    fields: [integrationAccounts.libraryId],
    references: [libraries.id],
  }),
  connectedBy: one(users, {
    fields: [integrationAccounts.connectedByUserId],
    references: [users.id],
  }),
  externalItems: many(externalItems),
  syncRuns: many(syncRuns),
}));

export const externalItemsRelations = relations(externalItems, ({ one, many }) => ({
  library: one(libraries, {
    fields: [externalItems.libraryId],
    references: [libraries.id],
  }),
  savedItem: one(savedItems, {
    fields: [externalItems.savedItemId],
    references: [savedItems.id],
  }),
  integrationAccount: one(integrationAccounts, {
    fields: [externalItems.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  ruleApplications: many(ruleApplications),
}));

export const importRulesRelations = relations(importRules, ({ one, many }) => ({
  library: one(libraries, {
    fields: [importRules.libraryId],
    references: [libraries.id],
  }),
  ruleApplications: many(ruleApplications),
}));

export const providerImportSettingsRelations = relations(providerImportSettings, ({ one }) => ({
  library: one(libraries, {
    fields: [providerImportSettings.libraryId],
    references: [libraries.id],
  }),
  defaultFolder: one(folders, {
    fields: [providerImportSettings.defaultFolderId],
    references: [folders.id],
  }),
}));

export const ruleApplicationsRelations = relations(ruleApplications, ({ one }) => ({
  library: one(libraries, {
    fields: [ruleApplications.libraryId],
    references: [libraries.id],
  }),
  savedItem: one(savedItems, {
    fields: [ruleApplications.savedItemId],
    references: [savedItems.id],
  }),
  externalItem: one(externalItems, {
    fields: [ruleApplications.externalItemId],
    references: [externalItems.id],
  }),
  importRule: one(importRules, {
    fields: [ruleApplications.importRuleId],
    references: [importRules.id],
  }),
}));

export const syncRunsRelations = relations(syncRuns, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [syncRuns.integrationAccountId],
    references: [integrationAccounts.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type OauthGrant = typeof oauthGrants.$inferSelect;
export type NewOauthGrant = typeof oauthGrants.$inferInsert;
export type OauthAuthorizationCode = typeof oauthAuthorizationCodes.$inferSelect;
export type NewOauthAuthorizationCode = typeof oauthAuthorizationCodes.$inferInsert;
export type OauthAccessToken = typeof oauthAccessTokens.$inferSelect;
export type NewOauthAccessToken = typeof oauthAccessTokens.$inferInsert;
export type OauthRefreshToken = typeof oauthRefreshTokens.$inferSelect;
export type NewOauthRefreshToken = typeof oauthRefreshTokens.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Favicon = typeof favicons.$inferSelect;
export type NewFavicon = typeof favicons.$inferInsert;
export type SavedItem = typeof savedItems.$inferSelect;
export type NewSavedItem = typeof savedItems.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type SavedItemTag = typeof savedItemTags.$inferSelect;
export type NewSavedItemTag = typeof savedItemTags.$inferInsert;
export type SystemLabel = typeof systemLabels.$inferSelect;
export type NewSystemLabel = typeof systemLabels.$inferInsert;
export type SavedItemSystemLabel = typeof savedItemSystemLabels.$inferSelect;
export type NewSavedItemSystemLabel = typeof savedItemSystemLabels.$inferInsert;
export type IntegrationAccount = typeof integrationAccounts.$inferSelect;
export type NewIntegrationAccount = typeof integrationAccounts.$inferInsert;
export type ExternalItem = typeof externalItems.$inferSelect;
export type NewExternalItem = typeof externalItems.$inferInsert;
export type ImportRule = typeof importRules.$inferSelect;
export type NewImportRule = typeof importRules.$inferInsert;
export type ProviderImportSetting = typeof providerImportSettings.$inferSelect;
export type NewProviderImportSetting = typeof providerImportSettings.$inferInsert;
export type RuleApplication = typeof ruleApplications.$inferSelect;
export type NewRuleApplication = typeof ruleApplications.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;
