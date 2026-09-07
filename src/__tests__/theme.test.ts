import { describe, it, expect } from "vitest";
import { TILE_COLORS, FALLBACK_TILE_COLOR, COLORS } from "../utils/theme";

describe("TILE_COLORS", () => {
  it("has entries for all standard 2048 tile values", () => {
    const expected = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
    for (const val of expected) {
      expect(TILE_COLORS[val]).toBeDefined();
      expect(TILE_COLORS[val].bg).toMatch(/^#[0-9a-f]{6}$/);
      expect(TILE_COLORS[val].fg).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("tile 0 has same bg and fg (empty tile)", () => {
    expect(TILE_COLORS[0].bg).toBe(TILE_COLORS[0].fg);
  });
});

describe("FALLBACK_TILE_COLOR", () => {
  it("is a valid color pair", () => {
    expect(FALLBACK_TILE_COLOR.bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(FALLBACK_TILE_COLOR.fg).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("COLORS", () => {
  it("has selected and current colors", () => {
    expect(COLORS.selected).toMatch(/^#[0-9a-f]{6}$/);
    expect(COLORS.current).toMatch(/^#[0-9a-f]{6}$/);
  });
});
