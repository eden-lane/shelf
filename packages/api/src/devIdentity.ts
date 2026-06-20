export const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000002";
export const DEV_USER_EMAIL = "dev@localhost";
export const DEV_USER_NAME = "Dev User";
export const DEV_ORGANIZATION_NAME = "Dev Workspace";
export const DEV_ORGANIZATION_SLUG = "dev";

export interface DevIdentity {
  userId: string;
  organizationId: string;
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

export const ensureDevIdentity = async (
  pool: DevIdentityPool
): Promise<DevIdentity> => {
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

    await client.query("commit");

    return {
      userId,
      organizationId,
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
