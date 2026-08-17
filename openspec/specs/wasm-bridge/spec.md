## Purpose

Defines the typed JSON serialization layer between JavaScript and Rust/WASM that bridges the game state, graph data, and engine operations. All data crosses the boundary as JSON strings serialized via serde/serde_json and deserialized on the receiving side.

## ADDED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance with custom board dimensions and spawn configuration.

- **WHEN** createGameWithConfig(config) is called with {rows, cols, spawn_config}
- **THEN** the Rust engine creates a game with initial board containing a single tile (value 2) at position (0,0), returns GameState via WASM bridge as JSON string

### Requirement: make_move

The system SHALL apply a move direction to a game instance, resolving merges and spawning new tiles.

- **WHEN** makeMove(gameId, direction) is called with valid gameId string and direction ("Up"|"Down"|"Left"|"Right")
- **THEN** the Rust engine resolves the move (slide+merge), creates merged board node, spawns new tile(s), creates Move and Spawn edges in the DAG, updates game state (score, current_board_id, is_terminated), returns new GameState via WASM bridge as JSON string

### Requirement: get_graph

The system SHALL return the full canonical graph as GraphData (nodes: HashMap<BoardId, Board>, edges: HashMap<EdgeId, GraphEdge>).

- **WHEN** getGraph() is called
- **THEN** the Rust engine serializes the engine's GraphData (all boards and edges) as JSON string, returns to JS parsed as GraphData

### Requirement: export_graph

The system SHALL export the entire engine state (graph + all games) as JSON for persistence or import.

- **WHEN** exportGraph() is called
- **THEN** the Rust engine serializes the Engine struct (version, graph, games, next_game_nonce) as JSON string, returns to JS

### Requirement: import_graph

The system SHALL replace the current engine state with imported graph data.

- **WHEN** importGraph(jsonText) is called with valid Engine JSON string
- **THEN** the Rust engine deserializes the JSON, replaces graph and games, rebuilds indexes, returns ImportResult with success=true and list of game states