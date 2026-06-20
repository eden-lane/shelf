import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", ["owner", "member"]);
export const libraryKind = pgEnum("library_kind", ["personal", "organization"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    ...timestamps
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(sql`lower(${table.email})`)]
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps
  },
  (table) => [uniqueIndex("organizations_slug_unique_idx").on(sql`lower(${table.slug})`)]
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
    ...timestamps
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.organizationId],
      name: "organization_memberships_pkey"
    })
  ]
);

export const libraries = pgTable(
  "libraries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: libraryKind("kind").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade"
    }),
    name: text("name").notNull(),
    ...timestamps
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
      )`
    ),
    uniqueIndex("libraries_personal_user_unique_idx")
      .on(table.userId)
      .where(sql`${table.kind} = 'personal'`),
    uniqueIndex("libraries_organization_unique_idx")
      .on(table.organizationId)
      .where(sql`${table.kind} = 'organization'`)
  ]
);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "cascade"
    }),
    name: text("name").notNull(),
    ...timestamps
  },
  (table) => [
    index("folders_library_idx").on(table.libraryId),
    uniqueIndex("folders_id_library_unique_idx").on(table.id, table.libraryId),
    uniqueIndex("folders_library_parent_name_unique_idx").on(
      table.libraryId,
      sql`coalesce(${table.parentId}::text, '')`,
      sql`lower(${table.name})`
    )
  ]
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    ...timestamps
  },
  (table) => [
    index("saved_items_library_idx").on(table.libraryId),
    index("saved_items_folder_idx").on(table.folderId),
    index("saved_items_library_created_at_id_idx").on(
      table.libraryId,
      table.createdAt,
      table.id
    ),
    uniqueIndex("saved_items_id_library_unique_idx").on(table.id, table.libraryId),
    foreignKey({
      columns: [table.folderId, table.libraryId],
      foreignColumns: [folders.id, folders.libraryId],
      name: "saved_items_folder_library_fk"
    }),
    uniqueIndex("saved_items_library_url_unique_idx").on(table.libraryId, table.url)
  ]
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps
  },
  (table) => [
    index("tags_library_idx").on(table.libraryId),
    uniqueIndex("tags_id_library_unique_idx").on(table.id, table.libraryId),
    uniqueIndex("tags_library_name_unique_idx").on(table.libraryId, sql`lower(${table.name})`)
  ]
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
    ...timestamps
  },
  (table) => [
    primaryKey({
      columns: [table.savedItemId, table.tagId],
      name: "saved_item_tags_pkey"
    }),
    foreignKey({
      columns: [table.savedItemId, table.libraryId],
      foreignColumns: [savedItems.id, savedItems.libraryId],
      name: "saved_item_tags_saved_item_library_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tagId, table.libraryId],
      foreignColumns: [tags.id, tags.libraryId],
      name: "saved_item_tags_tag_library_fk"
    }).onDelete("cascade")
  ]
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
    ...timestamps
  },
  (table) => [
    index("system_labels_library_idx").on(table.libraryId),
    uniqueIndex("system_labels_id_library_unique_idx").on(table.id, table.libraryId),
    uniqueIndex("system_labels_library_key_unique_idx").on(table.libraryId, table.key)
  ]
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
    ...timestamps
  },
  (table) => [
    primaryKey({
      columns: [table.savedItemId, table.systemLabelId],
      name: "saved_item_system_labels_pkey"
    }),
    foreignKey({
      columns: [table.savedItemId, table.libraryId],
      foreignColumns: [savedItems.id, savedItems.libraryId],
      name: "saved_item_system_labels_saved_item_library_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.systemLabelId, table.libraryId],
      foreignColumns: [systemLabels.id, systemLabels.libraryId],
      name: "saved_item_system_labels_system_label_library_fk"
    }).onDelete("cascade")
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMemberships),
  libraries: many(libraries),
  createdSavedItems: many(savedItems)
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships),
  libraries: many(libraries)
}));

export const organizationMembershipsRelations = relations(
  organizationMemberships,
  ({ one }) => ({
    user: one(users, {
      fields: [organizationMemberships.userId],
      references: [users.id]
    }),
    organization: one(organizations, {
      fields: [organizationMemberships.organizationId],
      references: [organizations.id]
    })
  })
);

export const librariesRelations = relations(libraries, ({ many, one }) => ({
  user: one(users, {
    fields: [libraries.userId],
    references: [users.id]
  }),
  organization: one(organizations, {
    fields: [libraries.organizationId],
    references: [organizations.id]
  }),
  folders: many(folders),
  savedItems: many(savedItems),
  tags: many(tags),
  systemLabels: many(systemLabels)
}));

export const foldersRelations = relations(folders, ({ many, one }) => ({
  library: one(libraries, {
    fields: [folders.libraryId],
    references: [libraries.id]
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "folderHierarchy"
  }),
  children: many(folders, {
    relationName: "folderHierarchy"
  }),
  savedItems: many(savedItems)
}));

export const savedItemsRelations = relations(savedItems, ({ many, one }) => ({
  library: one(libraries, {
    fields: [savedItems.libraryId],
    references: [libraries.id]
  }),
  folder: one(folders, {
    fields: [savedItems.folderId],
    references: [folders.id]
  }),
  createdBy: one(users, {
    fields: [savedItems.createdByUserId],
    references: [users.id]
  }),
  tags: many(savedItemTags),
  systemLabels: many(savedItemSystemLabels)
}));

export const tagsRelations = relations(tags, ({ many, one }) => ({
  library: one(libraries, {
    fields: [tags.libraryId],
    references: [libraries.id]
  }),
  savedItems: many(savedItemTags)
}));

export const savedItemTagsRelations = relations(savedItemTags, ({ one }) => ({
  savedItem: one(savedItems, {
    fields: [savedItemTags.savedItemId],
    references: [savedItems.id]
  }),
  tag: one(tags, {
    fields: [savedItemTags.tagId],
    references: [tags.id]
  })
}));

export const systemLabelsRelations = relations(systemLabels, ({ many, one }) => ({
  library: one(libraries, {
    fields: [systemLabels.libraryId],
    references: [libraries.id]
  }),
  savedItems: many(savedItemSystemLabels)
}));

export const savedItemSystemLabelsRelations = relations(
  savedItemSystemLabels,
  ({ one }) => ({
    savedItem: one(savedItems, {
      fields: [savedItemSystemLabels.savedItemId],
      references: [savedItems.id]
    }),
    systemLabel: one(systemLabels, {
      fields: [savedItemSystemLabels.systemLabelId],
      references: [systemLabels.id]
    })
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
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
