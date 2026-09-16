import { describe, it, expect } from "vitest";
import { makeDagLayout, NODE_SIZE, nodeKey, edgeKey } from "../utils/dagLayout";
import type { GraphData } from "../utils/wasmBridge";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dirname, "../../.data");

function loadPersistedGraph(filename: string): GraphData {
  const raw = JSON.parse(
    readFileSync(join(DATA_DIR, filename), "utf-8"),
  );
  const g = raw.exportData?.graph?.graph;
  if (!g) throw new Error(`No graph found in ${filename}`);

  const nodes: GraphData["nodes"] = {};
  const nodeList: any[] = g.nodes;
  for (let i = 0; i < nodeList.length; i++) {
    nodes[String(i)] = nodeList[i];
  }

  const edges: GraphData["edges"] = {};
  const edgeList: any[] = g.edges;
  for (let i = 0; i < edgeList.length; i++) {
    const tuple = edgeList[i];
    const [from, to, kind] = tuple;
    edges[String(i)] = {
      from: String(from),
      to: String(to),
      kind,
    };
  }

  return { nodes, edges };
}

function buildChainGraph(length: number): GraphData {
  const nodes: GraphData["nodes"] = {};
  const edges: GraphData["edges"] = {};
  for (let i = 0; i < length; i++) {
    nodes[String(i)] = {
      dim: [3, 3],
      tiles: [{ pos: { r: 0, c: 0 }, tile: 2 }],
    };
    if (i > 0) {
      edges[String(i - 1)] = {
        from: String(i - 1),
        to: String(i),
        kind: { Move: "Up" },
      };
    }
  }
  return { nodes, edges };
}

describe("makeDagLayout", () => {
  it("handles a small graph", () => {
    const graph: GraphData = {
      nodes: {
        a: { dim: [3, 3], tiles: [{ pos: { r: 0, c: 0 }, tile: 2 }] },
        b: { dim: [3, 3], tiles: [{ pos: { r: 0, c: 0 }, tile: 4 }] },
      },
      edges: {
        e1: { from: "a", to: "b", kind: { Move: "Up" } },
      },
    };
    const layout = makeDagLayout(graph);
    expect(layout.nodes["board:a"]).toBeDefined();
    expect(layout.nodes["board:b"]).toBeDefined();
    expect(layout.edges.length).toBe(1);
  });

  it("handles empty graph", () => {
    const layout = makeDagLayout({ nodes: {}, edges: {} });
    expect(Object.keys(layout.nodes)).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
  });

  it("handles single node", () => {
    const graph: GraphData = {
      nodes: {
        a: { dim: [3, 3], tiles: [{ pos: { r: 0, c: 0 }, tile: 2 }] },
      },
      edges: {},
    };
    const layout = makeDagLayout(graph);
    expect(layout.nodes["board:a"]).toBeDefined();
  });

  it("handles diamond graph", () => {
    const graph: GraphData = {
      nodes: {
        a: { dim: [3, 3], tiles: [] },
        b: { dim: [3, 3], tiles: [] },
        c: { dim: [3, 3], tiles: [] },
        d: { dim: [3, 3], tiles: [] },
      },
      edges: {
        e1: { from: "a", to: "b", kind: { Move: "Up" } },
        e2: { from: "a", to: "c", kind: { Move: "Down" } },
        e3: { from: "b", to: "d", kind: { Move: "Left" } },
        e4: { from: "c", to: "d", kind: { Move: "Right" } },
      },
    };
    const layout = makeDagLayout(graph);
    expect(Object.keys(layout.nodes)).toHaveLength(4);
    expect(layout.edges.length).toBe(4);
  });
});

describe("makeDagLayout — persisted graph data", { timeout: 30_000 }, () => {
  it("loads and parses .3 graph data correctly", () => {
    const graph = loadPersistedGraph("game-2048-persisted.3.json");
    expect(Object.keys(graph.nodes).length).toBeGreaterThan(0);
    expect(Object.keys(graph.edges).length).toBeGreaterThan(0);
  });

  it("handles the .3 graph (8746 nodes) without stack overflow", () => {
    const graph = loadPersistedGraph("game-2048-persisted.3.json");
    const nodeCount = Object.keys(graph.nodes).length;
    const edgeCount = Object.keys(graph.edges).length;
    expect(nodeCount).toBe(8746);
    expect(edgeCount).toBe(9042);

    const layout = makeDagLayout(graph);
    expect(Object.keys(layout.nodes).length).toBe(nodeCount);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("makeDagLayout — deep chain graphs", { timeout: 30_000 }, () => {
  it("handles a chain of 500 nodes without stack overflow", () => {
    const graph = buildChainGraph(500);
    const layout = makeDagLayout(graph);
    expect(Object.keys(layout.nodes)).toHaveLength(500);
  });

  it("handles a chain of 2000 nodes without stack overflow", () => {
    const graph = buildChainGraph(2000);
    const layout = makeDagLayout(graph);
    expect(Object.keys(layout.nodes)).toHaveLength(2000);
  });

  it("handles a chain of 5000 nodes without stack overflow", () => {
    const graph = buildChainGraph(5000);
    const layout = makeDagLayout(graph);
    expect(Object.keys(layout.nodes)).toHaveLength(5000);
  });
});
