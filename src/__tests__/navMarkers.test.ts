import { describe, it, expect } from "vitest";
import { buildNavMarkers, type NavMarker } from "../utils/navMarkers";
import type { GraphData, GameInstance } from "../utils/wasmBridge";

function makeGame(overrides: Partial<GameInstance>): GameInstance {
  return {
    id: "g1",
    source_board_id: "root",
    current_board_id: "leaf",
    score: 100,
    is_terminated: false,
    config: { rows: 4, cols: 4, spawn_config: { spawns: { 2: 9, 4: 1 } } },
    ...overrides,
  };
}

function makeEdge(from: string, to: string, id: string) {
  return { from, to, kind: { Move: "Up" as const } };
}

describe("buildNavMarkers", () => {
  it("returns empty for null graph", () => {
    const markers = buildNavMarkers({ nodes: {}, edges: {} }, [], undefined);
    expect(markers).toEqual([]);
  });

  it("finds root and tail markers from games", () => {
    const graph: GraphData = {
      nodes: { root: { dim: [4, 4], tiles: [] }, leaf: { dim: [4, 4], tiles: [] } },
      edges: { e1: makeEdge("root", "leaf", "e1") },
    };
    const games = [makeGame({ source_board_id: "root", current_board_id: "leaf" })];

    const markers = buildNavMarkers(graph, games, undefined);
    const labels = markers.map((m) => m.label);
    expect(labels).toContain("Root");
    expect(labels).toContain("Tail");
  });

  it("finds deepest node in a chain", () => {
    const graph: GraphData = {
      nodes: {
        n0: { dim: [4, 4], tiles: [] },
        n1: { dim: [4, 4], tiles: [] },
        n2: { dim: [4, 4], tiles: [] },
        n3: { dim: [4, 4], tiles: [] },
      },
      edges: {
        e1: makeEdge("n0", "n1", "e1"),
        e2: makeEdge("n1", "n2", "e2"),
        e3: makeEdge("n2", "n3", "e3"),
      },
    };
    const games = [makeGame({ source_board_id: "n0", current_board_id: "n3" })];

    const markers = buildNavMarkers(graph, games, undefined);
    const deepest = markers.find((m) => m.label.startsWith("Deepest"));
    expect(deepest).toBeDefined();
    expect(deepest!.id).toBe("board:n3");
    expect(deepest!.label).toBe("Deepest (3)");
  });

  it("handles multiple roots", () => {
    const graph: GraphData = {
      nodes: {
        r1: { dim: [4, 4], tiles: [] },
        r2: { dim: [4, 4], tiles: [] },
        leaf: { dim: [4, 4], tiles: [] },
      },
      edges: {
        e1: makeEdge("r1", "leaf", "e1"),
        e2: makeEdge("r2", "leaf", "e2"),
      },
    };
    const games = [
      makeGame({ id: "g1", source_board_id: "r1", current_board_id: "leaf" }),
      makeGame({ id: "g2", source_board_id: "r2", current_board_id: "leaf" }),
    ];

    const markers = buildNavMarkers(graph, games, undefined);
    const roots = markers.filter((m) => m.label === "Root");
    expect(roots.length).toBe(2);
  });

  it("marks active game root first", () => {
    const graph: GraphData = {
      nodes: {
        r1: { dim: [4, 4], tiles: [] },
        r2: { dim: [4, 4], tiles: [] },
      },
      edges: {},
    };
    const games = [
      makeGame({ id: "g1", source_board_id: "r1" }),
      makeGame({ id: "g2", source_board_id: "r2" }),
    ];

    const markers = buildNavMarkers(graph, games, "g2");
    expect(markers[0].id).toBe("board:r2");
    expect(markers[0].label).toBe("Root");
  });

  describe("performance — BFS should be O(V+E), not O(V×E)", () => {
    it("completes large diamond graph in reasonable time", () => {
      const nodeCount = 2000;
      const nodes: GraphData["nodes"] = {};
      const edges: GraphData["edges"] = {};

      for (let i = 0; i < nodeCount; i++) {
        nodes[`n${i}`] = { dim: [4, 4], tiles: [] };
      }

      for (let i = 0; i < nodeCount - 1; i++) {
        edges[`e${i}`] = makeEdge(`n${i}`, `n${i + 1}`, `e${i}`);
        if (i + 2 < nodeCount) {
          edges[`eb${i}`] = makeEdge(`n${i}`, `n${i + 2}`, `eb${i}`);
        }
      }

      const games = [makeGame({ source_board_id: "n0", current_board_id: `n${nodeCount - 1}` })];

      const start = performance.now();
      const markers = buildNavMarkers(nodes as any, games, undefined);
      const elapsed = performance.now() - start;

      expect(markers.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(100);
    });

    it("does not re-enqueue visited nodes (no O(V×E) blowup)", () => {
      const n = 500;
      const nodes: GraphData["nodes"] = {};
      const edges: GraphData["edges"] = {};

      for (let i = 0; i < n; i++) {
        nodes[`n${i}`] = { dim: [4, 4], tiles: [] };
      }

      for (let i = 0; i < n - 1; i++) {
        edges[`e${i}`] = makeEdge(`n${i}`, `n${i + 1}`, `e${i}`);
        if (i + 2 < n) {
          edges[`eb${i}`] = makeEdge(`n${i}`, `n${i + 2}`, `eb${i}`);
        }
      }

      const games = [makeGame({ source_board_id: "n0", current_board_id: `n${n - 1}` })];

      const start = performance.now();
      buildNavMarkers(nodes as any, games, undefined);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});
