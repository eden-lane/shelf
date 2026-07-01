# GitHub Stars uses OAuth App auth

The first GitHub Stars integration will use GitHub OAuth App authorization rather than GitHub App installation or personal access tokens. OAuth App auth maps to connecting a user's GitHub account for personal starred repositories, while GitHub Apps are better suited to repository installation workflows and personal access tokens are too manual for normal users.

## Consequences

The V1 GitHub integration should request the minimum scopes needed to read the connected user's starred repositories and repository metadata. It should not request broad private repository scopes by default; private starred repositories can be a later explicit opt-in if GitHub requires intrusive scopes. Credentials are stored on the integration account connected by the Shelf user.
