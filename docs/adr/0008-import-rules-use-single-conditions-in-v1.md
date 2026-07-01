# Import rules use single conditions in V1

V1 import rules use one provider-specific condition and one action per rule. The first action set is add tag and move to folder. We are deferring grouped boolean expressions and broader actions so the first integration slice can focus on reliable sync, rule persistence, and import-time organization instead of a full expression builder.

## Consequences

Users can stack multiple rules and use rule order to compose behavior. More complex grouped conditions and additional action types can be added later if real provider usage demands them.
