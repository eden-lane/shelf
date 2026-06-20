import { describe, expect, test } from "bun:test";
import {
  DEV_INBOX_FOLDER_NAME,
  DEV_ORGANIZATION_ID,
  DEV_ORGANIZATION_INBOX_FOLDER_ID,
  DEV_ORGANIZATION_LIBRARY_ID,
  DEV_ORGANIZATION_LIBRARY_NAME,
  DEV_ORGANIZATION_NAME,
  DEV_ORGANIZATION_SLUG,
  DEV_PERSONAL_INBOX_FOLDER_ID,
  DEV_PERSONAL_LIBRARY_ID,
  DEV_PERSONAL_LIBRARY_NAME,
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

      if (sql.includes("insert into libraries") && values?.[0] === DEV_PERSONAL_LIBRARY_ID) {
        return { rows: [{ id: DEV_PERSONAL_LIBRARY_ID }] };
      }

      if (sql.includes("insert into libraries") && values?.[0] === DEV_ORGANIZATION_LIBRARY_ID) {
        return { rows: [{ id: DEV_ORGANIZATION_LIBRARY_ID }] };
      }

      if (sql.includes("insert into folders") && values?.[0] === DEV_PERSONAL_INBOX_FOLDER_ID) {
        return { rows: [{ id: DEV_PERSONAL_INBOX_FOLDER_ID }] };
      }

      if (
        sql.includes("insert into folders") &&
        values?.[0] === DEV_ORGANIZATION_INBOX_FOLDER_ID
      ) {
        return { rows: [{ id: DEV_ORGANIZATION_INBOX_FOLDER_ID }] };
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
  test("creates a stable dev user, organization, libraries, and inbox folders", async () => {
    const { pool, queries, wasReleased } = createPool();

    const identity = await ensureDevIdentity(pool);

    expect(identity).toEqual({
      userId: DEV_USER_ID,
      organizationId: DEV_ORGANIZATION_ID,
      personalLibraryId: DEV_PERSONAL_LIBRARY_ID,
      organizationLibraryId: DEV_ORGANIZATION_LIBRARY_ID,
      personalInboxFolderId: DEV_PERSONAL_INBOX_FOLDER_ID,
      organizationInboxFolderId: DEV_ORGANIZATION_INBOX_FOLDER_ID,
      personalLibraryName: DEV_PERSONAL_LIBRARY_NAME,
      organizationLibraryName: DEV_ORGANIZATION_LIBRARY_NAME,
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
    expect(queries[4]?.values).toEqual([
      DEV_PERSONAL_LIBRARY_ID,
      DEV_USER_ID,
      DEV_PERSONAL_LIBRARY_NAME
    ]);
    expect(queries[5]?.values).toEqual([
      DEV_ORGANIZATION_LIBRARY_ID,
      DEV_ORGANIZATION_ID,
      DEV_ORGANIZATION_LIBRARY_NAME
    ]);
    expect(queries[6]?.values).toEqual([
      DEV_PERSONAL_INBOX_FOLDER_ID,
      DEV_PERSONAL_LIBRARY_ID,
      DEV_INBOX_FOLDER_NAME
    ]);
    expect(queries[7]?.values).toEqual([
      DEV_ORGANIZATION_INBOX_FOLDER_ID,
      DEV_ORGANIZATION_LIBRARY_ID,
      DEV_INBOX_FOLDER_NAME
    ]);
    expect(wasReleased()).toBe(true);
  });

  test("rolls back and releases the database client when seeding fails", async () => {
    const { pool, queries, wasReleased } = createPool({ failOnOrganizations: true });

    await expect(ensureDevIdentity(pool)).rejects.toThrow("database failed");

    expect(queries.at(-1)?.sql).toBe("rollback");
    expect(wasReleased()).toBe(true);
  });
});
