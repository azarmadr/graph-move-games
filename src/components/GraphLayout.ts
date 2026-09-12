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
  private _mode: LayoutMode = "dagre";

  get nodeCount(): number {
    return this._nodes.size;
  }

  get layoutMode(): LayoutMode {
    return this._mode;
  }

  update(wasmData: WasmGraphData): boolean {
    const prevSize = this._nodes.size;

    console.log({ wasmData });
    this._nodes.clear();
    for (const [key, node] of Object.entries(wasmData.nodes)) {
      this._nodes.set(key, { board: node.board, x: node.x, y: node.y });
    }

    this._edges.clear();
    for (const [key, edge] of Object.entries(wasmData.edges)) {
      this._edges.set(key, { from: edge.from, to: edge.to, kind: edge.kind });
    }

    if (this._mode === "dagre") {
      this.clearPositions();
      this.computeDagLayout();
    }

    return this._nodes.size !== prevSize || this._nodes.size > 0;
  }

  setLayoutMode(mode: LayoutMode): void {
    this._mode = mode;
    console.error();

    if (mode === "fg-dag") {
      this.clearPositions();
    } else if (mode === "dagre") {
      this.clearPositions();
      this.computeDagLayout();
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
      if (this._mode !== "fg-dag" && node.x !== undefined) {
        fgNode.fx = node.x;
        fgNode.fy = node.y;
      } else {
        fgNode.fx = undefined;
        fgNode.fy = undefined;
      }
      nodes.push(fgNode);
    }

    console.trace({ nodes, mode: this._mode });
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

  private clearPositions(): void {
    for (const [, node] of this._nodes) {
      node.x = undefined;
      node.y = undefined;
    }
  }
}
