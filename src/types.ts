import type { Board } from "./wasmBridge";

export interface MoveResult {
  moved: boolean;
  scoreGained: number;
}

export interface TileColors {
  bg: string;
  fg: string;
}

export function buildGrid(board: Board): number[][] {
  const [rows, cols] = board.dim;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const cell of board.tiles) {
    if (grid[cell.pos.r]?.[cell.pos.c] !== undefined) {
      grid[cell.pos.r][cell.pos.c] = cell.tile;
    }
  }
  return grid;
}
