# Import provider surfaces without prefilters

Shelf imports the full provider surface exposed by a connected integration account, such as GitHub stars, then organizes newly created saved items with import rules. We are not adding provider-side prefilters in V1 because they make missing items harder to explain and duplicate organization logic that belongs in import rules.

## Consequences

Provider-specific filters can be added later if API limits, volume, or cost require them. Until then, a connected account should import everything from its chosen provider surface and rely on rules, tags, folders, and search for organization.

V1 sync is pull-only. Shelf reads external provider state but does not push folder, tag, delete, or unsave actions back to providers. Enabled integration accounts support both manual "sync now" and conservative periodic background sync.

Sync runs keep partial progress. Item imports are idempotent, and a failed sync reports failure while preserving saved items and external items that were imported before the failure. Providers that support cursors or checkpoints should resume from the latest durable checkpoint.

Provider metadata enrichment can be incomplete without failing the entire sync run. Shelf should keep the saved item and external item, then refresh provider metadata in a later sync when the provider allows it.

Manual and background sync should expose sync status to users: queued, running, succeeded, or failed; last started and finished times; created, attached, skipped, and failed item counts; and the latest error when available.

Only one sync run can be active for an integration account at a time. The UI should disable "Sync now" while that account has a queued or running sync to avoid duplicate provider work and checkpoint races.
