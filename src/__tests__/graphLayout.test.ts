import { GraphLayout, type WasmGraphData } from "../components/GraphLayout";
import { describe, it, expect } from "vitest";

function makeSmallGraph(): WasmGraphData {
  return {
    nodes: {
      "board:1": {
        board: { dim: [4, 4], tiles: [{ pos: { r: 0, c: 0 }, tile: 2 }] },
      },
      "board:2": {
        board: { dim: [4, 4], tiles: [{ pos: { r: 0, c: 1 }, tile: 4 }] },
      },
      "board:3": {
        board: { dim: [4, 4], tiles: [{ pos: { r: 1, c: 0 }, tile: 8 }] },
      },
    },
    edges: {
      "edge:0": {
        from: "board:1",
        to: "board:2",
        kind: { Move: "Right" },
      },
      "edge:1": {
        from: "board:2",
        to: "board:3",
        kind: { Move: "Down" },
      },
    },
  };
}

function makeGraphWithPositions(): WasmGraphData {
  return {
    nodes: {
      "board:1": {
        board: { dim: [4, 4], tiles: [] },
        x: 100,
        y: 200,
      },
      "board:2": {
        board: { dim: [4, 4], tiles: [] },
        x: 300,
        y: 400,
      },
    },
    edges: {
      "edge:0": {
        from: "board:1",
        to: "board:2",
        kind: { Move: "Right" },
      },
    },
  };
}

describe("GraphLayout", () => {
  it("starts empty", () => {
    const layout = new GraphLayout();
    expect(layout.nodeCount).toBe(0);
    expect(layout.layoutMode).toBe("dagre");
  });

  it("populates on update", () => {
    const layout = new GraphLayout();
    layout.update(makeSmallGraph());
    expect(layout.nodeCount).toBe(3);
  });

  it("returns true when data changes", () => {
    const layout = new GraphLayout();
    const changed = layout.update(makeSmallGraph());
    expect(changed).toBe(true);
  });

  it("toForceGraphData produces nodes and links", () => {
    const layout = new GraphLayout();
    layout.update(makeSmallGraph());
    const { nodes, links } = layout.toForceGraphData();
    expect(nodes.length).toBe(3);
    expect(links.length).toBe(2);
  });

  it("fx/fy set in dagre mode when positions exist", () => {
    const layout = new GraphLayout();
    layout.update(makeGraphWithPositions());
    const { nodes } = layout.toForceGraphData();
    const node = nodes.find((n) => n.id === "board:1");
    expect(node).toBeDefined();
    expect(node!.fx).toBe(100);
    expect(node!.fy).toBe(200);
  });

  it("fx/fy null in fg-dag mode", () => {
    const layout = new GraphLayout();
    layout.update(makeGraphWithPositions());
    layout.setLayoutMode("fg-dag");
    const { nodes } = layout.toForceGraphData();
    for (const node of nodes) {
      expect(node.fx).toBeUndefined();
      expect(node.fy).toBeUndefined();
    }
  });

  it("clears positions when switching to fg-dag", () => {
    const layout = new GraphLayout();
    layout.update(makeGraphWithPositions());
    layout.setLayoutMode("fg-dag");
    const { nodes } = layout.toForceGraphData();
    for (const node of nodes) {
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
    }
  });

  it("preserves positions in visgraph mode", () => {
    const layout = new GraphLayout();
    layout.update(makeGraphWithPositions());
    layout.setLayoutMode("visgraph");
    const { nodes } = layout.toForceGraphData();
    const node = nodes.find((n) => n.id === "board:1");
    expect(node).toBeDefined();
    expect(node!.fx).toBe(100);
    expect(node!.fy).toBe(200);
  });

  it("links have correct source and target", () => {
    const layout = new GraphLayout();
    layout.update(makeSmallGraph());
    const { links } = layout.toForceGraphData();
    expect(links[0].source).toBe("board:1");
    expect(links[0].target).toBe("board:2");
  });
});
