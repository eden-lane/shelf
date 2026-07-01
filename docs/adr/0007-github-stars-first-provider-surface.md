# GitHub Stars is the first provider surface

Shelf will implement GitHub Stars as the first integration provider surface before X bookmarks, Reddit saved posts, or other providers. GitHub Stars already matches the current settings UI direction, maps cleanly to saved item URLs, and offers useful provider metadata for import rules such as language, topics, stars, forks, private, and archived.

## Consequences

The integration framework should stay provider-extensible, but the first vertical slice can be driven by GitHub OAuth, GitHub star sync, provider-surface system labels, and GitHub-specific import rules.

The V1 GitHub rule fields are language, topics, name, stargazers count, forks count, private, and archived. Supported operators are string `is` and `contains`, numeric `>`, `>=`, `<`, `<=`, and `==`, and boolean `is`.
