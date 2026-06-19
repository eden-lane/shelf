import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/api/src/db/schema.ts",
  out: "./packages/api/drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://bookmarks:bookmarks@localhost:5432/bookmarks"
  },
  migrations: {
    schema: "public"
  },
  strict: true
});
