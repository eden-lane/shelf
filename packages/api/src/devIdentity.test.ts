import { describe, expect, test } from "bun:test";
import {
  DEV_ORGANIZATION_ID,
  DEV_ORGANIZATION_NAME,
  DEV_ORGANIZATION_SLUG,
  DEV_USER_EMAIL,
  DEV_USER_ID,
  DEV_USER_NAME,
  ensureDevIdentity
} from "./devIdentity";

const createPool = (options: { failOnOrganizations?: boolean } = {}) => {
  const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  let released = false;

  const client = {
    async query(sql: string, values?: readonly unknown[]) {
      queries.push({ sql, values });

      if (options.failOnOrganizations && sql.includes("insert into organizations")) {
        throw new Error("database failed");
      }

      if (sql.includes("insert into users")) {
        return { rows: [{ id: DEV_USER_ID }] };
      }

      if (sql.includes("insert into organizations")) {
        return { rows: [{ id: DEV_ORGANIZATION_ID }] };
      }

      return { rows: [] };
    },
    release() {
      released = true;
    }
  };

  return {
    pool: {
      async connect() {
        return client;
      }
    },
    queries,
    wasReleased: () => released
  };
};

describe("ensureDevIdentity", () => {
  test("creates a stable dev user and workspace membership", async () => {
    const { pool, queries, wasReleased } = createPool();

    const identity = await ensureDevIdentity(pool);

    expect(identity).toEqual({
      userId: DEV_USER_ID,
      organizationId: DEV_ORGANIZATION_ID,
      email: DEV_USER_EMAIL,
      name: DEV_USER_NAME,
      organizationName: DEV_ORGANIZATION_NAME,
      organizationSlug: DEV_ORGANIZATION_SLUG
    });
    expect(queries[0]?.sql).toBe("begin");
    expect(queries.at(-1)?.sql).toBe("commit");
    expect(queries[1]?.values).toEqual([DEV_USER_ID, DEV_USER_EMAIL, DEV_USER_NAME]);
    expect(queries[2]?.values).toEqual([
      DEV_ORGANIZATION_ID,
      DEV_ORGANIZATION_NAME,
      DEV_ORGANIZATION_SLUG
    ]);
    expect(queries[3]?.values).toEqual([DEV_USER_ID, DEV_ORGANIZATION_ID]);
    expect(wasReleased()).toBe(true);
  });

  test("rolls back and releases the database client when seeding fails", async () => {
    const { pool, queries, wasReleased } = createPool({ failOnOrganizations: true });

    await expect(ensureDevIdentity(pool)).rejects.toThrow("database failed");

    expect(queries.at(-1)?.sql).toBe("rollback");
    expect(wasReleased()).toBe(true);
  });
});
