# Imports become saved items

External-service imports become normal Shelf saved items, and provider-native source records are tracked as external items attached to those saved items. This keeps folders, tags, search, deduplication, and rule actions centered on the existing saved-item model while preserving integration-specific identity and metadata for sync and rule matching.

When provider metadata contains useful display fields, Shelf can seed the saved item's initial title and description from that metadata. Generic saved-item enrichment can still fill gaps or update web-derived fields later.

## Considered Options

- Store GitHub stars, X bookmarks, Reddit saved posts, and similar records as separate provider-native objects.
- Normalize every imported link into a saved item and attach one or more external items to it.

## Consequences

The same URL imported from multiple integrations appears once in a library, but it can have multiple external items. Rules evaluate provider-specific external item data during sync, then apply actions to the shared saved item.

Integration source attribution is represented with system labels at the provider-surface level, such as GitHub Stars or Reddit Saved. Account-specific source details stay on external items and saved item details rather than becoming labels. System labels are for browsing and filtering convenience, not import rule inputs.
