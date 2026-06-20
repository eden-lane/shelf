export const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000002";
export const DEV_PERSONAL_LIBRARY_ID = "00000000-0000-4000-8000-000000000003";
export const DEV_ORGANIZATION_LIBRARY_ID = "00000000-0000-4000-8000-000000000004";
export const DEV_PERSONAL_INBOX_FOLDER_ID = "00000000-0000-4000-8000-000000000005";
export const DEV_ORGANIZATION_INBOX_FOLDER_ID = "00000000-0000-4000-8000-000000000006";
export const DEV_USER_EMAIL = "dev@localhost";
export const DEV_USER_NAME = "Dev User";
export const DEV_ORGANIZATION_NAME = "Dev Workspace";
export const DEV_ORGANIZATION_SLUG = "dev";
export const DEV_PERSONAL_LIBRARY_NAME = "Personal";
export const DEV_ORGANIZATION_LIBRARY_NAME = DEV_ORGANIZATION_NAME;
export const DEV_INBOX_FOLDER_NAME = "Inbox";

export interface DevIdentity {
  userId: string;
  organizationId: string;
  personalLibraryId: string;
  organizationLibraryId: string;
  personalInboxFolderId: string;
  organizationInboxFolderId: string;
  personalLibraryName: string;
  organizationLibraryName: string;
  email: string;
  name: string;
  organizationName: string;
  organizationSlug: string;
}

interface QueryRow {
  id: string;
}

interface QueryResult {
  rows: QueryRow[];
}

interface DevIdentityClient {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  release(): void;
}

interface DevIdentityPool {
  connect(): Promise<DevIdentityClient>;
}

export const ensureDevIdentity = async (pool: DevIdentityPool): Promise<DevIdentity> => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const user = await client.query(
      `
        insert into users (id, email, name)
        values ($1, $2, $3)
        on conflict (lower(email)) do update
        set name = excluded.name,
            updated_at = now()
        returning id
      `,
      [DEV_USER_ID, DEV_USER_EMAIL, DEV_USER_NAME]
    );

    const organization = await client.query(
      `
        insert into organizations (id, name, slug)
        values ($1, $2, $3)
        on conflict (lower(slug)) do update
        set name = excluded.name,
            updated_at = now()
        returning id
      `,
      [DEV_ORGANIZATION_ID, DEV_ORGANIZATION_NAME, DEV_ORGANIZATION_SLUG]
    );

    const userId = user.rows[0]?.id;
    const organizationId = organization.rows[0]?.id;

    if (!userId || !organizationId) {
      throw new Error("Unable to resolve dev identity rows");
    }

    await client.query(
      `
        insert into organization_memberships (user_id, organization_id, role)
        values ($1, $2, 'owner')
        on conflict (user_id, organization_id) do update
        set role = excluded.role,
            updated_at = now()
      `,
      [userId, organizationId]
    );

    const personalLibrary = await client.query(
      `
        insert into libraries (id, kind, user_id, name)
        values ($1, 'personal', $2, $3)
        on conflict (id) do update
        set user_id = excluded.user_id,
            organization_id = null,
            name = excluded.name,
            updated_at = now()
        returning id
      `,
      [DEV_PERSONAL_LIBRARY_ID, userId, DEV_PERSONAL_LIBRARY_NAME]
    );

    const organizationLibrary = await client.query(
      `
        insert into libraries (id, kind, organization_id, name)
        values ($1, 'organization', $2, $3)
        on conflict (id) do update
        set user_id = null,
            organization_id = excluded.organization_id,
            name = excluded.name,
            updated_at = now()
        returning id
      `,
      [DEV_ORGANIZATION_LIBRARY_ID, organizationId, DEV_ORGANIZATION_LIBRARY_NAME]
    );

    const personalLibraryId = personalLibrary.rows[0]?.id;
    const organizationLibraryId = organizationLibrary.rows[0]?.id;

    if (!personalLibraryId || !organizationLibraryId) {
      throw new Error("Unable to resolve dev library rows");
    }

    const personalInboxFolder = await client.query(
      `
        insert into folders (id, library_id, name)
        values ($1, $2, $3)
        on conflict (id) do update
        set library_id = excluded.library_id,
            parent_id = null,
            name = excluded.name,
            updated_at = now()
        returning id
      `,
      [DEV_PERSONAL_INBOX_FOLDER_ID, personalLibraryId, DEV_INBOX_FOLDER_NAME]
    );

    const organizationInboxFolder = await client.query(
      `
        insert into folders (id, library_id, name)
        values ($1, $2, $3)
        on conflict (id) do update
        set library_id = excluded.library_id,
            parent_id = null,
            name = excluded.name,
            updated_at = now()
        returning id
      `,
      [DEV_ORGANIZATION_INBOX_FOLDER_ID, organizationLibraryId, DEV_INBOX_FOLDER_NAME]
    );

    const personalInboxFolderId = personalInboxFolder.rows[0]?.id;
    const organizationInboxFolderId = organizationInboxFolder.rows[0]?.id;

    if (!personalInboxFolderId || !organizationInboxFolderId) {
      throw new Error("Unable to resolve dev inbox folder rows");
    }

    await client.query("commit");

    return {
      userId,
      organizationId,
      personalLibraryId,
      organizationLibraryId,
      personalInboxFolderId,
      organizationInboxFolderId,
      personalLibraryName: DEV_PERSONAL_LIBRARY_NAME,
      organizationLibraryName: DEV_ORGANIZATION_LIBRARY_NAME,
      email: DEV_USER_EMAIL,
      name: DEV_USER_NAME,
      organizationName: DEV_ORGANIZATION_NAME,
      organizationSlug: DEV_ORGANIZATION_SLUG
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
