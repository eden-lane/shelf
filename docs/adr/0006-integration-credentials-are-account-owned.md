# Integration credentials are account-owned

Integration credentials belong to the integration account connected by a specific Shelf user, while imported saved items, provider rules, and default import destinations belong to the library. This lets organization libraries share imported content without treating every member as the owner of every external credential.

## Consequences

Library members can see imported saved items and sync status according to library permissions. Disconnecting or reauthorizing an integration account should be limited to the connecting user and library owners or admins.

Saved items created by an integration import use the Shelf user who connected the integration account as `createdByUserId`. The saved item still belongs to the library; the creator field is provenance, not exclusive ownership.

The same external account can be connected to multiple libraries. Each connection is a separate integration account for that library, and each library can import the same provider records into its own saved items.

If credentials expire or provider access is revoked, the integration account should be marked as needing reconnect. Scheduled sync stops, manual sync is disabled, and saved items, external items, rules, and source attribution remain intact.

Integration enablement is separate from credential health and disconnect. Users can disable an integration account to stop sync while keeping credentials and imported saved items; disconnect removes credentials and requires reconnect before future sync.
