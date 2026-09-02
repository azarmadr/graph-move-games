import { describe, it } from "vitest";
import { measure, printResult } from "./perf";

function buildGrid(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function gridFromTiles(
  rows: number,
  cols: number,
  tiles: Array<{ r: number; c: number; tile: number }>,
): number[][] {
  const grid = buildGrid(rows, cols);
  for (const cell of tiles) {
    if (grid[cell.r]?.[cell.c] !== undefined) {
      grid[cell.r][cell.c] = cell.tile;
    }
  }
  return grid;
}

describe("benchmarks", () => {
  it("grid operations", () => {
    printResult(measure("buildGrid 3x3", () => buildGrid(3, 3), 10000));
    printResult(measure("buildGrid 4x4", () => buildGrid(4, 4), 10000));
    printResult(measure("buildGrid 5x5", () => buildGrid(5, 5), 10000));
  });

  it("grid population", () => {
    const tiles16 = Array.from({ length: 16 }, (_, i) => ({
      r: Math.floor(i / 4),
      c: i % 4,
      tile: Math.pow(2, (i % 11) + 1),
    }));
    printResult(
      measure("gridFromTiles 4x4", () => gridFromTiles(4, 4, tiles16), 10000),
    );

    const tiles25 = Array.from({ length: 25 }, (_, i) => ({
      r: Math.floor(i / 5),
      c: i % 5,
      tile: Math.pow(2, (i % 11) + 1),
    }));
    printResult(
      measure("gridFromTiles 5x5", () => gridFromTiles(5, 5, tiles25), 10000),
    );
  });

  it("json serialization", () => {
    const obj = {
      nodes: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i, { tile: i }]),
      ),
    };
    printResult(measure("JSON.stringify", () => JSON.stringify(obj), 1000));
    printResult(
      measure("JSON.parse", () => JSON.parse(JSON.stringify(obj)), 1000),
    );
  });
});
