import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://shelf:shelf@127.0.0.1:5432/shelf";

const pool = new pg.Pool({
  connectionString: databaseUrl
});

try {
  await migrate(drizzle(pool), {
    migrationsFolder: "packages/api/drizzle",
    migrationsTable: "__drizzle_migrations",
    migrationsSchema: "public"
  });
  console.log("Migrations applied successfully.");
} finally {
  await pool.end();
}
