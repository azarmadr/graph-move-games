use {
    crate::{graph::GraphStore, move_logic::resolve_move, spawn::sample_spawn, types::*},
    serde::{Deserialize, Serialize},
    std::collections::HashMap,
};

#[derive(Serialize, Debug, Deserialize)]
pub struct Engine {
    pub version: u32,
    graph: GraphStore,
    games: HashMap<GameId, GameInstance>,
    next_game_nonce: u64,
}

impl Engine {
    pub fn new() -> Self {
        Self {
            version: 1,
            graph: GraphStore::new(),
            games: HashMap::new(),
            next_game_nonce: 1,
        }
    }

    /// Create a new game instance with a single starting tile at (0,0).
    /// The source node and current node are the same board state.
    pub fn create_game(&mut self, config: &GameConfig) -> Result<GameState, String> {
        let game_id = GameId::from_nonce(self.next_game_nonce);
        self.next_game_nonce += 1;

        let rows = config.rows;
        let cols = config.cols;

        let start_board = Board::with_tiles(rows, cols, vec![Cell::new(0, 0, 2)]);
        self.create_game_with_board_inner(game_id, start_board, config.clone())
    }

    /// Create a game instance with a custom board. Useful for testing edge cases
    /// such as game-over states.
    pub fn _create_game_with_board(&mut self, board: Board) -> Result<GameState, String> {
        let game_id = GameId::from_nonce(self.next_game_nonce);
        self.next_game_nonce += 1;
        let (rows, cols) = board.dim;
        self.create_game_with_board_inner(
            game_id,
            board,
            GameConfig {
                rows,
                cols,
                spawn_config: SpawnConfig::default(),
            },
        )
    }

    fn create_game_with_board_inner(
        &mut self,
        game_id: GameId,
        board: Board,
        config: GameConfig,
    ) -> Result<GameState, String> {
        let (start_board_id, _) = self.graph.get_or_create_node(board.clone());
        let is_terminated = !has_any_valid_move_helper(&board);

        let game = GameInstance {
            id: game_id,
            source_board_id: start_board_id,
            current_board_id: start_board_id,
            score: 0,
            is_terminated,
            config,
        };

        self.games.insert(game_id, game.clone());

        Ok(GameState {
            game,
            active_board: board,
            graph: self.graph.graph_data(),
        })
    }

