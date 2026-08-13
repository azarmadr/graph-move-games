use {
    crate::hash::Fnv1a,
    serde::{Deserialize, Serialize},
    std::collections::HashMap,
};

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    /// (rows, cols)
    pub dim: (u8, u8),
    pub tiles: Vec<Cell>,
}

impl Board {
    pub fn with_dim(rows: u8, cols: u8) -> Self {
        Self {
            dim: (rows, cols),
            tiles: Vec::new(),
        }
    }

    pub fn with_tiles(rows: u8, cols: u8, mut tiles: Vec<Cell>) -> Self {
        tiles.sort_by_key(|t| (t.pos.r, t.pos.c));
        Self {
            dim: (rows, cols),
            tiles,
        }
    }

    pub(crate) fn set_tiles(&mut self, mut tiles: Vec<Cell>) {
        tiles.sort_by_key(|t| (t.pos.r, t.pos.c));
        self.tiles = tiles;
    }

    pub fn tile_at(&self, r: u8, c: u8) -> Option<u32> {
        self.tiles
            .iter()
            .find(|t| t.pos.r == r && t.pos.c == c)
            .map(|t| t.tile)
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

    /// Returns directions that produce a valid move from this board.
    /// Only directions that actually change the board are included.
    pub fn valid_moves(&self) -> Vec<Direction> {
        use Direction::*;
        let mut valid = Vec::new();
        let rows = self.dim.0 as usize;
        let cols = self.dim.1 as usize;

        // Helper: check if a line can move left (has sliding or merging potential)
        fn line_can_move_left(line: &[u32]) -> bool {
            let len = line.len();
            // Check for empty space a tile can slide into
            for i in 0..len {
                if line[i] != 0 {
                    // Can slide left if there's a zero to its left
                    if i > 0 && line[i - 1] == 0 {
                        return true;
                    }
                    // Can merge with left neighbor
                    if i > 0 && line[i] == line[i - 1] {
                        return true;
                    }
                }
            }
            // Check from the left: is there a non-zero with only zeros to its left?
            let mut all_zeros_left = true;
            for &i in line.iter() {
                if i != 0 {
                    all_zeros_left = false;
                    break;
                }
            }
            // If there are non-zero tiles and not all at position 0, can slide
            if !all_zeros_left {
                let first_nonzero = line.iter().position(|&x| x != 0).unwrap_or(len);
                if first_nonzero > 0 {
                    return true;
                }
            }
            false
        }

        // Helper: check if a line can move right
        fn line_can_move_right(line: &[u32]) -> bool {
            let len = line.len();
            // Check from the right: is there a non-zero not at position len-1?
            let last_nonzero = line.iter().rposition(|&x| x != 0).unwrap_or(len);
            if last_nonzero < len - 1 {
                return true; // Can slide right
            }
            // Check for adjacent equal tiles
            for i in (1..len).rev() {
                if line[i] != 0 && line[i] == line[i - 1] {
                    return true; // Can merge
                }
            }
            false
        }

        // Helper: check if a line can move up (same logic as left)
        fn line_can_move_up(line: &[u32]) -> bool {
            line_can_move_left(line)
        }

        // Helper: check if a line can move down (same logic as right)
        fn line_can_move_down(line: &[u32]) -> bool {
            line_can_move_right(line)
        }

        // Check Left: any row has a tile that can slide/merge left
        'left_check: for r in 0..rows {
            let line: Vec<u32> = (0..cols)
                .map(|c| self.tile_at(r as u8, c as u8).unwrap_or_default())
                .collect();
            if line_can_move_left(&line) {
                valid.push(Left);
                break 'left_check;
            }
        }

        // Check Right: any row has a tile that can slide/merge right
        'right_check: for r in 0..rows {
            let line: Vec<u32> = (0..cols)
                .map(|c| self.tile_at(r as u8, c as u8).unwrap_or_default())
                .collect();
            if line_can_move_right(&line) {
                valid.push(Right);
                break 'right_check;
            }
        }

        // Check Up: any column has a tile that can slide/merge up
        'up_check: for c in 0..cols {
            let line: Vec<u32> = (0..rows)
                .map(|r| self.tile_at(r as u8, c as u8).unwrap_or_default())
                .collect();
            if line_can_move_up(&line) {
                valid.push(Up);
                break 'up_check;
            }
        }

        // Check Down: any column has a tile that can slide/merge down
        'down_check: for c in 0..cols {
            let line: Vec<u32> = (0..rows)
                .map(|r| self.tile_at(r as u8, c as u8).unwrap_or_default())
                .collect();
            if line_can_move_down(&line) {
                valid.push(Down);
                break 'down_check;
            }
        }

        valid
    }
}

macro_rules! strong_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub struct $name(pub u64);

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }
    };
}

strong_id!(BoardId);
strong_id!(EdgeId);
strong_id!(GameId);

macro_rules! id_string_serde {
    ($name:ident) => {
        impl Serialize for $name {
            fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                serializer.serialize_str(&self.0.to_string())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let s = String::deserialize(deserializer)?;
                s.parse::<u64>().map($name).map_err(|e| {
                    serde::de::Error::custom(format!("invalid {}: {}", stringify!($name), e))
                })
            }
        }
    };
}

id_string_serde!(BoardId);
id_string_serde!(EdgeId);
id_string_serde!(GameId);

impl BoardId {
    /// Content-addressed ID: hash of the board content only.
    /// All board states are globally deduplicated by this ID.
    pub fn from_board(board: &Board) -> Self {
        let mut h = Fnv1a::new();
        board.hash_content(&mut h);
        Self(h.finish())
    }
}

impl EdgeId {
    /// Content-addressed ID: hash of (from board ID, to board ID, edge payload).
    pub fn from_content(from: BoardId, to: BoardId, edge: &Edge) -> Self {
        let mut h = Fnv1a::new();
        h.write_u64(from.0);
        h.write_u64(to.0);
        match &edge {
            Edge::Move(direction) => {
                h.write_u8(0);
                h.write_u8(match direction {
                    Direction::Up => 0,
                    Direction::Down => 1,
                    Direction::Left => 2,
                    Direction::Right => 3,
                });
            }
            Edge::Spawn(cells) => {
                h.write_u8(1);
                for cell in cells {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Edge {
    Move(Direction),
    Spawn(Vec<Cell>),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: BoardId,
    pub to: BoardId,
    pub kind: Edge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: HashMap<BoardId, Board>,
    pub edges: HashMap<EdgeId, GraphEdge>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameInstance {
    pub id: GameId,
    pub source_board_id: BoardId,
    pub current_board_id: BoardId,
    pub score: u64,
    pub is_terminated: bool,
    pub config: GameConfig,
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameState {
    pub game: GameInstance,
    pub active_board: Board,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpawnConfig {
    pub spawns: HashMap<u32, u32>,
}

impl Default for SpawnConfig {
    fn default() -> Self {
        Self {
            spawns: HashMap::from([(2, 1)]),
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Deserialize, Serialize)]
pub struct GameConfig {
    pub rows: u8,
    pub cols: u8,
    pub spawn_config: SpawnConfig,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            rows: 4,
            cols: 4,
            spawn_config: SpawnConfig::default(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub games: Vec<GameState>,
}
