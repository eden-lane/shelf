# Import rules run on first save

Import rules evaluate external items only when an import creates a new saved item. We chose this over continuous rule enforcement so user curation in Shelf is not unexpectedly changed by later provider metadata updates or by a later integration attaching to an item the user already saved.

## Consequences

Provider metadata can change without re-running import rules. Rule actions should still be idempotent, but sync is not responsible for continuously moving or retagging existing saved items. If external presence is lost and later returns while the saved item still exists, rules do not run; if the saved item was deleted and an import recreates it, rules run for the newly created saved item. When multiple import rules match, all additive actions apply, and move actions are evaluated in rule order so the last matching move wins.

Rule order is user-controlled and persisted. Since order changes move outcomes, the UI must make reordering available rather than treating rules as an unordered list.

Missing provider metadata does not match ordinary rule conditions. Shelf can add explicit existence operators later, but null or unavailable fields should not accidentally satisfy string, number, or boolean comparisons.

Provider metadata enrichment failures do not block saved item creation. If required provider fields are missing at creation time, rules depending on those fields do not match; a later metadata refresh does not retroactively run import rules.

Import rules evaluate provider metadata, not generic saved-item web metadata. Shelf's ordinary saved-item enrichment can update titles, descriptions, favicons, and search content independently of provider rule matching.
