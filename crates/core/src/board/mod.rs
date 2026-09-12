use {
    crate::{Direction, hash::Fnv1a},
    grid::Grid,
    serde::{Deserialize, Serialize},
};

mod move_logic;
mod spawn;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Board {
    pub(crate) tiles: Grid<u32>,
}

#[derive(Serialize, Deserialize)]
struct BoardS {
    dim: (u8, u8),
    tiles: Vec<Cell>,
}

impl Serialize for Board {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut b = BoardS {
            dim: (self.tiles.rows() as u8, self.tiles.cols() as u8),
            tiles: self
                .tiles
                .indexed_iter()
                .filter_map(|(i, &tile)| {
                    if tile == 0 {
                        None
                    } else {
                        Some(Cell::new(i.0 as u8, i.1 as u8, tile))
                    }
                })
                .collect(),
        };
        b.tiles.sort_by_key(|t| (t.pos.r, t.pos.c));
        b.serialize(serializer)
    }
}
impl<'de> Deserialize<'de> for Board {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let b = BoardS::deserialize(deserializer)?;
        let mut board = Board::with_dim(b.dim.0, b.dim.1);
        board.set_tiles(b.tiles);
        Ok(board)
    }
}

impl Board {
    pub fn with_dim(rows: u8, cols: u8) -> Self {
        Self {
            tiles: Grid::new(rows.into(), cols.into()),
        }
    }

    pub fn size(&self) -> (usize, usize) {
        self.tiles.size()
    }

    #[cfg(test)]
    pub fn with_tiles(tiles: Grid<u32>) -> Self {
        Self { tiles }
    }

    pub fn tiles(mut self, tiles: Vec<Cell>) -> Self {
        self.set_tiles(tiles);
        self
    }

    pub(crate) fn set_tiles(&mut self, tiles: Vec<Cell>) {
        tiles
            .iter()
            .for_each(|t| self.tiles[(t.pos.r as usize, t.pos.c as usize)] = t.tile);
    }

    pub fn tile_at(&self, r: u8, c: u8) -> Option<&u32> {
        self.tiles.get(r, c)
    }

    /// Positions of empty cells.
    pub fn empty_positions(&self) -> Vec<(usize, usize)> {
        self.tiles
            .indexed_iter()
            .filter_map(|(i, &tile)| if tile == 0 { Some(i) } else { None })
            .collect()
    }

    /// Insert or replace a cell at a position. Returns a new Board.
    pub fn set(&mut self, r: u8, c: u8, tile: u32) {
        self.tiles[(r.into(), c.into())] = tile;
    }

    /// Hashable canonical representation used for content-addressed IDs.
    pub(crate) fn hash_content(&self, hasher: &mut Fnv1a) {
        hasher.write_u8(self.tiles.rows() as u8);
        hasher.write_u8(self.tiles.cols() as u8);
        for (r, row) in self.tiles.iter_rows().enumerate() {
            for (c, &tile) in row.enumerate() {
                if tile == 0 {
                    continue;
                }
                hasher.write_u8(r as u8);
                hasher.write_u8(c as u8);
                hasher.write_u32(tile);
            }
        }
    }

    /// Returns directions that produce a valid move from this board.
    /// Only directions that actually change the board are included.
    pub fn valid_moves(&self) -> Vec<Direction> {
        use crate::Direction::*;
        let mut valid = Vec::new();

        // Helper: check if a line can move left (has sliding or merging potential)
        fn line_can_move_left(line: &[&u32]) -> bool {
            let len = line.len();
            // Check for empty space a tile can slide into
            for i in 0..len {
                if *line[i] != 0 {
                    // Can slide left if there's a zero to its left
                    if i > 0 && *line[i - 1] == 0 {
                        return true;
                    }
                    // Can merge with left neighbor
                    if i > 0 && *line[i] == *line[i - 1] {
                        return true;
                    }
                }
            }
            // Check from the left: is there a non-zero with only zeros to its left?
            let mut all_zeros_left = true;
            for &&i in line.iter() {
                if i != 0 {
                    all_zeros_left = false;
                    break;
                }
            }
            // If there are non-zero tiles and not all at position 0, can slide
            if !all_zeros_left {
                let first_nonzero = line.iter().position(|&&x| x != 0).unwrap_or(len);
                if first_nonzero > 0 {
                    return true;
                }
            }
            false
        }

        // Helper: check if a line can move right
        fn line_can_move_right(line: &[&u32]) -> bool {
            let len = line.len();
            // Check from the right: is there a non-zero not at position len-1?
            let last_nonzero = line.iter().rposition(|&&x| x != 0).unwrap_or(len);
            if last_nonzero < len - 1 {
                return true; // Can slide right
            }
            // Check for adjacent equal tiles
            for i in (1..len).rev() {
                if *line[i] != 0 && *line[i] == *line[i - 1] {
                    return true; // Can merge
                }
            }
            false
        }

        // Helper: check if a line can move up (same logic as left)
        fn line_can_move_up(line: &[&u32]) -> bool {
            line_can_move_left(line)
        }

        // Helper: check if a line can move down (same logic as right)
        fn line_can_move_down(line: &[&u32]) -> bool {
            line_can_move_right(line)
        }

        // Check Left: any row has a tile that can slide/merge left
        if self
            .tiles
            .iter_rows()
            .any(|row| line_can_move_left(&row.collect::<Vec<_>>()))
        {
            valid.push(Left);
        }

        // Check Right: any row has a tile that can slide/merge right
        if self
            .tiles
            .iter_rows()
            .any(|row| line_can_move_right(&row.collect::<Vec<_>>()))
        {
            valid.push(Left);
        }

        // Check Up: any column has a tile that can slide/merge up
        if self
            .tiles
            .iter_cols()
            .any(|col| line_can_move_up(&col.collect::<Vec<_>>()))
        {
            valid.push(Up);
        }

        // Check Down: any column has a tile that can slide/merge down
        if self
            .tiles
            .iter_cols()
            .any(|col| line_can_move_down(&col.collect::<Vec<_>>()))
        {
            valid.push(Up);
        }

        valid
    }
}
