import dagre from "@dagrejs/dagre";
import type { GraphData, Edge, GameInstance, Board } from "./wasmBridge";

type Point = { x: number; y: number };

type DagLayout = {
  width: number;
  height: number;
  nodes: Record<string, Point>;
  edges: Array<{ edge: Edge; edge_id: string; points: Point[] }>;
};

const NODE_SIZE = 104;

function nodeKey(boardId: string) {
  return `board:${boardId}`;
}

function edgeKey(edgeId: string) {
  return `edge:${edgeId}`;
}

function edgeLabel(edge: Edge) {
  if (edge.kind.Move) return `Move ${edge.kind.Move}`;
  if (edge.kind.Spawn) {
    return `Spawn ${edge.kind.Spawn.map((cell) => cell.tile).join(", ")}`;
  }
  return "Transition";
}

function boardSummary(node: Board) {
  const tiles = node.tiles.map((cell) => cell.tile).join(" · ");
  return tiles || "Empty board";
}

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  0: { bg: "#cdc1b4", fg: "#cdc1b4" },
  2: { bg: "#eee4da", fg: "#776e65" },
  4: { bg: "#ede0c8", fg: "#776e65" },
  8: { bg: "#f2b179", fg: "#f9f6f2" },
  16: { bg: "#f59563", fg: "#f9f6f2" },
  32: { bg: "#f67c5f", fg: "#f9f6f2" },
  64: { bg: "#f65e3b", fg: "#f9f6f2" },
  128: { bg: "#edcf72", fg: "#f9f6f2" },
  256: { bg: "#edcc61", fg: "#f9f6f2" },
  512: { bg: "#edc850", fg: "#f9f6f2" },
  1024: { bg: "#edc53f", fg: "#f9f6f2" },
  2048: { bg: "#edc22e", fg: "#f9f6f2" },
};

function makeDagLayout(graphData: GraphData): DagLayout {
  const layout = new dagre.graphlib.Graph({
    directed: true,
    multigraph: true,
  });

  layout.setGraph({
    rankdir: "TB",
    align: "UL",
    nodesep: 48,
    ranksep: 92,
    edgesep: 24,
    marginx: 56,
    marginy: 56,
  });
  layout.setDefaultEdgeLabel(() => ({}));

  const nodes = graphData.nodes;
  const edges = graphData.edges;

  for (const board_id in nodes) {
    layout.setNode(nodeKey(board_id), {
      width: NODE_SIZE,
      height: NODE_SIZE,
    });
  }

  for (const edge_id in edges) {
    const edge = edges[edge_id];
    const source = nodeKey(edge.from);
    const target = nodeKey(edge.to);
    if (
      layout.hasNode(source) &&
      layout.hasNode(target) &&
      !layout.hasEdge(source, target, edgeKey(edge_id))
    ) {
      layout.setEdge(source, target, {}, edgeKey(edge_id));
    }
  }

  dagre.layout(layout);

  const positions: Record<string, Point> = {};
  for (const board_id in nodes) {
    const position = layout.node(nodeKey(board_id));
    if (position) {
      positions[nodeKey(board_id)] = { x: position.x, y: position.y };
    }
  }

  const positionedEdges = Object.keys(edges).flatMap((edge_id) => {
    const edge = edges[edge_id];
    const points = layout.edge({
      v: nodeKey(edge.from),
      w: nodeKey(edge.to),
      name: edgeKey(edge_id),
    });
    return points?.points?.length
      ? [{ edge, edge_id, points: points.points }]
      : [];
  });

  const graphSize = layout.graph();
  const halfNode = NODE_SIZE / 2;
  return {
    width: Math.max((graphSize.width ?? 0) + halfNode, 320),
    height: Math.max((graphSize.height ?? 0) + halfNode, 320),
    nodes: positions,
    edges: positionedEdges,
  };
}

function edgeColor(edge: Edge) {
  return edge.kind.Move ? "#4cc9f0" : "#f72585";
}

function edgePath(points: Point[]) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function boardThumbnail(node: Board): string {
  const [rows, cols] = node.dim;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  node.tiles.forEach((cell) => {
    if (grid[cell.pos.r]?.[cell.pos.c] !== undefined) {
      grid[cell.pos.r][cell.pos.c] = cell.tile;
    }
  });

  let cells = "";
  grid.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const colors = TILE_COLORS[value] ?? { bg: "#3c3a32", fg: "#f9f6f2" };
      cells += `<span class="board-thumbnail-cell" style="background:${colors.bg};color:${colors.fg};">${value || ""}</span>`;
    });
  });

  return `<span class="board-thumbnail" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(0, 1fr));">${cells}</span>`;
}

export class GraphTabElement extends HTMLElement {
  private _graphData: GraphData | null = null;
  private _games: GameInstance[] = [];
  private _activeGameId: string | undefined;
  private _loadingState: "skeleton" | "loading" | "ready" | "error" =
    "skeleton";
  private _pendingLayout: DagLayout | null = null;
  private _layoutScheduled = false;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;

