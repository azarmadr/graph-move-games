use std::collections::HashMap;

use crate::graph::GraphStore;
use crate::move_logic::resolve_move;
use crate::spawn::sample_spawn;
use crate::types::*;

pub struct Engine {
    graph: GraphStore,
    games: HashMap<GameId, GameInstance>,
    next_game_nonce: u64,
}

impl Engine {
    pub fn new() -> Self {
        Self {
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

        let _spawn_config = config.spawn_config.clone().unwrap_or_default();
        let rows = config.rows;
        let cols = config.cols;

        let start_board = Board::with_tiles(rows, cols, vec![Cell::new(0, 0, 2)]);
        self.create_game_with_board_inner(game_id, start_board)
    }

    /// Create a game instance with a custom board. Useful for testing edge cases
    /// such as game-over states.
    #[allow(dead_code)]
    pub fn create_game_with_board(&mut self, board: Board) -> Result<GameState, String> {
        let game_id = GameId::from_nonce(self.next_game_nonce);
        self.next_game_nonce += 1;
        self.create_game_with_board_inner(game_id, board)
    }

    fn create_game_with_board_inner(&mut self, game_id: GameId, board: Board) -> Result<GameState, String> {
        let (start_node, _) = self.graph.get_or_create_node(board.clone());
        let is_terminated = !has_any_valid_move_helper(&board);

        let game = GameInstance {
            game_id,
            source_node_id: start_node.node_id,
            current_node_id: start_node.node_id,
            score: 0,
            is_terminated,
        };

        self.games.insert(game_id, game.clone());

        Ok(GameState {
            active_game_id: game_id,
            game,
            active_board: board,
            graph: self.graph.snapshot(),
        })
    }

    /// Apply a move to a game instance.
    ///
    /// model.md transition logic:
    /// current -> merged -> spawned (two edges: Move, then Spawn).
    pub fn make_move(&mut self, req: MoveRequest) -> Result<MoveResponse, String> {
        let game = self
            .games
            .get(&req.game_id)
            .cloned()
            .ok_or_else(|| format!("game {} not found", req.game_id))?;

        let current_node = self
            .graph
            .get_node(game.current_node_id)
            .ok_or_else(|| format!("current node {} not found", game.current_node_id))?;

        // Case 1: already terminated
        if game.is_terminated {
            return Ok(MoveResponse {
                game_state: self.build_state(game.clone()),
                delta: GraphDelta::empty(true, game.current_node_id),
            });
        }

        // Case 2/3: resolve merge
        let (merged_board, merge_score, valid) = resolve_move(&current_node.board, req.direction);
        if !valid {
            return Ok(MoveResponse {
                game_state: self.build_state(game.clone()),
                delta: GraphDelta::empty(false, game.current_node_id),
            });
        }

        // Step 3: merged node
        let (merge_node, merge_created) = self.graph.get_or_create_node(merged_board.clone());

        // Step 4/5: spawn
        let _spawn_config = SpawnConfig::default(); // TODO: store per-game config
        let spawn_cells = sample_spawn(&merged_board, &_spawn_config);
        let spawned_board = spawn_cells
            .iter()
            .fold(merged_board.clone(), |b, cell| b.set(cell.pos.r, cell.pos.c, cell.tile));
        let (spawn_node, spawn_created) = self.graph.get_or_create_node(spawned_board.clone());

        // Step 7: termination check
        let is_terminated = !has_any_valid_move_helper(&spawned_board);

        // Step 8: update game instance
        let new_score = game.score + merge_score as u64;
        let new_game = GameInstance {
            game_id: req.game_id,
            source_node_id: game.source_node_id,
            current_node_id: spawn_node.node_id,
            score: new_score,
            is_terminated,
        };
        self.games.insert(req.game_id, new_game.clone());

        // Step 9: build delta
        let mut delta_nodes = Vec::new();
        if merge_created {
            delta_nodes.push(merge_node.clone());
        }
        if spawn_created {
            delta_nodes.push(spawn_node.clone());
        }

        let move_edge = self.graph.insert_edge(
            game.current_node_id,
            merge_node.node_id,
            EdgeKind::Move {
                direction: req.direction,
            },
        );
        let spawn_edge = self.graph.insert_edge(
            merge_node.node_id,
            spawn_node.node_id,
            EdgeKind::Spawn {
                cells: spawn_cells,
            },
        );

        let delta = GraphDelta {
            is_terminated,
            nodes: delta_nodes,
            edges: vec![move_edge, spawn_edge],
            current_node_id: spawn_node.node_id,
            score_delta: merge_score as u64,
        };

        Ok(MoveResponse {
            game_state: self.build_state(new_game),
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

    pub fn export(&self) -> ExportData {
        ExportData {
            version: 1,
            graph: self.graph.snapshot(),
            games: self.games.values().cloned().collect(),
            next_game_nonce: self.next_game_nonce,
        }
    }

    pub fn import(&mut self, data: ExportData) -> ImportResult {
        self.graph.load_snapshot(data.graph);
        self.games.clear();
        for game in data.games {
            self.games.insert(game.game_id, game);
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
            .get_node(game.current_node_id)
            .map(|n| n.board.clone())
            .unwrap_or_else(Board::empty);
        GameState {
            active_game_id: game.game_id,
            game,
            active_board: board,
            graph: self.graph.snapshot(),
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
        assert_eq!(state.game.source_node_id, state.game.current_node_id);
        assert_eq!(state.game.score, 0);
        assert!(!state.game.is_terminated);
    }

    #[test]
    fn test_valid_move_creates_two_nodes_and_two_edges() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let current_id = state.game.current_node_id;

        // Board: single tile at (0,0). Move Left is invalid (no change).
        // Move Right is also invalid in this case because the tile is at the right edge? Wait, (0,0) is left edge. Move Right shifts to (0,1). Valid.
        let resp = engine.make_move(MoveRequest {
            game_id: state.active_game_id,
            direction: Direction::Right,
        }).unwrap();

        let new_state = resp.game_state;
        let new_current = new_state.game.current_node_id;
        assert_ne!(new_current, current_id);
        assert_eq!(new_state.graph.nodes.len(), 3); // start, merged, spawned
        assert_eq!(new_state.graph.edges.len(), 2); // move and spawn
        assert_eq!(new_state.game.score, 0); // no merge yet
        assert!(!new_state.game.is_terminated);

        // Verify edge chain: current -> merge -> spawned
        let move_edge = new_state.graph.edges.iter().find(|e| matches!(e.kind, EdgeKind::Move { direction: Direction::Right })).unwrap();
        assert_eq!(move_edge.from, current_id);

        let spawn_edge = new_state.graph.edges.iter().find(|e| matches!(e.kind, EdgeKind::Spawn { .. })).unwrap();
        assert_eq!(spawn_edge.from, move_edge.to);
        assert_eq!(spawn_edge.to, new_current);
    }

    #[test]
    fn test_invalid_move_no_change() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let current_id = state.game.current_node_id;

        // Move Left from (0,0) is invalid because the tile is already at the left edge.
        let resp = engine.make_move(MoveRequest {
            game_id: state.active_game_id,
            direction: Direction::Left,
        }).unwrap();

        assert_eq!(resp.game_state.game.current_node_id, current_id);
        assert_eq!(resp.delta.nodes.len(), 0);
        assert_eq!(resp.delta.edges.len(), 0);
        assert_eq!(resp.delta.score_delta, 0);
    }

    #[test]
    fn test_export_import_roundtrip() {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let game_id = state.active_game_id;

        // Make a move so we have some graph structure
        engine.make_move(MoveRequest { game_id, direction: Direction::Right }).unwrap();

        let export = engine.export();
        let mut engine2 = Engine::new();
        let result = engine2.import(export);

        assert!(result.success);
        assert_eq!(result.games.len(), 1);
        let imported_state = engine2.get_state(game_id).unwrap();
        assert_eq!(imported_state.game.score, 0);
        assert_eq!(imported_state.graph.nodes.len(), 3);
        assert_eq!(imported_state.graph.edges.len(), 2);
    }

    #[test]
    fn test_game_over_state_3x3() {
        // Full 3x3 board with no adjacent equal tiles and no empty cells.
        // No move can change the board, so the game must be terminated on creation.
        let mut engine = Engine::new();
        let board = Board::with_tiles(3, 3, vec![
            Cell::new(0, 0, 2), Cell::new(0, 1, 4), Cell::new(0, 2, 8),
            Cell::new(1, 0, 16), Cell::new(1, 1, 32), Cell::new(1, 2, 64),
            Cell::new(2, 0, 128), Cell::new(2, 1, 256), Cell::new(2, 2, 512),
        ]);
        let state = engine.create_game_with_board(board).unwrap();

        assert!(state.game.is_terminated, "game-over board should be terminated");
        assert_eq!(state.graph.nodes.len(), 1);
        assert_eq!(state.graph.edges.len(), 0);
    }

    #[test]
    fn test_moves_on_game_over_board_are_invalid_3x3() {
        // Once a game is terminated, every direction must be rejected with an empty delta.
        let mut engine = Engine::new();
        let board = Board::with_tiles(3, 3, vec![
            Cell::new(0, 0, 2), Cell::new(0, 1, 4), Cell::new(0, 2, 8),
            Cell::new(1, 0, 16), Cell::new(1, 1, 32), Cell::new(1, 2, 64),
            Cell::new(2, 0, 128), Cell::new(2, 1, 256), Cell::new(2, 2, 512),
        ]);
        let state = engine.create_game_with_board(board).unwrap();
        let game_id = state.active_game_id;
        let initial_node_count = state.graph.nodes.len();
        let initial_edge_count = state.graph.edges.len();
        let initial_score = state.game.score;
        let initial_current = state.game.current_node_id;

        for dir in [Direction::Up, Direction::Down, Direction::Left, Direction::Right] {
            let resp = engine.make_move(MoveRequest { game_id, direction: dir }).unwrap();
            assert!(resp.delta.nodes.is_empty(), "{dir:?} created nodes on a terminated game");
            assert!(resp.delta.edges.is_empty(), "{dir:?} created edges on a terminated game");
            assert_eq!(resp.delta.score_delta, 0, "{dir:?} changed score on a terminated game");
            assert_eq!(resp.game_state.graph.nodes.len(), initial_node_count);
            assert_eq!(resp.game_state.graph.edges.len(), initial_edge_count);
            assert_eq!(resp.game_state.game.score, initial_score);
            assert_eq!(resp.game_state.game.current_node_id, initial_current);
            assert!(resp.game_state.game.is_terminated);
        }
    }

    #[test]
    fn test_game_terminates_after_spawn_3x3() {
        // One empty cell at (2,2). The only valid move slides into it (Right or Down),
        // then the deterministic spawn fills the new empty cell. After the spawn the board
        // is full with no adjacent equal tiles, so the game should be marked terminated.
        let mut engine = Engine::new();
        let board = Board::with_tiles(3, 3, vec![
            Cell::new(0, 0, 2), Cell::new(0, 1, 4), Cell::new(0, 2, 8),
            Cell::new(1, 0, 16), Cell::new(1, 1, 32), Cell::new(1, 2, 64),
            Cell::new(2, 0, 128), Cell::new(2, 1, 256),
        ]);
        let state = engine.create_game_with_board(board).unwrap();
        assert!(!state.game.is_terminated, "pre-move board should not be terminated");

        let resp = engine.make_move(MoveRequest {
            game_id: state.active_game_id,
            direction: Direction::Right,
        }).unwrap();

        assert!(resp.game_state.game.is_terminated, "spawned board should be game-over");
        assert!(resp.delta.nodes.len() > 0, "valid move should create nodes");
        assert_eq!(resp.delta.edges.len(), 2, "valid move should create one move + one spawn edge");
    }
}
