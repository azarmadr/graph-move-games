use {
    crate::{graph::GraphStore, types::*},
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
        let is_terminated = board.valid_moves().is_empty();

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
        })
    }

    /// Apply a move to a game instance.
    ///
    /// model.md transition logic:
    /// current -> merged -> spawned (two edges: Move, then Spawn).
    pub fn make_move(
        &mut self,
        game_id: GameId,
        direction: Direction,
    ) -> Result<GameState, String> {
        let mut game = self
            .games
            .get_mut(&game_id)
            .cloned()
            .ok_or_else(|| format!("game {} not found", game_id))?;

        let mut current_board = self
            .graph
            .get_node(game.current_board_id)
            .cloned()
            .ok_or_else(|| format!("current board {} not found", game.current_board_id))?;

        // Case 1: already terminated
        if game.is_terminated {
            return Ok(self.build_state(game));
        }

        // Case 2/3: resolve merge
        let Some(merge_score) = current_board.resolve_move(direction) else {
            return Ok(self.build_state(game));
        };

        // Step 3: merged node
        let (merge_board_id, _) = self.graph.get_or_create_node(current_board.clone());

        // Step 4/5: spawn
        let spawn_cells = current_board.sample_spawn(&game.config.spawn_config)?;
        let spawned_board = spawn_cells.iter().fold(current_board.clone(), |b, cell| {
            b.set(cell.pos.r, cell.pos.c, cell.tile)
        });
        let (spawn_board_id, _) = self.graph.get_or_create_node(spawned_board.clone());

        // Step 6: edges
        self.graph
            .insert_edge(game.current_board_id, merge_board_id, Edge::Move(direction));
        self.graph
            .insert_edge(merge_board_id, spawn_board_id, Edge::Spawn(spawn_cells));

        // Step 7: termination check on the spawned board
        let is_terminated = spawned_board.valid_moves().is_empty();

        // Step 8: update game instance
        game.score += merge_score as u64;
        game.current_board_id = spawn_board_id;
        game.is_terminated = is_terminated;
        self.games.insert(game_id, game.clone());

        Ok(self.build_state(game))
    }

    /// Snapshot of the canonical graph, for the visualization tab.
    pub fn get_graph(&self) -> GraphData {
        self.graph.graph_data()
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
            .unwrap_or_else(|| Board::with_dim(game.config.rows, game.config.cols));
        GameState {
            game,
            active_board: board,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_game_initial_state() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let graph = engine.get_graph();
        assert_eq!(graph.nodes.len(), 1);
        assert_eq!(graph.edges.len(), 0);
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
        let new_state = engine.make_move(state.game.id, Direction::Right).unwrap();
        let graph = engine.get_graph();

        let new_current = new_state.game.current_board_id;
        assert_ne!(new_current, current_id);
        assert_eq!(graph.nodes.len(), 3); // start, merged, spawned
        assert_eq!(graph.edges.len(), 2); // move and spawn
        assert_eq!(new_state.game.score, 0); // no merge yet
        assert!(!new_state.game.is_terminated);

        // Verify edge chain: current -> merge -> spawned
        let move_edge = graph
            .edges
            .values()
            .find(|e| matches!(e.kind, Edge::Move(Direction::Right)))
            .unwrap();
        assert_eq!(move_edge.from, current_id);

        let spawn_edge = graph
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

        let first_move = engine.make_move(first.game.id, Direction::Right).unwrap();
        let second_move = engine.make_move(second.game.id, Direction::Right).unwrap();

        // The deterministic merge step converges, so the Move edge is shared.
        // Spawn outcomes are intentionally random and may diverge.
        assert_ne!(
            first_move.game.current_board_id,
            first.game.current_board_id
        );
        assert_ne!(
            second_move.game.current_board_id,
            second.game.current_board_id
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
        let resp = engine.make_move(state.game.id, Direction::Left).unwrap();

        assert_eq!(resp.game.current_board_id, current_id);
        assert_eq!(engine.get_graph().nodes.len(), 1);
        assert_eq!(engine.get_graph().edges.len(), 0);
        assert_eq!(resp.game.score, 0);
    }

    #[test]
    fn test_export_import_roundtrip() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let game_id = state.game.id;

        // Make a move so we have some graph structure
        engine.make_move(game_id, Direction::Right).unwrap();

        let export = serde_json::to_string(&engine).unwrap();
        let mut engine2 = Engine::new();
        let imported: Engine = serde_json::from_str(&export).unwrap();
        let result = engine2.import(imported);

        assert!(result.success);
        assert_eq!(result.games.len(), 1);
        let imported_state = engine2.get_state(game_id).unwrap();
        assert_eq!(imported_state.game.score, 0);
        assert_eq!(engine2.get_graph().nodes.len(), 3);
        assert_eq!(engine2.get_graph().edges.len(), 2);
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
        assert_eq!(engine.get_graph().nodes.len(), 1);
        assert_eq!(engine.get_graph().edges.len(), 0);
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
        let initial_node_count = engine.get_graph().nodes.len();
        let initial_edge_count = engine.get_graph().edges.len();
        let initial_score = state.game.score;
        let initial_current = state.game.current_board_id;

        for dir in [
            Direction::Up,
            Direction::Down,
            Direction::Left,
            Direction::Right,
        ] {
            let resp = engine.make_move(game_id, dir).unwrap();
            assert_eq!(
                engine.get_graph().nodes.len(),
                initial_node_count,
                "{dir:?} created nodes on a terminated game"
            );
            assert_eq!(
                engine.get_graph().edges.len(),
                initial_edge_count,
                "{dir:?} created edges on a terminated game"
            );
            assert_eq!(
                resp.game.score, initial_score,
                "{dir:?} changed score on a terminated game"
            );
            assert_eq!(resp.game.current_board_id, initial_current);
            assert!(resp.game.is_terminated);
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

        let resp = engine.make_move(state.game.id, Direction::Right).unwrap();

        assert!(resp.game.is_terminated, "spawned board should be game-over");
        assert!(
            engine.get_graph().nodes.len() >= 3,
            "valid move should create nodes"
        );
        assert_eq!(
            engine.get_graph().edges.len(),
            2,
            "valid move should create one move + one spawn edge"
        );
    }
}
