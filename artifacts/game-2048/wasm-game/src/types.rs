use serde::{Deserialize, Serialize};

/* ── Positions and cells ───────────────────────────────────────── */
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Pos {
    pub r: u8,
    pub c: u8,
}

impl Pos {
    pub fn new(r: u8, c: u8) -> Self {
        Self { r, c }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Cell {
    pub pos: Pos,
    pub tile: u32,
}

impl Cell {
    pub fn new(r: u8, c: u8, tile: u32) -> Self {
        Self {
            pos: Pos::new(r, c),
            tile,
        }
    }
}

/* ── Board (sparse: empties absent) ───────────────────────────────── */
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    pub dim: (u8, u8), // (rows, cols) — e.g. (3,3) or (4,4)
    pub tiles: Vec<Cell>,
}

impl Board {
    pub fn empty() -> Self {
        Self {
            dim: (4, 4),
            tiles: Vec::new(),
        }
    }

    pub fn with_dim(rows: u8, cols: u8) -> Self {
        Self {
            dim: (rows, cols),
            tiles: Vec::new(),
        }
    }

    pub fn with_tiles(rows: u8, cols: u8, tiles: Vec<Cell>) -> Self {
        Self { dim: (rows, cols), tiles }
    }

    pub fn tile_at(&self, r: u8, c: u8) -> Option<u32> {
        self.tiles.iter().find(|t| t.pos.r == r && t.pos.c == c).map(|t| t.tile)
    }

    /// Returns true if the board has at least one empty cell.
    pub fn has_empty(&self) -> bool {
        self.tiles.len() < (self.dim.0 as usize) * (self.dim.1 as usize)
    }

    /// Positions of empty cells.
    pub fn empty_positions(&self) -> Vec<Pos> {
        let mut empties = Vec::new();
        for r in 0..self.dim.0 {
            for c in 0..self.dim.1 {
                if self.tile_at(r, c).is_none() {
                    empties.push(Pos::new(r, c));
                }
            }
        }
        empties
    }

    /// Insert or replace a cell at a position. Returns a new Board.
    pub fn set(&self, r: u8, c: u8, tile: u32) -> Self {
        let mut tiles = self.tiles.clone();
        if let Some(existing) = tiles.iter_mut().find(|t| t.pos.r == r && t.pos.c == c) {
            existing.tile = tile;
        } else {
            tiles.push(Cell::new(r, c, tile));
        }
        tiles.sort_by_key(|t| (t.pos.r, t.pos.c));
        Self {
            dim: self.dim,
            tiles,
        }
    }

    pub fn remove(&self, r: u8, c: u8) -> Self {
        let tiles: Vec<Cell> = self.tiles.iter().filter(|t| !(t.pos.r == r && t.pos.c == c)).cloned().collect();
        Self {
            dim: self.dim,
            tiles,
        }
    }
}

/* ── Node IDs and kinds ────────────────────────────────────────── */
pub type NodeId = u64;
pub type EdgeId = u64;
pub type GameId = u64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameStatus {
    Active,
    Terminated,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeKind {
    Source,
    Regular,
    Sink { game_id: GameId, status: GameStatus },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Node {
    pub node_id: NodeId,
    pub board: Board,
    pub kind: NodeKind,
}

/* ── Edges ──────────────────────────────────────────────────────── */
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpawnPayload {
    pub cells: Vec<Cell>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeType {
    Move { direction: Direction },
    Spawn { spawn: SpawnPayload },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Edge {
    pub edge_id: EdgeId,
    pub from: NodeId,
    pub to: NodeId,
    pub edge_type: EdgeType,
}

/* ── Graph delta (what changed in one extend_path call) ───────────────────── */
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphDelta {
    pub nodes_added: Vec<Node>,
    pub edges_added: Vec<Edge>,
    pub is_terminated: bool,
}

impl GraphDelta {
    pub fn empty(terminated: bool) -> Self {
        Self {
            nodes_added: Vec::new(),
            edges_added: Vec::new(),
            is_terminated: terminated,
        }
    }
}

/* ── Game cursor / frontier state ───────────────────────────────────────── */
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameCursor {
    pub game_id: GameId,
    pub sink_id: NodeId,
    pub status: GameStatus,
    pub score: u64,
}

/* ── Full state returned to JS ───────────────────────────────────────── */
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameState {
    pub active_game_id: GameId,
    pub cursor: GameCursor,
    pub active_board: Board,
    pub graph: GraphSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphSnapshot {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

/* ── Move request from JS ───────────────────────────────────────── */
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct MoveRequest {
    pub game_id: GameId,
    pub direction: Direction,
}

#[derive(Debug, Clone, Serialize)]
pub struct MoveResponse {
    pub game_state: GameState,
    pub delta: GraphDelta,
}

/* ── Game config from JS ─────────────────────────────────────────── */
#[derive(Debug, Clone, Deserialize)]
pub struct GameConfig {
    pub rows: u8,
    pub cols: u8,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self { rows: 4, cols: 4 }
    }
}
