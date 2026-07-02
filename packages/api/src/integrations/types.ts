import type {
  ImportRuleActionType,
  ImportRuleConditionField,
  ImportRuleConditionOperator,
  IntegrationAccountItem,
  IntegrationProvider,
  ProviderImportSettingsItem,
  ProviderSurface,
  SyncRunItem,
} from "@shelf/shared";

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  private: boolean;
  archived: boolean;
  owner: {
    login: string;
  };
}

export interface GitHubIdentity {
  id: number;
  login: string;
}

export interface GitHubClient {
  createAuthorizationUrl(input: {
    libraryId: string;
    userId: string;
    redirectUri?: string | null;
  }): string;
  exchangeCode(input: { code: string; state: string }): Promise<{
    accessToken: string;
    externalAccount: GitHubIdentity;
    libraryId: string;
    userId: string;
  }>;
  listStars(
    accessToken: string,
    cursor?: string | null,
  ): Promise<{
    repositories: GitHubRepository[];
    nextCursor: string | null;
  }>;
}

export interface ImportRuleRecord {
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
}

export interface SyncIntegrationAccountInput {
  integrationAccountId: string;
  allowedLibraryIds?: string[];
}

export interface IntegrationSyncResult {
  run: SyncRunItem;
  savedItemIds: string[];
}

export interface CreateOrUpdateIntegrationAccountInput {
  libraryId: string;
  connectedByUserId: string;
  provider: IntegrationProvider;
  providerSurface: ProviderSurface;
  externalAccountId: string;
  externalAccountName: string;
  accessToken: string;
}

export interface ProviderImportSettingsUpdateInput {
  libraryId: string;
  provider: IntegrationProvider;
  defaultFolderId: string | null;
  defaultTagIds: string[];
  allowedLibraryIds: string[];
}

export interface IntegrationsStore {
  listAccounts(input: { allowedLibraryIds: string[] }): Promise<IntegrationAccountItem[]>;
  createOrUpdateAccount(
    input: CreateOrUpdateIntegrationAccountInput,
  ): Promise<IntegrationAccountItem>;
  disconnectAccount(input: {
    integrationAccountId: string;
    allowedLibraryIds: string[];
  }): Promise<IntegrationAccountItem>;
  setAccountEnabled(input: {
    integrationAccountId: string;
    allowedLibraryIds: string[];
    enabled: boolean;
  }): Promise<IntegrationAccountItem>;
  getProviderSettings(input: {
    libraryId: string;
    provider: IntegrationProvider;
    allowedLibraryIds: string[];
  }): Promise<ProviderImportSettingsItem>;
  updateProviderSettings(
    input: ProviderImportSettingsUpdateInput,
  ): Promise<ProviderImportSettingsItem>;
  listImportRules(input: {
    libraryId: string;
    provider: IntegrationProvider;
    allowedLibraryIds: string[];
  }): Promise<ImportRuleRecord[]>;
  createImportRule(
    input: Omit<ImportRuleRecord, "id" | "sortOrder"> & {
      allowedLibraryIds: string[];
    },
  ): Promise<ImportRuleRecord>;
  updateImportRule(
    input: Partial<Omit<ImportRuleRecord, "id" | "libraryId" | "provider" | "sortOrder">> & {
      importRuleId: string;
      allowedLibraryIds: string[];
    },
  ): Promise<ImportRuleRecord>;
  reorderImportRules(input: {
    libraryId: string;
    provider: IntegrationProvider;
    orderedImportRuleIds: string[];
    allowedLibraryIds: string[];
  }): Promise<ImportRuleRecord[]>;
  deleteImportRule(input: {
    importRuleId: string;
    allowedLibraryIds: string[];
  }): Promise<{ deletedImportRuleId: string }>;
  listSyncRuns(input: {
    integrationAccountId: string;
    allowedLibraryIds: string[];
  }): Promise<SyncRunItem[]>;
  listLatestSyncRuns(input: { allowedLibraryIds: string[] }): Promise<SyncRunItem[]>;
  syncGitHubStars(input: SyncIntegrationAccountInput): Promise<IntegrationSyncResult>;
  syncDueGitHubStars(): Promise<IntegrationSyncResult[]>;
}
