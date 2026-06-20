import type { CurrentUserResponse } from "@bookmarks/shared";

export interface CurrentIdentity {
  user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    billingCustomerId: string | null;
    locale: string | null;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "member";
  }>;
  libraries: Array<{
    id: string;
    kind: "personal" | "organization";
    name: string;
    organizationId?: string;
    organizationSlug?: string;
  }>;
}

export const getCurrentUserResponse = (currentUser: CurrentIdentity): CurrentUserResponse => ({
  user: {
    id: currentUser.user.id,
    email: currentUser.user.email,
    emailVerifiedAt: currentUser.user.emailVerifiedAt?.toISOString() ?? null,
    name: currentUser.user.name,
    username: currentUser.user.username,
    avatarUrl: currentUser.user.avatarUrl,
    billingCustomerId: currentUser.user.billingCustomerId,
    locale: currentUser.user.locale
  },
  organizations: currentUser.organizations,
  libraries: currentUser.libraries
});
