# Integrations Implementation Plan

This plan implements provider integrations for Shelf, starting with GitHub Stars. Imports become normal saved items, while provider-native records stay attached as external items for sync, source attribution, and import-rule evaluation.

## Scope

V1 ships one vertical slice:

- GitHub OAuth App connection for GitHub Stars.
- Pull-only manual and scheduled sync.
- Provider-surface system label attribution, starting with `GitHub Stars`.
- Import rules scoped by library and provider.
- Import rules evaluated only when an import creates a new saved item.
- Rule actions: add tag and move to folder.
- Sync status in the integrations UI.

Out of scope for V1:

- X, Reddit, and other providers.
- Two-way provider writes.
- Provider-side prefilters.
- Grouped rule conditions.
- Automatic rule reapply to existing saved items.
- Broad private-repository GitHub scopes by default.

## Domain Model

Use the root glossary in `CONTEXT.md` as source of truth for terminology. The important implementation terms are:

- `Integration`: provider capability connected to Shelf.
- `Provider`: external service, such as GitHub.
- `Provider Surface`: imported provider record set, such as GitHub Stars.
- `Integration Account`: one external account connected to one library by one Shelf user.
- `External Item`: provider-native record attached to a saved item.
- `Import Rule`: library/provider rule evaluated only when import creates a new saved item.
- `Rule Application`: import-time explanation of matched rule actions.
- `Sync Run`: pull operation for one integration account/provider surface.
- `Sync Status`: user-visible run lifecycle, timings, counts, and errors.

## Data Model

Add integration-owned tables in `packages/api/src/db/schema.ts`.

### Integration accounts

`integration_accounts`

- `id`
- `library_id`
- `provider` (`github` initially)
- `provider_surface` (`github_stars` initially)
- `connected_by_user_id`
- `external_account_id`
- `external_account_name`
- `status` (`connected`, `disabled`, `needs_reconnect`, `disconnected`)
- encrypted credential fields or credential reference
- `last_sync_started_at`
- `last_sync_finished_at`
- `last_sync_status`
- timestamps

Recommended constraints:

- Unique active connection per `library_id`, `provider`, `provider_surface`, `external_account_id`.
- Index by `library_id`, `provider`, `status`.

### External items

`external_items`

- `id`
- `library_id`
- `saved_item_id`
- `integration_account_id`
- `provider`
- `provider_surface`
- `external_id`
- `external_url`
- `presence_status` (`present`, `missing`)
- `provider_metadata` JSON
- `metadata_status` (`complete`, `partial`, `failed`)
- `first_seen_at`
- `last_seen_at`
- `missing_since`
- timestamps

Recommended constraints:

- Unique `integration_account_id`, `provider_surface`, `external_id`.
- Index by `saved_item_id`.
- Index by `library_id`, `provider`, `provider_surface`.

### Import rules

`import_rules`

- `id`
- `library_id`
- `provider`
- `sort_order`
- `condition_field`
- `condition_operator`
- `condition_value` JSON/text
- `action_type` (`add_tag`, `move_to_folder`)
- `action_target_id`
- `enabled`
- timestamps

Rules are scoped by library and provider, not integration account. Multiple GitHub accounts in the same library share GitHub rules.

### Provider defaults

`provider_import_settings`

- `id`
- `library_id`
- `provider`
- `default_folder_id` nullable
- timestamps

The default import destination starts as Inbox, represented by `null` folder.

### Rule applications

`rule_applications`

- `id`
- `library_id`
- `saved_item_id`
- `external_item_id`
- `import_rule_id`
- `action_type`
- `action_target_id`
- `matched_field`
- `matched_value` JSON/text
- `applied_at`

This is not a full audit log. It explains why an imported item was organized a certain way at creation time.

### Sync runs

`sync_runs`

- `id`
- `integration_account_id`
- `status` (`queued`, `running`, `succeeded`, `failed`)
- `started_at`
- `finished_at`
- `created_count`
- `attached_count`
- `skipped_count`
- `failed_count`
- `last_error`
- provider checkpoint/cursor
- timestamps

Enforce one queued/running sync per integration account.

## Import Flow

1. User connects GitHub through OAuth App auth.
2. Shelf creates or updates an integration account for the selected library.
3. User configures default import destination and GitHub import rules.
4. User clicks Sync now, or a scheduled background sync starts.
5. Worker fetches GitHub stars from the provider surface.
6. For each starred repository:
   - Build canonical repo URL: `https://github.com/{owner}/{repo}`.
   - Upsert external item by integration account and GitHub repo id.
   - Find or create saved item by `library_id + url`.
   - If saved item already exists, attach/restore external item and do not run rules.
   - If saved item is new, seed title/description from GitHub metadata when available.
   - Apply provider-surface system label `GitHub Stars`.
   - Evaluate GitHub import rules against GitHub metadata.
   - Apply all matching add-tag actions.
   - Apply matching move-to-folder actions in order, with the last matching move winning.
   - Record rule applications.
7. Persist sync status counts and checkpoint.
8. Trigger normal saved-item enrichment/search indexing as today.