    /// Apply a move to a game instance.
    ///
    /// model.md transition logic:
    /// current -> merged -> spawned (two edges: Move, then Spawn).
    pub fn make_move(&mut self, req: MoveRequest) -> Result<MoveResponse, String> {
        let mut game = self
            .games
            .get_mut(&req.game_id)
            .cloned()
            .ok_or_else(|| format!("game {} not found", req.game_id))?;

        let current_board = self
            .graph
            .get_node(game.current_board_id)
            .cloned()
            .ok_or_else(|| format!("current board {} not found", game.current_board_id))?;

        // Case 1: already terminated
        if game.is_terminated {
            return Ok(MoveResponse {
                game_state: self.build_state(game.clone()),
                delta: GraphDelta::empty(true, game.current_board_id),
            });
        }

        // Case 2/3: resolve merge
        let (merged_board, merge_score, valid) = resolve_move(&current_board, req.direction);
        if !valid {
            return Ok(MoveResponse {
                game_state: self.build_state(game.clone()),
                delta: GraphDelta::empty(false, game.current_board_id),
            });
        }

        // Step 3: merged node
        let (merge_board_id, merge_created) = self.graph.get_or_create_node(merged_board.clone());

        // Step 4/5: spawn
        let spawn_cells = sample_spawn(&merged_board, &game.config.spawn_config)?;
        let spawned_board = spawn_cells.iter().fold(merged_board.clone(), |b, cell| {
            b.set(cell.pos.r, cell.pos.c, cell.tile)
        });
        let (spawn_board_id, spawn_created) = self.graph.get_or_create_node(spawned_board.clone());

        // Step 7: termination check
        let is_terminated = !has_any_valid_move_helper(&spawned_board);

        // Step 8: update game instance
        game.score += merge_score as u64;

        // Step 9: build delta
        let mut delta_nodes = Vec::new();
        if merge_created {
            if let Some(node) = self.graph.node_data(merge_board_id) {
                delta_nodes.push(node);
            }
        }
        if spawn_created {
            if let Some(node) = self.graph.node_data(spawn_board_id) {
                delta_nodes.push(node);
            }
        }

        let move_edge = Edge::Move(req.direction);
        let spawn_edge = Edge::Spawn(spawn_cells);
        let (move_edge_id, move_edge_created) =
            self.graph
                .insert_edge(game.current_board_id, merge_board_id, move_edge);
        let (spawn_edge_id, spawn_edge_created) =
            self.graph
                .insert_edge(merge_board_id, spawn_board_id, spawn_edge);

        game.current_board_id = spawn_board_id;
        game.is_terminated = is_terminated;
        self.games.insert(req.game_id, game.clone());
        let graph = self.graph.graph_data();
        let mut delta_edges = Vec::new();
        if move_edge_created {
            if let Some(edge) = graph.edges.get(&move_edge_id) {
                delta_edges.push(edge.clone());
            }
        }
        if spawn_edge_created {
            if let Some(edge) = graph.edges.get(&spawn_edge_id) {
                delta_edges.push(edge.clone());
            }
        }
        let delta = GraphDelta {
            is_terminated,
            nodes: delta_nodes,
            edges: delta_edges,
            current_board_id: spawn_board_id,
            score_delta: merge_score as u64,
        };

        Ok(MoveResponse {
            game_state: self.build_state(game),
            delta,
        })
    }

    pub fn get_state(&self, game_id: GameId) -> Result<GameState, String> {
        let game = self
            .games
            .get(&game_id)
            .ok_or_else(|| format!("game {} not found", game_id))?;
        Ok(self.build_state(game.clone()))
    }

    pub fn all_game_states(&self) -> Vec<GameState> {
        self.games
            .values()
            .map(|g| self.build_state(g.clone()))
            .collect()
    }

    pub fn import(&mut self, data: Self) -> ImportResult {
        self.graph = data.graph;
        self.graph.rebuild_indexes();
        self.games.clear();
        for (_game_id, game) in data.games {
            self.games.insert(game.id, game);
        }
        self.next_game_nonce = data.next_game_nonce;
        ImportResult {
            success: true,
            games: self.all_game_states(),
        }
    }

    fn build_state(&self, game: GameInstance) -> GameState {
        let board = self
            .graph
            .get_node(game.current_board_id)
            .cloned()
            .unwrap_or_else(Board::empty);
        GameState {
            game,
            active_board: board,
            graph: self.graph.graph_data(),
        }
    }
}

