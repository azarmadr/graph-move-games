## MODIFIED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance of the requested mode and spawn variant with custom board dimensions, merge threshold, and spawn configuration.

#### Scenario: Creating a game with a config
- **WHEN** createGameWithConfig(createGame) is called with {config: {mode, rows, cols, players, merge, difficulty}, variant: {...}}
- **THEN** the engine creates a game of the requested mode and variant whose boards start empty and resolves the opening spawn as its first action
- **THEN** the engine returns GameState as a JSON string over the WASM bridge

#### Scenario: The mode and variant default to single-player Classic
- **WHEN** createGameWithConfig is called without a mode, threshold, or variant field
- **THEN** the engine creates a single-player game with the Classic spawn variant under the threshold-2 merge

#### Scenario: Opening spawn values follow the configured weights
- **WHEN** a Classic game is created with weights over several tile values
- **THEN** the opening spawn's tile values are drawn according to those weights

#### Scenario: Creating a Threes game
- **WHEN** createGameWithConfig is called with a Threes variant
- **THEN** the engine creates a game with a deck and boards played under the threshold-3 merge
- **THEN** the opening card is drawn from the deck

#### Scenario: Mixing a mode and a variant
- **WHEN** createGameWithConfig is called with mode = "single" and a Threes variant
- **THEN** the engine creates a single-player game using Threes spawning and threshold-3 merging

#### Scenario: An explicit threshold overrides the variant default
- **WHEN** createGameWithConfig is called with a Classic variant and merge = 4
- **THEN** the engine creates a game under the threshold-4 merge with Classic spawning

### Requirement: make_move

The system SHALL apply a swipe to a game instance and drive every obligation that becomes due and can be resolved without external input.

#### Scenario: A valid swipe
- **WHEN** makeMove(gameId, direction) is called with a valid gameId string and a direction ("Up"|"Down"|"Left"|"Right") that changes the board
- **THEN** the engine applies the swipe under the game's merge threshold, records the resulting board node and Swipe edge in the DAG, and updates the game's last swipe trace
- **THEN** the engine resolves every obligation that is now due and held by an automated agent — placements included — until a human obligation is pending
- **THEN** the engine returns the resulting GameState as a JSON string over the WASM bridge

#### Scenario: The returned score is derived
- **WHEN** a move changes the board
- **THEN** the returned score is computed from the board and its spawn credit by the game's spawn variant
- **THEN** no score delta is stored on the board or the slot

#### Scenario: A human-held obligation is left pending
- **WHEN** the next due obligation is held by a human seat
- **THEN** the engine returns the state with that seat reported as pending
- **THEN** no placement is made on that seat's behalf

#### Scenario: An invalid swipe
- **WHEN** makeMove is called with a direction that would not change the board under the game's threshold
- **THEN** no node and no edge are created
- **THEN** the game's boards, pending seats, and termination state are unchanged

### Requirement: export_graph

The system SHALL export the entire engine state — graph, games, and every piece of live game state — as JSON for persistence or import.

#### Scenario: Exporting engine state
- **WHEN** exportGraph() is called
- **THEN** the engine serializes its version, graph, games, and next_game_nonce as a JSON string and returns it to JS
- **THEN** each game carries its config, spawn variant, deck cursor, spawn credit, agent state, obligations, and last swipe trace
- **THEN** the graph carries each node's merge threshold

### Requirement: import_graph

The system SHALL replace the current engine state with imported engine data, rejecting payloads written by an incompatible engine version.

#### Scenario: Importing a compatible payload
- **WHEN** importGraph(jsonText) is called with a valid Engine JSON string carrying a supported version
- **THEN** the engine deserializes the JSON, replaces the graph and games, and returns an ImportResult with success=true and a list of game states
- **THEN** graph addressing is recomputed from each node's stored merge threshold and board content

#### Scenario: Importing an incompatible payload
- **WHEN** importGraph is called with a JSON string carrying an unsupported engine version
- **THEN** the engine rejects the import before deserializing the graph
- **THEN** the existing engine state is left unchanged

#### Scenario: Importing a malformed payload
- **WHEN** importGraph is called with a string that does not deserialize as engine state
- **THEN** the engine rejects the import
- **THEN** the existing engine state is left unchanged

## ADDED Requirements

### Requirement: candidates

The system SHALL report the choices a pending seat may make next, derived from the boards in the seat's scope and the spawn variant.

#### Scenario: Querying candidates for a swipe seat
- **WHEN** candidates(gameId, seat) is called for a seat that owes a swipe
- **THEN** the reported choices are the valid swipe directions of the board in that seat's scope under the game's threshold

#### Scenario: Querying candidates for a placement seat
- **WHEN** candidates(gameId, seat) is called for a seat that owes a placement
- **THEN** the reported positions are the spawn variant's candidate set for the boards in that seat's scope
- **THEN** a Threes candidate set is restricted to the opposite edge of the target's last swipe, and a Classic candidate set is every empty position

#### Scenario: A seat with no pending obligation reports no candidates
- **WHEN** candidates is called for a seat with no unresolved obligation
- **THEN** the reported choice set is empty

### Requirement: apply_spawn

The system SHALL place a spawn on a game instance on behalf of the human-held seat that owes it, admitting only placements the variant's candidate set allows.

#### Scenario: Placing a spawn
- **WHEN** applySpawn(gameId, seat, cells) is called with positions the variant's candidate set admits for the pending seat
- **THEN** the engine sets exactly those cells on the resulting boards, records the resulting board nodes and Spawn edges in the DAG, updates the board's spawn credit and last swipe state, and returns the new GameState as a JSON string
- **THEN** the reported score is derived from the resulting boards and spawn credit

#### Scenario: A placement outside the candidate set is rejected
- **WHEN** applySpawn is called with a position the variant's candidate set does not admit
- **THEN** the call is rejected
- **THEN** no node and no edge are created

#### Scenario: A spawn on a full board is rejected
- **WHEN** applySpawn is called with a game whose board has no empty positions
- **THEN** the call is rejected
- **THEN** no node and no edge are created

#### Scenario: The deck advances only on a successful Threes spawn
- **WHEN** a Threes spawn is rejected
- **THEN** the deck cursor does not advance
- **THEN** the next successful spawn draws the same card
