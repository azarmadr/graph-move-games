## MODIFIED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance of the requested mode and tile rule with custom board dimensions and spawn configuration.

#### Scenario: Creating a game with a config
- **WHEN** createGameWithConfig(config) is called with {rows, cols, mode, rule, spawn_config}
- **THEN** the engine creates a game of the requested mode and rule whose boards start empty and resolves the opening spawn as its first action
- **THEN** the engine returns GameState as a JSON string over the WASM bridge

#### Scenario: The mode and rule default to single-player 2048
- **WHEN** createGameWithConfig is called without a mode or rule field
- **THEN** the engine creates a single-player game with `Rule::EqualTiles`

#### Scenario: Opening spawn values follow the configured weights
- **WHEN** a game with `Rule::EqualTiles` is created with a spawn_config weighting several tile values
- **THEN** the opening spawn's tile values are drawn according to those weights

#### Scenario: Creating a Threes game
- **WHEN** createGameWithConfig is called with mode = "threes" and rule = "threes"
- **THEN** the engine creates a Threes game with a deck, an entry rule, and boards carrying `Rule::Threes`
- **THEN** the opening card is drawn from the deck

#### Scenario: Mixing a mode and a rule
- **WHEN** createGameWithConfig is called with mode = "single" and rule = "threes"
- **THEN** the engine creates a single-player game whose boards carry `Rule::Threes`

### Requirement: make_move

The system SHALL apply a swipe to a game instance and drive every obligation that becomes due and can be resolved without external input.

#### Scenario: A valid swipe
- **WHEN** makeMove(gameId, direction) is called with a valid gameId string and a direction ("Up"|"Down"|"Left"|"Right") that changes the board
- **THEN** the engine resolves the swipe (slide and merge), creates the resulting board node, creates a Swipe edge in the DAG, and applies the board's reported score change
- **THEN** the engine resolves every obligation that is now due and held by an automated agent — placements included — so the returned state is as far along as the agents can drive it
- **THEN** the engine returns the resulting GameState as a JSON string over the WASM bridge

#### Scenario: A human-held obligation is left pending
- **WHEN** the next due obligation is held by a human seat
- **THEN** the engine returns the state with that seat reported as pending
- **THEN** no placement is made on that seat's behalf

#### Scenario: An invalid swipe
- **WHEN** makeMove is called with a direction that would not change the board
- **THEN** no node and no edge are created
- **THEN** the game's score, current_board_id, and is_terminated are unchanged

### Requirement: export_graph

The system SHALL export the entire engine state — graph, games, and the state of every mode and agent — as JSON for persistence or import.

#### Scenario: Exporting engine state
- **WHEN** exportGraph() is called
- **THEN** the engine serializes its version, graph, games, next_game_nonce, and the mode and agent state of every game as a JSON string and returns it to JS

### Requirement: import_graph

The system SHALL replace the current engine state with imported engine data, rejecting payloads written by an incompatible engine version.

#### Scenario: Importing a compatible payload
- **WHEN** importGraph(jsonText) is called with a valid Engine JSON string carrying a supported version
- **THEN** the engine deserializes the JSON, replaces the graph, games and mode state, rebuilds the indexes, and returns an ImportResult with success=true and a list of game states

#### Scenario: Importing an incompatible payload
- **WHEN** importGraph is called with a JSON string carrying an unsupported engine version
- **THEN** the engine rejects the import
- **THEN** the existing engine state is left unchanged

#### Scenario: Importing a malformed payload
- **WHEN** importGraph is called with a string that does not deserialize as engine state
- **THEN** the engine rejects the import
- **THEN** the existing engine state is left unchanged

## ADDED Requirements

### Requirement: apply_spawn

The system SHALL place a spawn on a game instance on behalf of the human-held seat that owes it, admitting only placements the mode's candidate set allows.

#### Scenario: Placing a spawn
- **WHEN** applySpawn(gameId, placements) is called with positions that the mode's candidate set admits for the pending seat
- **THEN** the engine sets exactly those cells on the resulting board, creates the resulting board node, creates a Spawn edge in the DAG, updates current_board_id and is_terminated, and returns the new GameState as a JSON string over the WASM bridge
- **THEN** the game's score is unchanged

#### Scenario: A placement outside the candidate set is rejected
- **WHEN** applySpawn is called with a position the mode's candidate set does not admit
- **THEN** the call is rejected
- **THEN** no node and no edge are created

#### Scenario: A spawn on a full board is rejected
- **WHEN** applySpawn is called with a game whose board has no empty positions
- **THEN** the call is rejected
- **THEN** no node and no edge are created