  private _panX = 0;
  private _panY = 0;
  private _zoom = 1;
  private _isPanning = false;
  private _panStart = { x: 0, y: 0 };
  private _panOffset = { x: 0, y: 0 };
  private _onMouseMove: ((e: MouseEvent) => void) | null = null;
  private _onMouseUp: (() => void) | null = null;

  set graphData(value: GraphData | null) {
    this._graphData = value;
    if (value) {
      this._loadingState = "loading";
      this.scheduleLayout();
    } else {
      this._loadingState = "skeleton";
      this.render();
    }
  }

  get graphData(): GraphData | null {
    return this._graphData;
  }

  set games(value: GameInstance[]) {
    this._games = value;
    this.render();
  }

  get games(): GameInstance[] {
    return this._games;
  }

  set activeGameId(value: string | undefined) {
    this._activeGameId = value;
    this.render();
  }

  get activeGameId(): string | undefined {
    return this._activeGameId;
  }

  get loadingState(): "skeleton" | "loading" | "ready" | "error" {
    return this._loadingState;
  }

  connectedCallback() {
    this.render();
    this.setupPanZoom();
  }

  disconnectedCallback() {
    if (this._onMouseMove)
      window.removeEventListener("mousemove", this._onMouseMove);
    if (this._onMouseUp) window.removeEventListener("mouseup", this._onMouseUp);
  }

