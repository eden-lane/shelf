# Shelf

This context describes the saved-link library model for the Shelf product.

## Language

**Library**:
A collection boundary for saved items, folders, tags, and system labels. A library is either personal to one user or owned by one organization.
_Avoid_: Workspace, project

**Saved Item**:
A page or link stored in a library. A saved item belongs to exactly one folder and may have many tags or system labels.
_Avoid_: legacy saved-link naming when discussing the persisted domain object

**Folder**:
A user-managed container inside one library. Folders can be nested, and a saved item belongs to exactly one folder.
_Avoid_: Project, collection

**Tag**:
A user-managed label inside one library. Tags can be applied to many saved items.
_Avoid_: System label

**System Label**:
A generated, read-only label inside one library. Users can view system labels but do not create, edit, or delete them directly.
_Avoid_: Tag

**Organization**:
A collaboration boundary with members who can access the organization's library.
_Avoid_: Workspace
