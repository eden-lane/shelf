import type { CurrentUserResponse } from "@bookmarks/shared";
import type { DevIdentity } from "../identity";

export const getCurrentUserResponse = (currentUser: DevIdentity): CurrentUserResponse => ({
  user: {
    id: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name
  },
  organization: {
    id: currentUser.organizationId,
    name: currentUser.organizationName,
    slug: currentUser.organizationSlug,
    role: "owner"
  },
  libraries: [
    {
      id: currentUser.personalLibraryId,
      kind: "personal",
      name: currentUser.personalLibraryName,
      inboxFolderId: currentUser.personalInboxFolderId
    },
    {
      id: currentUser.organizationLibraryId,
      kind: "organization",
      name: currentUser.organizationLibraryName,
      inboxFolderId: currentUser.organizationInboxFolderId,
      organizationId: currentUser.organizationId,
      organizationSlug: currentUser.organizationSlug
    }
  ]
});
