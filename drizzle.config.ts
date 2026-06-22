import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/api/src/db/schema.ts",
  out: "./packages/api/drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://shelf:shelf@localhost:5432/shelf"
  },
  migrations: {
    schema: "public"
  },
  strict: true
});
