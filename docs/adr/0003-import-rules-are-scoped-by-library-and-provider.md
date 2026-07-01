# Import rules are scoped by library and provider

Import rules and the default import destination are configured per library and provider, not per integration account. Multiple GitHub accounts connected to the same library share the same GitHub rule set, while a personal library and an organization library can organize the same provider differently.

## Consequences

Provider-specific rule fields can differ between GitHub, X, Reddit, and future providers. Integration accounts supply credentials and source identity, but they do not own separate rule sets inside the same library.
