import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { CurrentIdentity } from "../currentUser";
import type { Database } from "../db";
import { schema } from "../db";

export type RegistrationMode = "first-user-only" | "open" | "closed";

export interface RegistrationStatus {
  mode: RegistrationMode;
  available: boolean;
}

export interface AuthSessionResponse {
  user: CurrentIdentity | null;
  registration: RegistrationStatus;
}

export interface SignupInput {
  email: string;
  password: string;
  name?: string | null;
  username?: string | null;
  locale?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
  currentUser: CurrentIdentity;
}

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const PERSONAL_LIBRARY_NAME = "Personal";

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "invalid_credentials"
      | "invalid_input"
      | "registration_closed"
      | "email_taken"
      | "username_taken"
  ) {
    super(code);
  }
}

export const getRegistrationStatus = async (
  db: Database,
  mode: RegistrationMode
): Promise<RegistrationStatus> => {
  if (mode === "open") {
    return { mode, available: true };
  }

  if (mode === "closed") {
    return { mode, available: false };
  }

  const count = await getUserCount(db);

  return { mode, available: count === 0 };
};

export const signup = async (
  db: Database,
  registrationMode: RegistrationMode,
  input: SignupInput
): Promise<CreatedSession> => {
  const registration = await getRegistrationStatus(db, registrationMode);

  if (!registration.available) {
    throw new AuthError("registration_closed");
  }

  const parsed = parseSignupInput(input);
  const passwordHash = await Bun.password.hash(parsed.password, {
    algorithm: "argon2id"
  });

  const userId = await db.transaction(async (tx) => {
    const existingEmail = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${parsed.email.toLowerCase()}`)
      .limit(1);

    if (existingEmail.length > 0) {
      throw new AuthError("email_taken");
    }

    if (parsed.username) {
      const existingUsername = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.username}) = ${parsed.username.toLowerCase()}`)
        .limit(1);

      if (existingUsername.length > 0) {
        throw new AuthError("username_taken");
      }
    }

    const [user] = await tx
      .insert(schema.users)
      .values({
        email: parsed.email,
        locale: parsed.locale,
        name: parsed.name,
        passwordHash,
        username: parsed.username
      })
      .returning({ id: schema.users.id });

    if (!user) {
      throw new Error("Unable to create user");
    }

    await tx.insert(schema.libraries).values({
      kind: "personal",
      name: PERSONAL_LIBRARY_NAME,
      userId: user.id
    });

    return user.id;
  });

  return createSessionForUser(db, userId);
};

export const login = async (db: Database, input: LoginInput): Promise<CreatedSession> => {
  const email = parseEmail(input.email);

  if (!email || typeof input.password !== "string" || !input.password) {
    throw new AuthError("invalid_credentials");
  }

  const [user] = await db
    .select({
      id: schema.users.id,
      passwordHash: schema.users.passwordHash
    })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email.toLowerCase()}`)
    .limit(1);

  if (!user?.passwordHash) {
    throw new AuthError("invalid_credentials");
  }

  const passwordMatches = await Bun.password.verify(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AuthError("invalid_credentials");
  }

  return createSessionForUser(db, user.id);
};

export const createSessionForUser = async (
  db: Database,
  userId: string
): Promise<CreatedSession> => {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(schema.sessions).values({
    expiresAt,
    lastUsedAt: new Date(),
    tokenHash,
    userId
  });

  const currentUser = await loadCurrentIdentity(db, userId);

  if (!currentUser) {
    throw new Error("Unable to load current user");
  }

  return {
    currentUser,
    expiresAt,
    token
  };
};

export const resolveSessionToken = async (
  db: Database,
  token: string | undefined
): Promise<CurrentIdentity | null> => {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const [session] = await db
    .select({
      id: schema.sessions.id,
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
      lastUsedAt: schema.sessions.lastUsedAt
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.tokenHash, tokenHash),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!session) {
    return null;
  }

  const refreshAfter = new Date(now.getTime() - SESSION_REFRESH_AFTER_MS);

  if (!session.lastUsedAt || session.lastUsedAt < refreshAfter) {
    await db
      .update(schema.sessions)
      .set({
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        lastUsedAt: now,
        updatedAt: sql`now()`
      })
      .where(eq(schema.sessions.id, session.id));
  }

  return loadCurrentIdentity(db, session.userId);
};

export const revokeSessionToken = async (
  db: Database,
  token: string | undefined
): Promise<void> => {
  if (!token) {
    return;
  }

  await db
    .update(schema.sessions)
    .set({
      revokedAt: new Date(),
      updatedAt: sql`now()`
    })
    .where(eq(schema.sessions.tokenHash, hashSessionToken(token)));
};

export const loadCurrentIdentity = async (
  db: Database,
  userId: string
): Promise<CurrentIdentity | null> => {
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      name: schema.users.name,
      username: schema.users.username,
      avatarUrl: schema.users.avatarUrl,
      billingCustomerId: schema.users.billingCustomerId,
      locale: schema.users.locale
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const memberships = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      slug: schema.organizations.slug,
      role: schema.organizationMemberships.role
    })
    .from(schema.organizationMemberships)
    .innerJoin(
      schema.organizations,
      eq(schema.organizationMemberships.organizationId, schema.organizations.id)
    )
    .where(eq(schema.organizationMemberships.userId, userId));

  const organizationIds = memberships.map((membership) => membership.id);
  const libraries = await db
    .select({
      id: schema.libraries.id,
      kind: schema.libraries.kind,
      name: schema.libraries.name,
      organizationId: schema.libraries.organizationId
    })
    .from(schema.libraries)
    .where(
      organizationIds.length > 0
        ? or(eq(schema.libraries.userId, userId), inArray(schema.libraries.organizationId, organizationIds))
        : eq(schema.libraries.userId, userId)
    );

  const organizationSlugById = new Map(
    memberships.map((membership) => [membership.id, membership.slug])
  );

  return {
    user,
    organizations: memberships,
    libraries: libraries.map((library) => ({
      id: library.id,
      kind: library.kind,
      name: library.name,
      organizationId: library.organizationId ?? undefined,
      organizationSlug: library.organizationId
        ? organizationSlugById.get(library.organizationId)
        : undefined
    }))
  };
};

const getUserCount = async (db: Database): Promise<number> => {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(schema.users);

  return Number(row?.count ?? 0);
};

const parseSignupInput = (input: SignupInput) => {
  const email = parseEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  if (!email || password.length < 8) {
    throw new AuthError("invalid_input");
  }

  const username = parseOptionalString(input.username);

  if (username && !/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    throw new AuthError("invalid_input");
  }

  return {
    email,
    password,
    locale: parseOptionalString(input.locale),
    name: parseOptionalString(input.name),
    username
  };
};

const parseEmail = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
};

const parseOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url");