## GitHub V1 Details

Auth:

- Use GitHub OAuth App flow.
- Request least-intrusive scopes for public starred repositories and repository metadata.
- Do not request broad private repository scopes by default.
- If credentials expire or access is revoked, mark account as `needs_reconnect`, stop scheduled sync, and disable manual sync until reconnect.

Saved item URL:

- Use canonical GitHub repository URL.
- Do not use repo homepage/docs/package URL as the saved item identity.

Rule fields:

- `language`
- `topics`
- `name`
- `stargazers_count`
- `forks_count`
- `private`
- `archived`

Operators:

- String: `is`, `contains`
- Number: `>`, `>=`, `<`, `<=`, `==`
- Boolean: `is`

Missing metadata:

- Missing/null provider metadata does not match ordinary conditions.
- Metadata enrichment failures do not block saved item creation.
- Later metadata refresh does not retroactively run rules.

## API Surface

Add oRPC methods under a new integrations surface:

- `integrations.list`
- `integrations.connectGithub.start`
- `integrations.connectGithub.callback`
- `integrations.disconnect`
- `integrations.setEnabled`
- `integrations.syncNow`
- `integrations.listSyncRuns`
- `integrations.getProviderSettings`
- `integrations.updateProviderSettings`
- `integrations.listImportRules`
- `integrations.createImportRule`
- `integrations.updateImportRule`
- `integrations.reorderImportRules`
- `integrations.deleteImportRule`

Keep saved item mutations narrow:

- Reuse existing saved-item create/update/move/tag paths where possible.
- Add dedicated integration store methods for external item upsert, source system labels, sync runs, rules, and rule applications.

## Worker Design

Add an integrations sync worker in `apps/server`.

Requirements:

- One active sync run per integration account.
- Manual sync returns existing queued/running run if one exists.
- Background sync skips disabled, disconnected, or `needs_reconnect` accounts.
- Sync is idempotent per external item.
- Partial progress is kept on failure.
- Provider cursors/checkpoints are durable where supported.
- Rate-limit and provider errors update sync status without deleting imported items.

## UI Plan

Replace the current local/mock GitHub settings state in `apps/web/src/features/settings/IntegrationsPanel.tsx` with API-backed state.

V1 UI:

- GitHub card with connect/reconnect/disconnect controls.
- Enable/disable toggle separate from reconnect state.
- Sync now button disabled while sync is queued/running.
- Last sync status, timestamps, counts, and latest error.
- Default destination folder picker.
- Rule list loaded from API.
- Add/edit/delete rule.
- Manual rule reorder.
- Existing tag/folder pickers should save stable IDs, not names.

Source attribution:

- Create/apply provider-surface system label `GitHub Stars`.
- Account-specific source detail can appear later in saved item detail, but should not become a system label.

## Test Plan

API/store tests:

- Integration account lifecycle: connect, disable, needs reconnect, disconnect.
- Same external account connected to multiple libraries.
- Same URL imported from multiple integration accounts produces one saved item per library and multiple external items.
- Existing saved item attachment does not run import rules.
- New saved item import runs rules.
- Multiple add-tag actions apply.
- Multiple move actions apply with last matching move winning.
- Missing metadata does not match.
- Deleted saved item recreated by import runs rules again.
- Disconnect does not delete saved items.

Worker tests:

- Partial sync failure preserves imported items and failed status.
- Concurrent sync prevention.
- Manual sync disabled or returns existing run while active.
- Credential failure marks account as `needs_reconnect`.

Web tests:

- GitHub card loads API-backed state.
- Sync now disabled while queued/running.
- Rule CRUD and reorder persist.
- Default destination persists by folder ID.
- Deleted tag/folder referenced by a rule marks action invalid/skipped until fixed.

## Implementation Phases

1. Schema and store foundations
   - Add migrations and Drizzle schema.
   - Add integration store methods.
   - Add provider-surface system label helper.

2. Import rule engine
   - Implement condition evaluation.
   - Implement action application against new saved items only.
   - Record rule applications.
   - Unit test rule ordering and missing metadata behavior.

3. GitHub OAuth and account lifecycle
   - Add GitHub OAuth start/callback.
   - Store credential data securely.
   - Implement connect, disable, reconnect-needed, and disconnect behavior.

4. GitHub Stars sync
   - Fetch stars.
   - Import canonical repo URLs as saved items.
   - Attach external items.
   - Seed display metadata.
   - Apply source system labels and import rules.
   - Persist sync run status.

5. API-backed integrations UI
   - Replace local GitHub mock state.
   - Add sync status and disabled Sync now behavior.
   - Persist default destination and rules.
   - Add rule reordering.

6. Scheduled background sync
   - Add conservative periodic sync.
   - Skip disabled/unhealthy accounts.
   - Add rate-limit/backoff handling.

7. Hardening
   - Add integration-focused server/app tests.
   - Verify search indexing sees imported saved items and tags.
   - Verify source system labels can be browsed/filtered.
   - Add docs for required GitHub OAuth environment variables.
