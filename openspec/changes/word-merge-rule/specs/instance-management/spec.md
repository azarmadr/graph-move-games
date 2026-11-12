## MODIFIED Requirements

### Requirement: game state restoration

The system SHALL restore a previously saved game state from localStorage, including every per-match vocabulary the saved state refers to.

- **WHEN** connectedCallback loads saved exportData and activeGameId from localStorage
- **THEN** importGraph is called to restore the engine state, including each match vocabulary, before any board or game is resolved
- **THEN** getState is called for the active game, and setStateAndRender restores the UI state
- **WHEN** the restore fails (invalid JSON, missing vocabulary, or import fails)
- **THEN** the error is caught and logged, and a new game is created with the default config

#### Scenario: Restored match resolves its words
- **WHEN** a saved match containing word tiles is restored
- **THEN** every tile identifier resolves to the word it had at save time

#### Scenario: Missing vocabulary is not silently replaced
- **WHEN** a saved payload refers to a vocabulary that is absent from the payload
- **THEN** the restore fails and reports the missing vocabulary
- **THEN** no tile identifier is resolved against a different vocabulary
