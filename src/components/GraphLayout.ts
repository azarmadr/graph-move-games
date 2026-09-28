import type { Board, Edge } from "../utils/wasmBridge";
import type { LayoutMode } from "../utils/layoutMode";
import { makeDagLayout, nodeKey, edgeKey, NODE_SIZE } from "../utils/dagLayout";
import type { ForceGraphNode, ForceGraphLink } from "../utils/forceGraphTypes";

interface LayoutNode {
  board: Board;
  x?: number;
  y?: number;
}

interface LayoutEdge {
  from: string;
  to: string;
  kind: Edge["kind"];
}

export interface WasmGraphData {
  nodes: { [key: string]: LayoutNode };
  edges: { [key: string]: LayoutEdge };
}

export class GraphLayout {
  private _nodes: Map<string, LayoutNode> = new Map();
  private _edges: Map<string, LayoutEdge> = new Map();
  private _layoutMode: LayoutMode = "dagre";

  get nodeCount(): number {
    return this._nodes.size;
  }

  get layoutMode(): LayoutMode {
    return this._layoutMode;
  }

  update(wasmData: WasmGraphData): boolean {
    const prevSize = this._nodes.size;

    this._nodes.clear();
    for (const [key, node] of Object.entries(wasmData.nodes)) {
      this._nodes.set(key, { board: node.board, x: node.x, y: node.y });
    }

    this._edges.clear();
    for (const [key, edge] of Object.entries(wasmData.edges)) {
      this._edges.set(key, { from: edge.from, to: edge.to, kind: edge.kind });
    }

    if (this._layoutMode === "dagre") {
      this.clearPositions();
      this.computeDagLayout();
    } else if (this._layoutMode === "visgraph") {
      this.applyPositions();
    }

    return this._nodes.size !== prevSize || this._nodes.size > 0;
  }

  setLayoutMode(mode: LayoutMode): void {
    this._layoutMode = mode;

    if (mode === "fg-dag") {
      this.clearPositions();
    } else if (mode === "dagre") {
      this.clearPositions();
      this.computeDagLayout();
    } else if (mode === "visgraph") {
      this.applyPositions();
    }
  }

  toForceGraphData(): { nodes: ForceGraphNode[]; links: ForceGraphLink[] } {
    const nodes: ForceGraphNode[] = [];
    for (const [key, node] of this._nodes) {
      const boardId = key.replace("board:", "");
      const fgNode: ForceGraphNode = {
        id: key,
        boardId,
        board: node.board,
        x: node.x ?? 0,
        y: node.y ?? 0,
      };
      if (this._layoutMode !== "fg-dag" && node.x !== undefined) {
        fgNode.fx = node.x;
        fgNode.fy = node.y;
      } else {
        fgNode.fx = undefined;
        fgNode.fy = undefined;
      }
      nodes.push(fgNode);
    }

    const links: ForceGraphLink[] = [];
    for (const [key, edge] of this._edges) {
      links.push({
        id: key,
        edgeId: key.replace("edge:", ""),
        edge: { from: edge.from, to: edge.to, kind: edge.kind },
        source: edge.from,
        target: edge.to,
      });
    }

    return { nodes, links };
  }

  private computeLayout(): void {
    if (this._layoutMode === "dagre") {
      this.computeDagLayout();
    }
  }

  private computeDagLayout(): void {
    if (this._nodes.size === 0) return;

    const graphData = {
      nodes: Object.fromEntries(
        [...this._nodes.entries()].map(([key, node]) => [
          key.replace("board:", ""),
          node.board,
        ]),
      ),
      edges: Object.fromEntries(
        [...this._edges.entries()].map(([key, edge]) => [
          key.replace("edge:", ""),
          {
            from: edge.from.replace("board:", ""),
            to: edge.to.replace("board:", ""),
            kind: edge.kind,
          },
        ]),
      ),
    };

    const dagLayout = makeDagLayout(graphData);

    for (const [key] of this._nodes) {
      const pos = dagLayout.nodes[key];
      if (pos) {
        const node = this._nodes.get(key);
        if (node) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }
    }
  }

  private applyPositions(): void {
    for (const [, node] of this._nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        node.x = node.x;
        node.y = node.y;
      }
    }
  }

  private clearPositions(): void {
    for (const [, node] of this._nodes) {
      node.x = undefined;
      node.y = undefined;
    }
  }
}
