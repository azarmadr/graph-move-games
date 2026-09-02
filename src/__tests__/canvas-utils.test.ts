import { describe, it, expect } from "vitest";
import { buildGrid } from "../types";
import type { Board } from "../wasmBridge";

function makeBoard(
  dim: [number, number],
  tiles: Array<{ r: number; c: number; tile: number }>,
): Board {
  return {
    dim,
    tiles: tiles.map((t) => ({ pos: { r: t.r, c: t.c }, tile: t.tile })),
  };
}

describe("buildGrid", () => {
  it("creates empty grid with correct dimensions", () => {
    const board = makeBoard([3, 3], []);
    const grid = buildGrid(board);
    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(3);
    expect(grid.flat()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("populates tiles at correct positions", () => {
    const board = makeBoard(
      [3, 3],
      [
        { r: 0, c: 0, tile: 2 },
        { r: 1, c: 2, tile: 4 },
        { r: 2, c: 1, tile: 8 },
      ],
    );
    const grid = buildGrid(board);
    expect(grid[0][0]).toBe(2);
    expect(grid[1][2]).toBe(4);
    expect(grid[2][1]).toBe(8);
    expect(grid[0][1]).toBe(0);
  });

  it("handles 4x4 board", () => {
    const tiles = Array.from({ length: 8 }, (_, i) => ({
      r: Math.floor(i / 4),
      c: i % 4,
      tile: Math.pow(2, i + 1),
    }));
    const board = makeBoard([4, 4], tiles);
    const grid = buildGrid(board);
    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(4);
    expect(grid[0][0]).toBe(2);
    expect(grid[0][3]).toBe(16);
    expect(grid[1][0]).toBe(32);
  });
});