  private setupPanZoom() {
    const container = this.querySelector<HTMLElement>(
      ".graph-infinite-container",
    );
    if (!container) return;

    container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this._panOffset = { x: this._panX, y: this._panY };
      container.classList.add("grabbing");
    });

    this._onMouseMove = (e: MouseEvent) => {
      if (!this._isPanning) return;
      this._panX = this._panOffset.x + (e.clientX - this._panStart.x);
      this._panY = this._panOffset.y + (e.clientY - this._panStart.y);
      this.applyTransform();
    };
    window.addEventListener("mousemove", this._onMouseMove);

    this._onMouseUp = () => {
      this._isPanning = false;
      container.classList.remove("grabbing");
    };
    window.addEventListener("mouseup", this._onMouseUp);

    container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const prevZoom = this._zoom;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this._zoom = Math.max(0.2, Math.min(3, this._zoom * delta));

        this._panX = mouseX - (mouseX - this._panX) * (this._zoom / prevZoom);
        this._panY = mouseY - (mouseY - this._panY) * (this._zoom / prevZoom);
        this.applyTransform();
      },
      { passive: false },
    );
  }

  private applyTransform() {
    const canvas = this.querySelector<HTMLElement>(".graph-canvas");
    if (canvas) {
      canvas.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._zoom})`;
    }
  }

  private centerOnGraph() {
    if (!this._pendingLayout) return;
    const container = this.querySelector<HTMLElement>(
      ".graph-infinite-container",
    );
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const graphW = this._pendingLayout.width;
    const graphH = this._pendingLayout.height;

    this._zoom = Math.min(rect.width / graphW, rect.height / graphH, 1);
    this._panX = (rect.width - graphW * this._zoom) / 2;
    this._panY = (rect.height - graphH * this._zoom) / 2;
    this.applyTransform();
  }

  private scheduleLayout() {
    if (this._layoutScheduled) return;
    this._layoutScheduled = true;

    requestAnimationFrame(() => {
      this._layoutScheduled = false;
      if (!this._graphData) return;

      try {
        this._pendingLayout = makeDagLayout(this._graphData);
        this._loadingState = "ready";
        this.render();
        requestAnimationFrame(() => this.centerOnGraph());
      } catch (e) {
        console.error("dagre layout failed:", e);
        this._loadingState = "error";
        this.render();
      }
    });
  }

  private render() {
    if (this._loadingState === "skeleton") {
      this.innerHTML = `
        <div class="graph-skeleton">
          <div class="graph-skeleton-spinner"></div>
          <div class="graph-skeleton-text">Loading graph...</div>
        </div>
      `;
      return;
    }

    if (this._loadingState === "loading") {
      this.innerHTML = `
        <div class="graph-skeleton">
          <div class="graph-skeleton-spinner"></div>
          <div class="graph-skeleton-text">Computing layout...</div>
        </div>
      `;
      return;
    }

    if (this._loadingState === "error") {
      this.innerHTML = `
        <div class="graph-error">
          <div class="graph-error-text">Failed to load graph data</div>
          <button class="graph-error-retry" type="button">Retry</button>
        </div>
      `;
      return;
    }

    const graphData = this._graphData;
    if (!graphData) {
      this.innerHTML = `<div class="graph-empty">Build the graph by making a move.</div>`;
      return;
    }

    const layout = this._pendingLayout ?? makeDagLayout(graphData);
    const nodes = graphData.nodes;
    const nodeCount = Object.keys(nodes).length;
    const edgeCount = Object.keys(graphData.edges).length;
    const activeGame = this._games.find(
      (game) => game.id === this._activeGameId,
    );
    const selectedNode = this.selectedId?.startsWith("board:")
      ? nodes[this.selectedId.slice("board:".length)]
      : undefined;
    const selectedEdge = this.selectedId?.startsWith("edge:")
      ? graphData.edges[this.selectedId.slice("edge:".length)]
      : undefined;
    const selectedEdgeId = selectedEdge
      ? this.selectedId!.slice("edge:".length)
      : null;
    const selectedNodeId = selectedEdge
      ? this.selectedId!.slice("board:".length)
      : null;
    const hoveredNode = this.hoveredId?.startsWith("board:")
      ? nodes[this.hoveredId.slice("board:".length)]
      : undefined;

    const edgesSvg = layout.edges
      .map(({ edge, edge_id, points }) => {
        const color = edgeColor(edge);
        return `<path
          key="${edge_id}"
          data-edge="${edge_id}"
          d="${edgePath(points)}"
          fill="none"
          stroke="${color}"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          marker-end="url(#${edge.kind.Move ? "graph-arrow-move" : "graph-arrow-spawn"})"
          class="graph-edge"
        />`;
      })
      .join("");

    const nodeButtons = Object.keys(nodes)
      .map((board_id) => {
        const node = nodes[board_id];
        const position = layout.nodes[nodeKey(board_id)];
        if (!position) return "";
        const isCurrent = board_id === activeGame?.current_board_id;
        const isSource = this._games.some(
          (game) => game.source_board_id === board_id,
        );
        const isSelected =
          this.selectedId === nodeKey(board_id) ||
          this.hoveredId === nodeKey(board_id);
        return `<button
          key="${board_id}"
          data-node="${board_id}"
          type="button"
          class="graph-board-card ${
            isCurrent ? "current" : ""
          } ${isSource ? "source" : ""} ${isSelected ? "selected" : ""}"
          style="left:${position.x}px;top:${position.y}px;width:${NODE_SIZE}px;height:${NODE_SIZE}px;"
          aria-label="Board ${boardSummary(node)}"
        >
          ${boardThumbnail(node)}
        </button>`;
      })
      .join("");

    this.innerHTML = `
      <div class="graph-infinite-container">
        <div
          class="graph-canvas"
          style="width:${layout.width}px;height:${layout.height}px;"
        >
          <svg
            class="graph-edges"
            width="${layout.width}"
            height="${layout.height}"
            viewBox="0 0 ${layout.width} ${layout.height}"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="graph-arrow-move"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#4cc9f0" />
              </marker>
              <marker
                id="graph-arrow-spawn"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#f72585" />
              </marker>
            </defs>
            ${edgesSvg}
          </svg>

          ${nodeButtons}
        </div>

        ${
          hoveredNode
            ? `<div class="graph-hover-card">
                <strong>Board ${this.hoveredId!.slice(0, 12)}</strong>
                <span>${boardSummary(hoveredNode)}</span>
              </div>`
            : ""
        }
        ${!nodeCount ? `<div class="graph-empty">No graph nodes yet.</div>` : ""}
      </div>

      <aside class="graph-inspector">
        ${
          !selectedNode && !selectedEdge
            ? `<p>Select a node or edge to inspect its canonical data.</p>`
            : ""
        }
        ${
          selectedNode
            ? `<p class="eyebrow">Selected board</p>
               <h3>${selectedNodeId ?? ""}</h3>
               <p>${selectedNode.dim.join(" × ")} board</p>
               <p>${boardSummary(selectedNode)}</p>`
            : ""
        }
        ${
          selectedEdge
            ? `<p class="eyebrow">Selected transition</p>
               <h3>${selectedEdgeId}</h3>
               <p>${edgeLabel(selectedEdge)}</p>
               <p>${selectedEdge.from.slice(0, 10)} → ${selectedEdge.to.slice(0, 10)}</p>`
            : ""
        }
      </aside>
    `;

    this.bindEvents();
    this.applyTransform();
  }

  private bindEvents() {
    for (const path of this.querySelectorAll<SVGPathElement>(
      "path.graph-edge",
    )) {
      path.addEventListener("click", () => {
        const id = edgeKey(path.dataset.edge!);
        this.selectedId = id;
        this.render();
      });
    }
    for (const btn of this.querySelectorAll<HTMLButtonElement>(
      "button.graph-board-card",
    )) {
      const id = nodeKey(btn.dataset.node!);
      btn.addEventListener("mouseenter", () => {
        this.hoveredId = id;
        this.render();
      });
      btn.addEventListener("mouseleave", () => {
        this.hoveredId = null;
        this.render();
      });
      btn.addEventListener("focus", () => {
        this.hoveredId = id;
        this.render();
      });
      btn.addEventListener("blur", () => {
        this.hoveredId = null;
        this.render();
      });
      btn.addEventListener("click", () => {
        this.selectedId = id;
        this.render();
      });
    }
  }
}
