import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockFgInstance, MockForceGraph } = vi.hoisted(() => {
  const fg = {
    graphData: vi.fn().mockImplementation(function (this: any, d?: any) {
      return d ? this : { nodes: [], links: [] };
    }),
    nodeId: vi.fn().mockReturnThis(),
    linkSource: vi.fn().mockReturnThis(),
    linkTarget: vi.fn().mockReturnThis(),
    width: vi.fn().mockReturnThis(),
    height: vi.fn().mockReturnThis(),
    nodeCanvasObjectMode: vi.fn().mockReturnThis(),
    nodeCanvasObject: vi.fn().mockReturnThis(),
    nodePointerAreaPaint: vi.fn().mockReturnThis(),
    linkCanvasObjectMode: vi.fn().mockReturnThis(),
    linkCanvasObject: vi.fn().mockReturnThis(),
    linkPointerAreaPaint: vi.fn().mockReturnThis(),
    onNodeClick: vi.fn().mockReturnThis(),
    onNodeHover: vi.fn().mockReturnThis(),
    onLinkClick: vi.fn().mockReturnThis(),
    onZoom: vi.fn().mockReturnThis(),
    enableNodeDrag: vi.fn().mockReturnThis(),
    enablePointerInteraction: vi.fn().mockReturnThis(),
    minZoom: vi.fn().mockReturnThis(),
    maxZoom: vi.fn().mockReturnThis(),
    d3Force: vi.fn().mockReturnThis(),
    zoom: vi.fn().mockReturnValue(1),
    zoomToFit: vi.fn().mockReturnThis(),
    centerAt: vi.fn(),
    _destructor: vi.fn(),
  };
  class MockFG {
    constructor() {
      return fg;
    }
  }
  return { mockFgInstance: fg, MockForceGraph: MockFG };
});

vi.mock("force-graph", () => ({
  default: MockForceGraph,
}));

import { GraphTabElement } from "../graph-tab";
import { GraphControlsElement } from "../graph-controls";
import type { GraphData } from "../wasmBridge";

if (!customElements.get("graph-tab"))
  customElements.define("graph-tab", GraphTabElement);
if (!customElements.get("graph-controls"))
  customElements.define("graph-controls", GraphControlsElement);

const smallGraph: GraphData = {
  nodes: {
    b1: {
      dim: [4, 4],
      tiles: [
        { pos: { r: 0, c: 0 }, tile: 2 },
        { pos: { r: 0, c: 1 }, tile: 4 },
      ],
    },
    b2: {
      dim: [4, 4],
      tiles: [
        { pos: { r: 0, c: 0 }, tile: 4 },
        { pos: { r: 0, c: 1 }, tile: 8 },
      ],
    },
  },
  edges: {
    e1: { from: "b1", to: "b2", kind: { Move: "Up" } },
  },
};

describe("GraphTabElement — pressing graph tab", () => {
  let el: GraphTabElement;

  beforeEach(() => {
    vi.clearAllMocks();
    el = document.createElement("graph-tab") as GraphTabElement;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("shows skeleton on mount", () => {
    expect(el.loadingState).toBe("skeleton");
    expect(el.innerHTML).toContain("graph-skeleton");
  });

  it("shows loading after graphData is set", () => {
    el.graphData = smallGraph;
    expect(el.loadingState).toBe("loading");
    expect(el.innerHTML).toContain("Computing layout");
  });

  it("dagre runs and produces a layout", () => {
    vi.useFakeTimers();
    try {
      el.graphData = smallGraph;
      expect(el.loadingState).toBe("loading");

      vi.advanceTimersByTime(50);

      expect(el.loadingState).toBe("ready");
      expect(el.innerHTML).toContain("graph-infinite-canvas-host");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets null graphData back to skeleton", () => {
    el.graphData = smallGraph;
    el.graphData = null;
    expect(el.loadingState).toBe("skeleton");
  });

  it("handles empty graph", () => {
    expect(() => {
      el.graphData = { nodes: {}, edges: {} };
    }).not.toThrow();
  });

  it("cleans up on disconnect", () => {
    el.graphData = smallGraph;
    expect(() => el.remove()).not.toThrow();
  });
});