/// Check if any direction produces a valid move from this board.
fn has_any_valid_move_helper(board: &Board) -> bool {
    use Direction::*;
    for dir in [Up, Down, Left, Right] {
        let (_, _, valid) = resolve_move(board, dir);
        if valid {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_game_initial_state() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        assert_eq!(state.graph.nodes.len(), 1);
        assert_eq!(state.graph.edges.len(), 0);
        assert_eq!(state.game.source_board_id, state.game.current_board_id);
        assert_eq!(state.game.score, 0);
        assert!(!state.game.is_terminated);
    }

    #[test]
    fn test_valid_move_creates_two_nodes_and_two_edges() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let current_id = state.game.current_board_id;

        // Board: single tile at (0,0). Move Left is invalid (no change).
        // Move Right is also invalid in this case because the tile is at the right edge? Wait, (0,0) is left edge. Move Right shifts to (0,1). Valid.
        let resp = engine
            .make_move(MoveRequest {
                game_id: state.game.id,
                direction: Direction::Right,
            })
            .unwrap();

        let new_state = resp.game_state;
        let new_current = new_state.game.current_board_id;
        assert_ne!(new_current, current_id);
        assert_eq!(new_state.graph.nodes.len(), 3); // start, merged, spawned
        assert_eq!(new_state.graph.edges.len(), 2); // move and spawn
        assert_eq!(new_state.game.score, 0); // no merge yet
        assert!(!new_state.game.is_terminated);

        // Verify edge chain: current -> merge -> spawned
        let move_edge = new_state
            .graph
            .edges
            .values()
            .find(|e| matches!(e.kind, Edge::Move(Direction::Right)))
            .unwrap();
        assert_eq!(move_edge.from, current_id);

        let spawn_edge = new_state
            .graph
            .edges
            .values()
            .find(|e| matches!(e.kind, Edge::Spawn { .. }))
            .unwrap();
        assert_eq!(spawn_edge.from, move_edge.to);
        assert_eq!(spawn_edge.to, new_current);
    }

    #[test]
    fn test_canonical_board_and_edge_deduplication() {
        let mut engine = Engine::new();
        let first = engine.create_game(&GameConfig::default()).unwrap();
        let second = engine.create_game(&GameConfig::default()).unwrap();

        assert_eq!(first.game.source_board_id, second.game.source_board_id);
        assert_eq!(engine.graph.graph.node_count(), 1);

        let first_move = engine
            .make_move(MoveRequest {
                game_id: first.game.id,
                direction: Direction::Right,
            })
            .unwrap();
        let second_move = engine
            .make_move(MoveRequest {
                game_id: second.game.id,
                direction: Direction::Right,
            })
            .unwrap();

        // The deterministic merge step converges, so the Move edge is shared.
        // Spawn outcomes are intentionally random and may diverge.
        assert_eq!(first_move.delta.edges.len(), 2);
        assert!(
            second_move
                .delta
                .edges
                .iter()
                .all(|edge| !matches!(edge.kind, Edge::Move(_)))
        );
        assert_eq!(
            engine
                .graph
                .graph
                .edge_references()
                .filter(|edge| matches!(edge.weight(), Edge::Move(_)))
                .count(),
            1
        );
        assert!(engine.graph.graph.node_count() >= 3);
        assert!(engine.graph.graph.edge_count() >= 3);
    }

    #[test]
    fn test_invalid_move_no_change() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let current_id = state.game.current_board_id;

        // Move Left from (0,0) is invalid because the tile is already at the left edge.
        let resp = engine
            .make_move(MoveRequest {
                game_id: state.game.id,
                direction: Direction::Left,
            })
            .unwrap();

        assert_eq!(resp.game_state.game.current_board_id, current_id);
        assert_eq!(resp.delta.nodes.len(), 0);
        assert_eq!(resp.delta.edges.len(), 0);
        assert_eq!(resp.delta.score_delta, 0);
    }

    #[test]
    fn test_export_import_roundtrip() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let game_id = state.game.id;

        // Make a move so we have some graph structure
        engine
            .make_move(MoveRequest {
                game_id,
                direction: Direction::Right,
            })
            .unwrap();

        let export = serde_json::to_string(&engine).unwrap();
        let mut engine2 = Engine::new();
        let imported: Engine = serde_json::from_str(&export).unwrap();
        let result = engine2.import(imported);

        assert!(result.success);
        assert_eq!(result.games.len(), 1);
        let imported_state = engine2.get_state(game_id).unwrap();
        assert_eq!(imported_state.game.score, 0);
        assert_eq!(imported_state.graph.nodes.len(), 3);
        assert_eq!(imported_state.graph.edges.len(), 2);
    }

    #[test]
    fn test_game_over_state_3x3() {
        // TODO: move this to board tests. not supposed to test board logic here
        // Full 3x3 board with no adjacent equal tiles and no empty cells.
        // No move can change the board, so the game must be terminated on creation.
        let mut engine = Engine::new();
        let board = Board::with_tiles(
            3,
            3,
            vec![
                Cell::new(0, 0, 2),
                Cell::new(0, 1, 4),
                Cell::new(0, 2, 8),
                Cell::new(1, 0, 16),
                Cell::new(1, 1, 32),
                Cell::new(1, 2, 64),
                Cell::new(2, 0, 128),
                Cell::new(2, 1, 256),
                Cell::new(2, 2, 512),
            ],
        );
        let state = engine._create_game_with_board(board).unwrap();

        assert!(
            state.game.is_terminated,
            "game-over board should be terminated"
        );
        assert_eq!(state.graph.nodes.len(), 1);
        assert_eq!(state.graph.edges.len(), 0);
    }

    #[test]
    fn test_moves_on_game_over_board_are_invalid_3x3() {
        // Once a game is terminated, every direction must be rejected with an empty delta.
        let mut engine = Engine::new();
        let board = Board::with_tiles(
            3,
            3,
            vec![
                Cell::new(0, 0, 2),
                Cell::new(0, 1, 4),
                Cell::new(0, 2, 8),
                Cell::new(1, 0, 16),
                Cell::new(1, 1, 32),
                Cell::new(1, 2, 64),
                Cell::new(2, 0, 128),
                Cell::new(2, 1, 256),
                Cell::new(2, 2, 512),
            ],
        );
        let state = engine._create_game_with_board(board).unwrap();
        let game_id = state.game.id;
        let initial_node_count = state.graph.nodes.len();
        let initial_edge_count = state.graph.edges.len();
        let initial_score = state.game.score;
        let initial_current = state.game.current_board_id;

        for dir in [
            Direction::Up,
            Direction::Down,
            Direction::Left,
            Direction::Right,
        ] {
            let resp = engine
                .make_move(MoveRequest {
                    game_id,
                    direction: dir,
                })
                .unwrap();
            assert!(
                resp.delta.nodes.is_empty(),
                "{dir:?} created nodes on a terminated game"
            );
            assert!(
                resp.delta.edges.is_empty(),
                "{dir:?} created edges on a terminated game"
            );
            assert_eq!(
                resp.delta.score_delta, 0,
                "{dir:?} changed score on a terminated game"
            );
            assert_eq!(resp.game_state.graph.nodes.len(), initial_node_count);
            assert_eq!(resp.game_state.graph.edges.len(), initial_edge_count);
            assert_eq!(resp.game_state.game.score, initial_score);
            assert_eq!(resp.game_state.game.current_board_id, initial_current);
            assert!(resp.game_state.game.is_terminated);
        }
    }

    #[test]
    fn test_game_terminates_after_spawn_3x3() {
        // One empty cell at (2,2). The only valid move slides into it (Right or Down),
        // then the deterministic spawn fills the new empty cell. After the spawn the board
        // is full with no adjacent equal tiles, so the game should be marked terminated.
        let mut engine = Engine::new();
        let board = Board::with_tiles(
            3,
            3,
            vec![
                Cell::new(0, 0, 2),
                Cell::new(0, 1, 4),
                Cell::new(0, 2, 8),
                Cell::new(1, 0, 16),
                Cell::new(1, 1, 32),
                Cell::new(1, 2, 64),
                Cell::new(2, 0, 128),
                Cell::new(2, 1, 256),
            ],
        );
        let state = engine._create_game_with_board(board).unwrap();
        assert!(
            !state.game.is_terminated,
            "pre-move board should not be terminated"
        );

        let resp = engine
            .make_move(MoveRequest {
                game_id: state.game.id,
                direction: Direction::Right,
            })
            .unwrap();

        assert!(
            resp.game_state.game.is_terminated,
            "spawned board should be game-over"
        );
        assert!(
            !resp.delta.nodes.is_empty(),
            "valid move should create nodes"
        );
        assert_eq!(
            resp.delta.edges.len(),
            2,
            "valid move should create one move + one spawn edge"
        );
    }
}
