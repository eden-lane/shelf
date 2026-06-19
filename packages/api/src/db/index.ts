import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export const createDatabase = (pool: pg.Pool): Database =>
  drizzle({ client: pool, schema });

export { schema };
