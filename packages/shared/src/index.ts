export type CoreServiceStatus = "ok" | "error";

export interface HealthResponse {
  status: "ok" | "degraded";
  services: {
    database: CoreServiceStatus;
    queue: CoreServiceStatus;
    search: CoreServiceStatus;
  };
  checkedAt: string;
}

export interface CurrentUserResponse {
  user: {
    id: string;
    email: string;
    emailVerifiedAt: string | null;
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

export interface RegistrationStatus {
  mode: "first-user-only" | "open" | "closed";
  available: boolean;
}

export interface AuthSessionResponse {
  user: CurrentUserResponse | null;
  registration: RegistrationStatus;
}

export interface AuthCredentials {
  email: string;
  password: string;
  name?: string | null;
  username?: string | null;
  locale?: string | null;
}

export interface ConnectedApp {
  id: string;
  clientId: string;
  clientName: string;
  deviceName: string | null;
  platform: string | null;
  browser: string | null;
  scopes: Array<"read:saved_items" | "write:saved_items">;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SavedItemTag {
  id: string;
  name: string;
  color: string | null;
}

export interface SavedItem {
  id: string;
  libraryId: string;
  libraryName?: string | null;
  folderId: string | null;
  folderName: string | null;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  metadataStatus: "pending" | "fetched" | "failed";
  metadataFetchedAt: string | null;
  faviconId: string | null;
  faviconUrl: string | null;
  tags?: SavedItemTag[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedItemLocation {
  id: string;
  libraryId: string;
  folderId: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  id: string;
  libraryId: string;
  parentId: string | null;
  name: string;
  iconName: string | null;
  iconColor: string | null;
  sortOrder: number;
  savedItemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagItem {
  id: string;
  libraryId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  savedItemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedItemsPageResponse {
  items: SavedItem[];
  nextCursor: string | null;
}

export interface CreateSavedItemInput {
  url: string;
  description?: string | null;
  folderId?: string;
  imageUrl?: string | null;
  libraryId?: string;
  siteName?: string | null;
  tagIds?: string[];
  title?: string | null;
}

export interface SavedItemPreviewInput {
  url: string;
}

export interface SavedItemPreviewResponse {
  description: string | null;
  faviconUrl: string | null;
  imageUrl: string | null;
  siteName: string | null;
  title: string | null;
}

export interface DeleteSavedItemInput {
  savedItemId: string;
}

export interface UpdateSavedItemInput {
  savedItemId: string;
  url: string;
  description?: string | null;
  folderId?: string | null;
  tagIds?: string[];
}

export interface MoveSavedItemsInput {
  savedItemIds: string[];
  destinationFolderId?: string | null;
}

export interface AddSavedItemTagInput {
  savedItemId: string;
  tagId: string;
}

export interface ListSavedItemsInput {
  cursor?: string | null;
  folderId?: string | null;
  inbox?: boolean;
  libraryId?: string | null;
  limit?: number;
  tagId?: string | null;
}

export interface SearchSavedItemsInput {
  cursor?: string | null;
  libraryId?: string | null;
  limit?: number;
  query: string;
  scope: "current" | "all";
}

export interface CreateFolderInput {
  libraryId: string;
  parentId?: string | null;
  name: string;
  iconName?: string | null;
  iconColor?: string | null;
}

export interface UpdateFolderInput {
  folderId: string;
  name: string;
  iconName?: string | null;
  iconColor?: string | null;
}

export interface MoveFolderInput {
  folderId: string;
  parentId?: string | null;
  orderedSiblingIds: string[];
}

export interface DeleteFolderInput {
  folderId: string;
  mode: "move" | "delete";
  destinationFolderId?: string | null;
}

export interface CreateTagInput {
  libraryId: string;
  name: string;
  color?: string | null;
}

export interface UpdateTagInput {
  tagId: string;
  name: string;
  color?: string | null;
}

export interface MoveTagInput {
  tagId: string;
  orderedTagIds: string[];
}

export interface DeleteTagInput {
  tagId: string;
}

export type IntegrationProvider = "github";
export type ProviderSurface = "github_stars";
export type IntegrationAccountStatus =
  | "connected"
  | "disabled"
  | "needs_reconnect"
  | "disconnected";
export type SyncRunStatus = "queued" | "running" | "succeeded" | "failed";
export type ImportRuleConditionField =
  | "language"
  | "topics"
  | "name"
  | "stargazers_count"
  | "forks_count"
  | "private"
  | "archived";
export type ImportRuleConditionOperator = "is" | "contains" | ">" | ">=" | "<" | "<=" | "==";
export type ImportRuleActionType = "add_tag" | "move_to_folder";

export interface IntegrationAccountItem {
  id: string;
  libraryId: string;
  provider: IntegrationProvider;
  providerSurface: ProviderSurface;
  externalAccountId: string;
  externalAccountName: string;
  status: IntegrationAccountStatus;
  lastSyncStartedAt: string | null;
  lastSyncFinishedAt: string | null;
  lastSyncStatus: SyncRunStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRunItem {
  id: string;
  integrationAccountId: string;
  status: SyncRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  createdCount: number;
  attachedCount: number;
  skippedCount: number;
  failedCount: number;
  lastError: string | null;
  checkpoint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderImportSettingsItem {
  id: string;
  libraryId: string;
  provider: IntegrationProvider;
  defaultFolderId: string | null;
  defaultTagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportRuleItem {
  id: string;
  libraryId: string;
  provider: IntegrationProvider;
  sortOrder: number;
  conditionField: ImportRuleConditionField;
  conditionOperator: ImportRuleConditionOperator;
  conditionValue: string | number | boolean;
  actionType: ImportRuleActionType;
  actionTargetId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationsListResponse {
  accounts: IntegrationAccountItem[];
  latestSyncRuns: SyncRunItem[];
}

export interface StartGithubConnectionInput {
  libraryId: string;
  redirectUri?: string | null;
}

export interface StartGithubConnectionResponse {
  authorizationUrl: string;
}

export interface CompleteGithubConnectionInput {
  code: string;
  state: string;
}

export interface IntegrationAccountInput {
  integrationAccountId: string;
}

export interface SetIntegrationEnabledInput extends IntegrationAccountInput {
  enabled: boolean;
}

export interface ProviderInput {
  libraryId: string;
  provider: IntegrationProvider;
}

export interface UpdateProviderSettingsInput extends ProviderInput {
  defaultFolderId?: string | null;
  defaultTagIds?: string[];
}

export interface CreateImportRuleInput extends ProviderInput {
  conditionField: ImportRuleConditionField;
  conditionOperator: ImportRuleConditionOperator;
  conditionValue: string | number | boolean;
  actionType: ImportRuleActionType;
  actionTargetId: string;
  enabled?: boolean;
}

export interface UpdateImportRuleInput {
  importRuleId: string;
  conditionField?: ImportRuleConditionField;
  conditionOperator?: ImportRuleConditionOperator;
  conditionValue?: string | number | boolean;
  actionType?: ImportRuleActionType;
  actionTargetId?: string;
  enabled?: boolean;
}

export interface ReorderImportRulesInput {
  libraryId: string;
  provider: IntegrationProvider;
  orderedImportRuleIds: string[];
}

export interface DeleteImportRuleInput {
  importRuleId: string;
}
