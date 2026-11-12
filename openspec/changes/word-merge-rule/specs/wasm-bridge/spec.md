## MODIFIED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance with custom board dimensions, spawn configuration, and, when the selected rule is vocabulary-backed, a per-match vocabulary.

- **WHEN** createGameWithConfig(config) is called with {rows, cols, spawn_config} for a numeric rule
- **THEN** the Rust engine creates a game with initial board containing a single tile at position (0,0), returns GameState via WASM bridge as JSON string
- **WHEN** createGameWithConfig(config) is called with a vocabulary for a word rule
- **THEN** the engine creates the match vocabulary, assigns deterministic word identifiers, and uses it for every board in that match

#### Scenario: Numeric rule is unchanged
- **WHEN** a game is created with the equal-tiles rule and no vocabulary
- **THEN** it starts exactly as before

#### Scenario: Word rule receives its vocabulary
- **WHEN** a game is created with a word rule and a word list
- **THEN** the returned GameState resolves every tile through that list

### Requirement: export_graph

The system SHALL export the entire engine state (graph + all games) as JSON for persistence or import, including every per-match vocabulary.

- **WHEN** exportGraph() is called
- **THEN** the Rust engine serializes the Engine struct (version, graph, games, next_game_nonce, vocabularies) as JSON string, returns to JS
- **WHEN** the engine holds word matches
- **THEN** each vocabulary is written once, keyed by its identity

#### Scenario: Vocabulary is exported once
- **WHEN** two matches share a vocabulary
- **THEN** the exported payload contains that vocabulary once

### Requirement: import_graph

The system SHALL replace the current engine state with imported graph data, restoring vocabularies before resolving boards and games.

- **WHEN** importGraph(jsonText) is called with valid Engine JSON string
- **THEN** the Rust engine deserializes the JSON, restores vocabularies first, then replaces graph and games, rebuilds indexes, returns ImportResult with success=true and list of game states
- **WHEN** the payload refers to a vocabulary it does not contain
- **THEN** the import fails with a clear error and leaves the current engine state unchanged

#### Scenario: Import restores words before boards
- **WHEN** a word match is imported
- **THEN** every board's tile identifiers resolve against the restored vocabulary

#### Scenario: Missing vocabulary aborts the import
- **WHEN** the payload omits a referenced vocabulary
- **THEN** the import reports the missing identity
- **THEN** the previous engine state remains usable
