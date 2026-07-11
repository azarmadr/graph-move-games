use std::collections::HashMap;

use crate::graph::GraphStore;
use crate::move_logic::resolve_move;
use crate::spawn::{enumerate_spawn_outcomes, SpawnConfig};
use crate::types::*;

/// Per-game state: the active frontier sink and cumulative score.
struct GameInstance {
    cursor: GameCursor,
}

pub struct Engine {
    graph: GraphStore,
    games: HashMap<GameId, GameInstance>,
    next_game_nonce: u64,
    spawn_config: SpawnConfig,
}

impl Engine {
    pub fn new() -> Self {
        Self {
            graph: GraphStore::new(),
            games: HashMap::new(),
            next_game_nonce: 1,
            spawn_config: SpawnConfig::default(),
        }
    }

    /// Create a new game instance starting with a single tile.
    /// Returns the new game_id and the initial full state.
    pub fn create_game(&mut self, config: &GameConfig) -> GameState {
        let game_id = GameId::from_nonce(self.next_game_nonce);
        self.next_game_nonce += 1;

        let rows = config.rows;
        let cols = config.cols;

        // Board: single tile at (0,0) with value 2
        let start_board = Board::with_tiles(rows, cols, vec![Cell::new(0, 0, 2)]);

        let source_id = self.graph.insert_node(start_board.clone(), NodeKind::Source).node_id;

        let sink_id = self.graph
            .insert_node(
                start_board.clone(),
                NodeKind::Sink {
                    game_id,
                    status: GameStatus::Active,
                },
            )
            .node_id;

        self.graph.insert_edge(
            source_id,
            sink_id,
            EdgeType::Spawn {
                spawn: SpawnPayload {
                    cells: vec![Cell::new(0, 0, 2)],
                },
            },
        );

        let cursor = GameCursor {
            game_id,
            sink_id,
            status: GameStatus::Active,
            score: 0,
        };

        self.games.insert(
            game_id,
            GameInstance {
                cursor: cursor.clone(),
            },
        );

        GameState {
            active_game_id: game_id,
            cursor,
            active_board: start_board,
            graph: self.graph.snapshot(),
        }
    }

