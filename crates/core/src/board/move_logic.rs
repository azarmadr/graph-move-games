use {super::Board, crate::types::Direction};

impl Board {
    /// Resolve a merge-only move (no spawning).
    /// Returns (board_after_merges, merge_score, is_valid).
    ///
    /// Standard 2048 rules:
    /// - Tiles slide as far as possible in the direction.
    /// - Adjacent equal tiles merge once per tile per move.
    /// - Merge score = sum of values of all merged tiles.
    pub fn resolve_move(&mut self, dir: Direction) -> Option<u32> {
        let to_left = matches!(dir, Direction::Left | Direction::Up);
        let is_row = matches!(dir, Direction::Left | Direction::Right);

        match dir {
            Direction::Left | Direction::Right => 0..self.tiles.rows(),
            _ => 0..self.tiles.cols(),
        }
        .filter_map(|idx| self.merge_line(idx, is_row, to_left))
        .reduce(|a, b| a + b)
    }

    /// Extract a line from the board.
    /// `is_row=true` extracts row `idx`, else column `idx`.
    /// Length matches the dimension (rows for columns, cols for rows).
    fn merge_line(&mut self, idx: usize, is_row: bool, to_left: bool) -> Option<u32> {
        let len = if is_row {
            self.tiles.rows()
        } else {
            self.tiles.cols()
        };

        // TODO: reuse the valid moves check here to return None early

        let slice = if is_row {
            self.tiles.iter_row(idx)
        } else {
            self.tiles.iter_col(idx)
        };

        let prev_slice = slice.clone().cloned().collect::<Vec<_>>();

        let mut filtered = slice.filter(|&&x| x != 0).cloned().collect::<Vec<_>>();

        if to_left {
            filtered.reverse();
        }

        let mut score: u32 = 0;
        for pos in 0..len {
            let pos = if to_left { pos } else { len - 1 - pos };
            let tile = self
                .tiles
                .get_mut(
                    if is_row { idx } else { pos },
                    if is_row { pos } else { idx },
                )
                .unwrap();
            let Some(current_tile) = filtered.pop() else {
                *tile = 0;
                continue;
            };
            let Some(_) = filtered.pop_if(|&mut v| v == current_tile) else {
                *tile = current_tile;
                continue;
            };
            *tile = current_tile * 2;
            score += *tile;
        }

        if prev_slice
            .into_iter()
            .zip(if is_row {
                self.tiles.iter_row(idx)
            } else {
                self.tiles.iter_col(idx)
            })
            .all(|(l, &r)| l == r)
        {
            None
        } else {
            Some(score)
        }
    }
}

#[cfg(test)]
mod tests {
    use {super::*, grid::grid};

    fn grid<const R: usize, const C: usize>(board: &Board) -> [[u32; C]; R] {
        let mut g = [[0u32; C]; R];
        for (pos, &tile) in board.tiles.indexed_iter() {
            g[pos.0][pos.1] = tile;
        }
        g
    }

    #[test]
    fn test_slide_left_simple_3x3() {
        let mut b = Board::with_tiles(grid![[0, 2, 0][0, 0, 0][0, 0, 0]]);
        let score = b.resolve_move(Direction::Left);
        assert_eq!(score, Some(0));
        assert_eq!(grid::<3, 3>(&b), [[2, 0, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_merge_left_2_2_3x3() {
        let mut b = Board::with_tiles(grid![[2, 2, 0][0, 0, 0][0, 0, 0]]);
        let score = b.resolve_move(Direction::Left);
        assert_eq!(score, Some(4));
        assert_eq!(grid::<3, 3>(&b), [[4, 0, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_merge_left_no_double_merge_3x3() {
        let mut b = Board::with_tiles(grid![[2, 2, 2][0, 0, 0][0, 0, 0]]);
        let score = b.resolve_move(Direction::Left);
        assert_eq!(score, Some(4));
        assert_eq!(grid::<3, 3>(&b), [[4, 2, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_right_merge_3x3() {
        let mut b = Board::with_tiles(grid![[2, 2, 0][0, 0, 0][0, 0, 0]]);
        let score = b.resolve_move(Direction::Right);
        assert_eq!(score, Some(4));
        assert_eq!(grid::<3, 3>(&b), [[0, 0, 4], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_up_merge_3x3() {
        let mut b = Board::with_tiles(grid![[2, 0, 0][2, 0, 0][0, 0, 0]]);
        let score = b.resolve_move(Direction::Up);
        assert_eq!(score, Some(4));
        assert_eq!(grid::<3, 3>(&b), [[4, 0, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_down_merge_3x3() {
        let mut b = Board::with_tiles(grid![[2, 0, 0][2, 0, 0][0, 0, 0]]);
        let score = b.resolve_move(Direction::Down);
        assert_eq!(score, Some(4));
        assert_eq!(grid::<3, 3>(&b), [[0, 0, 0], [0, 0, 0], [4, 0, 0]]);
    }

    #[test]
    fn test_4x4_still_works() {
        let mut b = Board::with_tiles(grid![ [2, 2, 0, 0][0, 0, 0, 0][0, 0, 0, 0][0, 0, 0, 0]
        ]);
        let score = b.resolve_move(Direction::Left);
        assert_eq!(score, Some(4));
        assert_eq!(
            grid::<4, 4>(&b),
            [[4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        );
    }

    #[test]
    fn test_invalid_move_no_change_3x3() {
        let mut b = Board::with_tiles(grid![[2, 4, 8][0, 0, 0][0, 0, 0]]);
        let may_be_score = b.resolve_move(Direction::Left);
        assert!(may_be_score.is_none());
        assert_eq!(grid::<3, 3>(&b), [[2, 4, 8], [0, 0, 0], [0, 0, 0]]);
    }
}
