# Shelf

This context describes the saved-link library model for the Shelf product.

## Language

**Library**:
A collection boundary for saved items, folders, tags, and system labels. A library is either personal to one user or owned by one organization.
_Avoid_: Workspace, project

**Saved Item**:
A page or link stored in a library. A saved item belongs to exactly one folder and may have many tags or system labels.
_Avoid_: legacy saved-link naming when discussing the persisted domain object

**Integration**:
A connection between Shelf and an external service that can import links into a library as saved items.
_Avoid_: Importer, connector

**Provider**:
An external service that Shelf can integrate with, such as GitHub, X, or Reddit.
_Avoid_: Service, platform

**Provider Surface**:
The specific set of provider records an integration imports, such as GitHub stars or Reddit saved posts.
_Avoid_: Source filter

**Sync Run**:
A pull operation that reads one provider surface through an integration account and imports discovered external items into Shelf. Sync runs may make partial progress and resume later.
_Avoid_: Import event, migration

**Sync Status**:
The user-visible state and summary of a sync run, including lifecycle state, timing, item counts, and the last error when a sync fails.
_Avoid_: Worker log

**Integration Account**:
An external-service account connected to Shelf for a specific library by a specific Shelf user. Integration accounts provide the source identity and credentials used to import saved items.
_Avoid_: Provider account, connected account

**Credential Health**:
The ability of an integration account's stored credentials to authenticate provider sync. Unhealthy credentials stop sync until the account is reconnected.
_Avoid_: Sync status

**Integration Enablement**:
Whether an integration account is allowed to sync. Disabled integration accounts keep credentials and imported saved items but do not run sync until re-enabled.
_Avoid_: Credential health, disconnect

**External Item**:
A provider-native record discovered through an integration account. External items are imported into Shelf as saved items while retaining source-specific identity and metadata; multiple external items can point to the same saved item.
_Avoid_: Imported bookmark, synced object

**External Presence**:
The current provider-side availability of an external item. Losing external presence does not delete the saved item it was attached to.
_Avoid_: Saved item existence

**Import Rule**:
A user-defined rule for a provider within a library that evaluates an external item only when an import creates a new saved item. Import rules do not run when sync attaches or restores an external item on an existing saved item.
_Avoid_: Automation, continuous rule

**Rule Order**:
The user-controlled sequence in which import rules are evaluated. Rule order matters when multiple matching rules move a newly created saved item because the last matching move wins.
_Avoid_: Priority

**Rule Application**:
A record of an import rule matching a newly created saved item and the action Shelf applied. Rule applications explain import-time organization even after provider metadata changes.
_Avoid_: Rule history, audit log

**Rule Reapply**:
A deliberate bulk operation that evaluates current import rules against existing saved items from a provider. Rule reapply is separate from editing rules and requires explicit user intent.
_Avoid_: Automatic migration, continuous rule update

**Default Import Destination**:
The folder where a provider places newly created saved items in a library when matching import rules do not move them elsewhere. The default import destination starts as Inbox.
_Avoid_: Default rule

**Import Event**:
The moment an integration sync discovers an external item that should be represented in Shelf. An import event can create a saved item, attach to an existing saved item, or restore external presence for an existing saved item.
_Avoid_: Sync run, metadata refresh

**Folder**:
A user-managed container inside one library. Folders can be nested, and a saved item belongs to exactly one folder.
_Avoid_: Project, collection

**Tag**:
A user-managed label inside one library. Tags can be applied to many saved items.
_Avoid_: System label

**System Label**:
A generated, read-only label inside one library. Users can view system labels for browsing and filtering convenience, but do not create, edit, delete, or use them as import rule inputs; integration source attribution is represented with provider-surface system labels.
_Avoid_: Tag

**Organization**:
A collaboration boundary with members who can access the organization's library.
_Avoid_: Workspace