    /// Apply a move to a game instance.
    /// Returns the new full state + graph delta.
    pub fn make_move(&mut self, req: MoveRequest) -> MoveResponse {
        let game = match self.games.get_mut(&req.game_id) {
            Some(g) => g,
            None => {
                // Unknown game: return empty state
                return MoveResponse {
                    game_state: self.empty_state(req.game_id),
                    delta: GraphDelta::empty(true),
                };
            }
        };

        // If already terminated, no-op
        if game.cursor.status == GameStatus::Terminated {
            let cursor = game.cursor.clone();
            let board = self
                .graph
                .get_node(cursor.sink_id)
                .map(|n| n.board.clone())
                .unwrap_or_else(Board::empty);
            return MoveResponse {
                game_state: GameState {
                    active_game_id: req.game_id,
                    cursor,
                    active_board: board,
                    graph: self.graph.snapshot(),
                },
                delta: GraphDelta::empty(true),
            };
        }

        let old_sink_id = game.cursor.sink_id;
        let old_sink = match self.graph.get_node(old_sink_id) {
            Some(n) => n.clone(),
            None => {
                return MoveResponse {
                    game_state: self.empty_state(req.game_id),
                    delta: GraphDelta::empty(false),
                };
            }
        };

        // 1. Resolve merge-only move
        let (merged_board, merge_score, valid) = resolve_move(&old_sink.board, req.direction);

        if !valid {
            // Invalid: no structural changes, cursor/score unchanged
            let cursor = game.cursor.clone();
            let board = old_sink.board.clone();
            return MoveResponse {
                game_state: GameState {
                    active_game_id: req.game_id,
                    cursor,
                    active_board: board,
                    graph: self.graph.snapshot(),
                },
                delta: GraphDelta::empty(false),
            };
        }

        // 2. Convert old sink to a shared Regular node. With content-addressed IDs
        // the Regular node may already exist from another game; overwriting it
        // with the same content is harmless. The old Sink node remains in the
        // graph with its game-specific ID so existing edges remain valid.
        self.graph.insert_node(old_sink.board.clone(), NodeKind::Regular);

        // 3. Enumerate spawn outcomes
        let outcomes = enumerate_spawn_outcomes(&merged_board, &self.spawn_config);

        let mut new_nodes: Vec<Node> = Vec::new();
        let mut new_edges: Vec<Edge> = Vec::new();

        // 4. For each spawn outcome, create a new Sink
        let mut chosen_sink_id = old_sink_id; // fallback (should not happen)

        for (idx, outcome) in outcomes.iter().enumerate() {
            let mut board = merged_board.clone();
            for cell in &outcome.cells {
                board = board.set(cell.pos.r, cell.pos.c, cell.tile);
            }

            let has_moves = has_any_valid_move(&board);
            let status = if has_moves {
                GameStatus::Active
            } else {
                GameStatus::Terminated
            };

            let new_sink = self.graph.insert_node(
                board.clone(),
                NodeKind::Sink {
                    game_id: req.game_id,
                    status,
                },
            );
            new_nodes.push(new_sink.clone());

            // Move edge (old_sink -> new_sink)
            let move_edge = self.graph.insert_edge(
                old_sink_id,
                new_sink.node_id,
                EdgeType::Move {
                    direction: req.direction,
                },
            );
            new_edges.push(move_edge);

            // Spawn edge (old_sink -> new_sink)
            let spawn_edge = self.graph.insert_edge(
                old_sink_id,
                new_sink.node_id,
                EdgeType::Spawn {
                    spawn: outcome.clone(),
                },
            );
            new_edges.push(spawn_edge);

            if idx == 0 {
                // Deterministic branch choice: first outcome by stable ordering
                chosen_sink_id = new_sink.node_id;
            }
        }

        // 5. Update cursor to chosen sink
        let new_score = game.cursor.score + merge_score as u64;
        let chosen_status = self
            .graph
            .get_node(chosen_sink_id)
            .map(|n| match &n.kind {
                NodeKind::Sink { status, .. } => *status,
                _ => GameStatus::Active,
            })
            .unwrap_or(GameStatus::Active);

        game.cursor = GameCursor {
            game_id: req.game_id,
            sink_id: chosen_sink_id,
            status: chosen_status,
            score: new_score,
        };

        let active_board = self
            .graph
            .get_node(chosen_sink_id)
            .map(|n| n.board.clone())
            .unwrap_or_else(Board::empty);

        let is_terminated = chosen_status == GameStatus::Terminated;

        MoveResponse {
            game_state: GameState {
                active_game_id: req.game_id,
                cursor: game.cursor.clone(),
                active_board,
                graph: self.graph.snapshot(),
            },
                delta: GraphDelta {
                nodes_added: new_nodes,
                edges_added: new_edges,
                is_terminated,
            },
        }
    }

    pub fn get_state(&self, game_id: GameId) -> GameState {
        match self.games.get(&game_id) {
            Some(game) => {
                let board = self
                    .graph
                    .get_node(game.cursor.sink_id)
                    .map(|n| n.board.clone())
                    .unwrap_or_else(Board::empty);
                GameState {
                    active_game_id: game_id,
                    cursor: game.cursor.clone(),
                    active_board: board,
                    graph: self.graph.snapshot(),
                }
            }
            None => self.empty_state(game_id),
        }
    }

    pub fn all_game_states(&self) -> Vec<GameState> {
        self.games.keys().map(|&id| self.get_state(id)).collect()
    }

    pub fn export(&self) -> ExportData {
        ExportData {
            version: 1,
            graph: self.graph.snapshot(),
            games: self.games.values().map(|g| g.cursor.clone()).collect(),
            next_game_nonce: self.next_game_nonce,
        }
    }

    pub fn import(&mut self, data: ExportData) -> ImportResult {
        self.graph.load_snapshot(data.graph);
        self.games.clear();
        for cursor in data.games {
            self.games.insert(
                cursor.game_id,
                GameInstance {
                    cursor: cursor.clone(),
                },
            );
        }
        self.next_game_nonce = data.next_game_nonce;
        ImportResult {
            success: true,
            games: self.all_game_states(),
        }
    }

    fn empty_state(&self, game_id: GameId) -> GameState {
        GameState {
            active_game_id: game_id,
            cursor: GameCursor {
                game_id,
                sink_id: NodeId::zero(),
                status: GameStatus::Terminated,
                score: 0,
            },
            active_board: Board::empty(),
            graph: self.graph.snapshot(),
        }
    }
}

/// Check if any direction produces a valid move from this board.
fn has_any_valid_move(board: &Board) -> bool {
    use Direction::*;
    for dir in [Up, Down, Left, Right] {
        let (_, _, valid) = resolve_move(board, dir);
        if valid {
            return true;
        }
    }
    false
}
