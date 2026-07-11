use serde::{Deserialize, Serialize};

use crate::hash::Fnv1a;

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

    /// Hashable canonical representation used for content-addressed IDs.
    fn hash_content(&self, hasher: &mut Fnv1a) {
        hasher.write_u8(self.dim.0);
        hasher.write_u8(self.dim.1);
        for cell in &self.tiles {
            hasher.write_u8(cell.pos.r);
            hasher.write_u8(cell.pos.c);
            hasher.write_u32(cell.tile);
        }
    }
}

/* ── Strongly typed IDs ──────────────────────────────────────────── */
macro_rules! strong_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        pub struct $name(pub u64);

        impl $name {
            #[allow(dead_code)]
            pub const fn zero() -> Self {
                Self(0)
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }
    };
}

strong_id!(NodeId);
strong_id!(EdgeId);
strong_id!(GameId);

impl NodeId {
    /// Content-addressed ID: hash of the board + node kind.
    ///
    /// Source/Regular nodes for the same board share the same ID across games,
    /// while Sink nodes are game-specific (and include their status).
    pub fn from_content(board: &Board, kind: &NodeKind) -> Self {
        let mut h = Fnv1a::new();
        board.hash_content(&mut h);
        match kind {
            NodeKind::Source => { h.write_u8(0); }
            NodeKind::Regular => { h.write_u8(1); }
            NodeKind::Sink { game_id, status } => {
                h.write_u8(2);
                h.write_u64(game_id.0);
                h.write_u8(match status {
                    GameStatus::Active => 0,
                    GameStatus::Terminated => 1,
                });
            }
        }
        Self(h.finish())
    }
}

impl EdgeId {
    /// Content-addressed ID: hash of (from, to, edge_type).
    pub fn from_content(from: NodeId, to: NodeId, edge_type: &EdgeType) -> Self {
        let mut h = Fnv1a::new();
        h.write_u64(from.0);
        h.write_u64(to.0);
        match edge_type {
            EdgeType::Move { direction } => {
                h.write_u8(0);
                h.write_u8(match direction {
                    Direction::Up => 0,
                    Direction::Down => 1,
                    Direction::Left => 2,
                    Direction::Right => 3,
                });
            }
            EdgeType::Spawn { spawn } => {
                h.write_u8(1);
                for cell in &spawn.cells {
                    h.write_u8(cell.pos.r);
                    h.write_u8(cell.pos.c);
                    h.write_u32(cell.tile);
                }
            }
        }
        Self(h.finish())
    }
}

impl GameId {
    /// Deterministic hash of a creation nonce. Exported alongside the games so
    /// new games after import never collide with imported ones.
    pub fn from_nonce(nonce: u64) -> Self {
        Self(crate::hash::hash_u64(nonce))
    }
}

/* ── Node kinds and nodes ────────────────────────────────────────── */
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

/* ── Export / Import format ───────────────────────────────────────── */
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExportData {
    pub version: u32,
    pub graph: GraphSnapshot,
    pub games: Vec<GameCursor>,
    pub next_game_nonce: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub games: Vec<GameState>,
}
