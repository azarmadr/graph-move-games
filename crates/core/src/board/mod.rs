use {
    crate::grid::Pos,
    grid::Grid,
    serde::{Deserialize, Serialize},
};

mod move_logic;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
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

    /// Returns directions that produce a valid move from this board.
    ///
    /// A line changes when a tile can slide toward the direction, or when two
    /// tiles that become adjacent after compacting are equal. Scans the line
    /// in place: no board clone and no per-line allocation.
    pub fn valid_moves(&self) -> Vec<Direction> {
        use Direction::*;

        fn line_moves(line: impl Iterator<Item = u32>) -> bool {
            let mut seen_zero = false;
            let mut previous: Option<u32> = None;

            for tile in line {
                if tile == 0 {
                    seen_zero = true;
                } else {
                    // A zero before this tile means it can slide toward the
                    // start; an equal predecessor means it can merge.
                    if seen_zero || previous == Some(tile) {
                        return true;
                    }
                    previous = Some(tile);
                }
            }

            false
        }

        let mut valid = Vec::new();

        if self.tiles.iter_rows().any(|row| line_moves(row.copied())) {
            valid.push(Left);
        }
        if self
            .tiles
            .iter_rows()
            .any(|row| line_moves(row.rev().copied()))
        {
            valid.push(Right);
        }
        if self.tiles.iter_cols().any(|col| line_moves(col.copied())) {
            valid.push(Up);
        }
        if self
            .tiles
            .iter_cols()
            .any(|col| line_moves(col.rev().copied()))
        {
            valid.push(Down);
        }

        valid
    }
}

#[cfg(test)]
mod valid_moves_tests {
    use {super::*, grid::Grid, std::collections::HashSet};

    const ALL: [Direction; 4] = [
        Direction::Up,
        Direction::Down,
        Direction::Left,
        Direction::Right,
    ];

    /// The property: a direction is reported iff applying it changes the board,
    /// and no direction is reported twice.
    fn assert_valid_moves_are_exact(board: &Board) {
        let reported = board.valid_moves();

        let unique: HashSet<Direction> = reported.iter().copied().collect();
        assert_eq!(
            unique.len(),
            reported.len(),
            "duplicate directions {reported:?} for board {board:?}"
        );

        for dir in ALL {
            let mut applied = board.clone();
            applied.resolve_move(dir);
            let changes = applied != *board;
            assert_eq!(
                reported.contains(&dir),
                changes,
                "direction {dir:?}: reported={} but changes={changes} for board {board:?}",
                reported.contains(&dir)
            );
        }
    }

    /// `GameInstance::is_terminated` is `valid_moves().is_empty()` (game.rs), so
    /// this board-level predicate is the game-level termination flag.
    fn assert_termination_equivalence(board: &Board) {
        let any_effective_swipe = ALL.iter().any(|&dir| {
            let mut applied = board.clone();
            applied.resolve_move(dir);
            applied != *board
        });

        assert_eq!(
            board.valid_moves().is_empty(),
            !any_effective_swipe,
            "valid_moves().is_empty() must match `no direction changes the board` for {board:?}"
        );
    }

    fn for_each_exhaustive<const R: usize, const C: usize>(mut check: impl FnMut(&Board)) {
        // Values 0, 1, 2 are enough to exercise empty cells, equal neighbours,
        // and unequal neighbours; larger values behave the same for equality.
        let cells = R * C;
        let total = 3usize.pow(cells as u32);
        for encoded in 0..total {
            let mut grid = Grid::new(R, C);
            let mut n = encoded;
            for r in 0..R {
                for c in 0..C {
                    grid[(r, c)] = (n % 3) as u32;
                    n /= 3;
                }
            }
            check(&Board::with_tiles(grid));
        }
    }

    fn for_each_random(rows: usize, cols: usize, count: usize, mut check: impl FnMut(&Board)) {
        // xorshift64: fixed seed, no extra dependency, deterministic.
        let mut state = 0x9e37_79b9_7f4a_7c15u64;
        let mut next = || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };
        let values = [0u32, 0, 0, 1, 2, 4, 8, 16];

        for _ in 0..count {
            let mut grid = Grid::new(rows, cols);
            for r in 0..rows {
                for c in 0..cols {
                    grid[(r, c)] = values[(next() % values.len() as u64) as usize];
                }
            }
            check(&Board::with_tiles(grid));
        }
    }

    fn for_each_small_board(mut check: impl FnMut(&Board)) {
        for_each_exhaustive::<1, 1>(&mut check);
        for_each_exhaustive::<1, 2>(&mut check);
        for_each_exhaustive::<2, 1>(&mut check);
        for_each_exhaustive::<1, 3>(&mut check);
        for_each_exhaustive::<3, 1>(&mut check);
        for_each_exhaustive::<2, 2>(&mut check);
        for_each_exhaustive::<2, 3>(&mut check);
        for_each_exhaustive::<3, 2>(&mut check);
        for_each_exhaustive::<3, 3>(&mut check);
    }

    #[test]
    fn valid_moves_matches_application_exhaustively() {
        for_each_small_board(assert_valid_moves_are_exact);
    }

    #[test]
    fn valid_moves_matches_application_on_larger_boards() {
        for_each_random(4, 4, 1_000, assert_valid_moves_are_exact);
        for_each_random(5, 5, 1_000, assert_valid_moves_are_exact);
        for_each_random(2, 5, 1_000, assert_valid_moves_are_exact);
    }

    #[test]
    fn termination_is_equivalent_to_no_effective_swipe() {
        for_each_small_board(assert_termination_equivalence);
        for_each_random(4, 4, 1_000, assert_termination_equivalence);
    }
}
