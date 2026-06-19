import { relations, sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", ["owner", "member"]);

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

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMemberships)
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships)
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;
