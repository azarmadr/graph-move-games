use crate::types::{Board, Cell, Direction, Pos};

/// Resolve a merge-only move (no spawning).
/// Returns (board_after_merges, merge_score, is_valid).
///
/// Standard 2048 rules:
/// - Tiles slide as far as possible in the direction.
/// - Adjacent equal tiles merge once per tile per move.
/// - Merge score = sum of values of all merged tiles.
pub fn resolve_move(board: &Board, dir: Direction) -> (Board, u32, bool) {
    let rows = board.dim.0 as usize;
    let cols = board.dim.1 as usize;
    let mut new_tiles: Vec<Cell> = Vec::new();
    let mut score: u32 = 0;

    match dir {
        Direction::Left => {
            for r in 0..rows {
                let line = extract_line(board, r as u8, true);
                let (merged, line_score) = merge_line(&line);
                score += line_score;
                for (c, tile) in merged.iter().enumerate() {
                    if *tile != 0 {
                        new_tiles.push(Cell::new(r as u8, c as u8, *tile));
                    }
                }
            }
        }
        Direction::Right => {
            for r in 0..rows {
                let line = extract_line(board, r as u8, true);
                let rev = reverse(&line);
                let (merged, line_score) = merge_line(&rev);
                score += line_score;
                let merged = reverse(&merged);
                for (c, tile) in merged.iter().enumerate() {
                    if *tile != 0 {
                        new_tiles.push(Cell::new(r as u8, c as u8, *tile));
                    }
                }
            }
        }
        Direction::Up => {
            for c in 0..cols {
                let line = extract_line(board, c as u8, false);
                let (merged, line_score) = merge_line(&line);
                score += line_score;
                for (r, tile) in merged.iter().enumerate() {
                    if *tile != 0 {
                        new_tiles.push(Cell::new(r as u8, c as u8, *tile));
                    }
                }
            }
        }
        Direction::Down => {
            for c in 0..cols {
                let line = extract_line(board, c as u8, false);
                let rev = reverse(&line);
                let (merged, line_score) = merge_line(&rev);
                score += line_score;
                let merged = reverse(&merged);
                for (r, tile) in merged.iter().enumerate() {
                    if *tile != 0 {
                        new_tiles.push(Cell::new(r as u8, c as u8, *tile));
                    }
                }
            }
        }
    }

    let new_board = Board::with_tiles(board.dim.0, board.dim.1, new_tiles);
    let changed = new_board != *board;
    (new_board, score, changed)
}

/// Extract a line from the board.
/// `is_row=true` extracts row `idx`, else column `idx`.
/// Length matches the dimension (rows for columns, cols for rows).
fn extract_line(board: &Board, idx: u8, is_row: bool) -> Vec<u32> {
    let len = if is_row { board.dim.1 } else { board.dim.0 };
    let mut line = vec![0u32; len as usize];
    for i in 0..len {
        let pos = if is_row {
            Pos::new(idx, i)
        } else {
            Pos::new(i, idx)
        };
        if let Some(tile) = board.tile_at(pos.r, pos.c) {
            line[i as usize] = tile;
        }
    }
    line
}

fn reverse(v: &[u32]) -> Vec<u32> {
    v.iter().rev().copied().collect()
}

/// Slide and merge a single line (leftward).
/// Returns (merged_line, score_gained).
/// Each tile merges at most once per move.
fn merge_line(line: &[u32]) -> (Vec<u32>, u32) {
    let mut filtered: Vec<u32> = line.iter().filter(|&&x| x != 0).copied().collect();
    let mut merged: Vec<u32> = Vec::new();
    let mut score: u32 = 0;
    let mut i = 0;

    while i < filtered.len() {
        if i + 1 < filtered.len() && filtered[i] == filtered[i + 1] {
            let val = filtered[i] * 2;
            merged.push(val);
            score += val;
            i += 2; // skip both (no double-merge)
        } else {
            merged.push(filtered[i]);
            i += 1;
        }
    }

    // Pad with zeros to original line length
    while merged.len() < line.len() {
        merged.push(0);
    }

    (merged, score)
}

/* ────────────────────────────────────────────────────────────────────────────── */
#[cfg(test)]
mod tests {
    use super::*;

    fn board_from_grid<const R: usize, const C: usize>(grid: [[u32; C]; R]) -> Board {
        let mut tiles = Vec::new();
        for r in 0..R {
            for c in 0..C {
                if grid[r][c] != 0 {
                    tiles.push(Cell::new(r as u8, c as u8, grid[r][c]));
                }
            }
        }
        Board::with_tiles(R as u8, C as u8, tiles)
    }

    fn grid<const R: usize, const C: usize>(board: &Board) -> [[u32; C]; R] {
        let mut g = [[0u32; C]; R];
        for t in &board.tiles {
            g[t.pos.r as usize][t.pos.c as usize] = t.tile;
        }
        g
    }

    #[test]
    fn test_slide_left_simple_3x3() {
        let b = board_from_grid([[0, 2, 0], [0, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Left);
        assert!(valid);
        assert_eq!(score, 0);
        assert_eq!(grid::<3, 3>(&nb), [[2, 0, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_merge_left_2_2_3x3() {
        let b = board_from_grid([[2, 2, 0], [0, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Left);
        assert!(valid);
        assert_eq!(score, 4);
        assert_eq!(grid::<3, 3>(&nb), [[4, 0, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_merge_left_no_double_merge_3x3() {
        let b = board_from_grid([[2, 2, 2], [0, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Left);
        assert!(valid);
        assert_eq!(score, 4);
        assert_eq!(grid::<3, 3>(&nb), [[4, 2, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_right_merge_3x3() {
        let b = board_from_grid([[2, 2, 0], [0, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Right);
        assert!(valid);
        assert_eq!(score, 4);
        assert_eq!(grid::<3, 3>(&nb), [[0, 0, 4], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_up_merge_3x3() {
        let b = board_from_grid([[2, 0, 0], [2, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Up);
        assert!(valid);
        assert_eq!(score, 4);
        assert_eq!(grid::<3, 3>(&nb), [[4, 0, 0], [0, 0, 0], [0, 0, 0]]);
    }

    #[test]
    fn test_down_merge_3x3() {
        let b = board_from_grid([[2, 0, 0], [2, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Down);
        assert!(valid);
        assert_eq!(score, 4);
        assert_eq!(grid::<3, 3>(&nb), [[0, 0, 0], [0, 0, 0], [4, 0, 0]]);
    }

    #[test]
    fn test_4x4_still_works() {
        let b = board_from_grid([
            [2, 2, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ]);
        let (nb, score, valid) = resolve_move(&b, Direction::Left);
        assert!(valid);
        assert_eq!(score, 4);
        assert_eq!(grid::<4, 4>(&nb), [[4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    }

    #[test]
    fn test_invalid_move_no_change_3x3() {
        let b = board_from_grid([[2, 4, 8], [0, 0, 0], [0, 0, 0]]);
        let (nb, score, valid) = resolve_move(&b, Direction::Left);
        assert!(!valid);
        assert_eq!(score, 0);
        assert_eq!(grid::<3, 3>(&nb), [[2, 4, 8], [0, 0, 0], [0, 0, 0]]);
    }
}
