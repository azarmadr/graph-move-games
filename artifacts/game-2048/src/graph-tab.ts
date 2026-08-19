import dagre from "@dagrejs/dagre";
import ForceGraph from "force-graph";
import type { GraphData, Edge, GameInstance, Board } from "./wasmBridge";
import { GraphControlsElement } from "./graph-controls";

type Point = { x: number; y: number };

type DagLayout = {
  width: number;
  height: number;
  nodes: Record<string, Point>;
  edges: Array<{ edge: Edge; edge_id: string; points: Point[] }>;
};

const NODE_SIZE = 104;
const DOT_THRESHOLD = 0.5;
const DOT_RADIUS = 12;
const THRESHOLD_BAND = 0.15;

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

function dominantTileColor(board: Board): string {
  let maxTile = 0;
  for (const cell of board.tiles) {
    if (cell.tile > maxTile) maxTile = cell.tile;
  }
  return (TILE_COLORS[maxTile] ?? { bg: "#cdc1b4" }).bg;
}

function edgeColor(edge: Edge) {
  return edge.kind.Move ? "#4cc9f0" : "#f72585";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

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

class ThumbnailCache {
  private _cache = new Map<string, ImageBitmap>();
  private _pending = new Map<string, Promise<ImageBitmap>>();

  get(boardId: string, board: Board): ImageBitmap | null {
    return this._cache.get(boardId) ?? null;
  }

  render(boardId: string, board: Board): ImageBitmap | null {
    if (this._cache.has(boardId)) return this._cache.get(boardId)!;
    if (this._pending.has(boardId)) return null;

    const offscreen = document.createElement("canvas");
    offscreen.width = NODE_SIZE;
    offscreen.height = NODE_SIZE;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;

    const [rows, cols] = board.dim;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const cell of board.tiles) {
      if (grid[cell.pos.r]?.[cell.pos.c] !== undefined) {
        grid[cell.pos.r][cell.pos.c] = cell.tile;
      }
    }

    const gap = 3;
    const padding = 4;
    const innerW = NODE_SIZE - padding * 2;
    const innerH = NODE_SIZE - padding * 2;
    const cellW = (innerW - gap * (cols - 1)) / cols;
    const cellH = (innerH - gap * (rows - 1)) / rows;

    ctx.fillStyle = "#8f7a66";
    ctx.beginPath();
    ctx.roundRect(0, 0, NODE_SIZE, NODE_SIZE, 12);
    ctx.fill();

    ctx.fillStyle = "#bbada0";
    ctx.beginPath();
    ctx.roundRect(padding, padding, innerW, innerH, 6);
    ctx.fill();

    const fontScale = Math.max(8, Math.min(15, cellW * 0.65));
    ctx.font = `800 ${fontScale}px "Clear Sans", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const value = grid[r][c];
        const colors = TILE_COLORS[value] ?? { bg: "#3c3a32", fg: "#f9f6f2" };
        const cx = padding + c * (cellW + gap);
        const cy = padding + r * (cellH + gap);

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cellW, cellH, 3);
        ctx.fill();

        if (value > 0) {
          ctx.fillStyle = colors.fg;
          ctx.fillText(String(value), cx + cellW / 2, cy + cellH / 2);
        }
      }
    }

    const promise = createImageBitmap(offscreen);
    this._pending.set(boardId, promise);
    promise.then((bmp) => {
      this._cache.set(boardId, bmp);
      this._pending.delete(boardId);
    });
    return null;
  }

  clear() {
    this._cache.clear();
    this._pending.clear();
  }
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

  private _forceGraph: any = null;
  private _physicsEnabled = false;
  private _mouseX = 0;
  private _mouseY = 0;
  private _hoverCard: HTMLElement | null = null;

  private _edgeWaypoints: Map<string, Point[]> = new Map();
  private _nodePositionMap: Map<string, { x: number; y: number }> = new Map();
  private _thumbnailCache = new ThumbnailCache();
  private _graphControls: GraphControlsElement | null = null;

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
    if (this._forceGraph) this.updateInspector();
  }

  get games(): GameInstance[] {
    return this._games;
  }

  set activeGameId(value: string | undefined) {
    this._activeGameId = value;
    if (this._forceGraph) this.updateInspector();
  }

  get activeGameId(): string | undefined {
    return this._activeGameId;
  }

  get loadingState(): "skeleton" | "loading" | "ready" | "error" {
    return this._loadingState;
  }

  get zoom(): number {
    return this._forceGraph?.zoom() ?? 1;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.removeHoverCard();
  }

  centerOnNode(nodeId: string) {
    if (!this._forceGraph || !this._pendingLayout) return;
    const position = this._pendingLayout.nodes[nodeId];
    if (!position) return;
    this._forceGraph.centerAt(position.x, position.y, 400);
  }

  zoomBy(direction: "in" | "out") {
    if (!this._forceGraph) return;
    const factor = direction === "in" ? 1.2 : 0.8;
    const currentZoom = this._forceGraph.zoom();
    this._forceGraph.zoom(
      Math.max(0.2, Math.min(3, currentZoom * factor)),
      200,
    );
  }

  togglePhysics() {
    if (!this._forceGraph || !this._graphData) return;
    this._physicsEnabled = !this._physicsEnabled;

    if (this._physicsEnabled) {
      for (const node of this._forceGraph.graphData().nodes) {
        node.fx = undefined;
        node.fy = undefined;
      }
      const charge = this._forceGraph.d3Force("charge");
      if (charge) charge.strength(-120);
      const link = this._forceGraph.d3Force("link");
      if (link) link.distance(100);
      this._forceGraph.enableNodeDrag(true).d3ReheatSimulation();
    } else {
      for (const node of this._forceGraph.graphData().nodes) {
        node.fx = node.x;
        node.fy = node.y;
      }
      this._forceGraph
        .d3Force("charge", null)
        .d3Force("link", null)
        .d3Force("center", null)
        .enableNodeDrag(false);
    }

    this.dispatchEvent(
      new CustomEvent("physics-mode", {
        detail: { enabled: this._physicsEnabled },
        bubbles: true,
        composed: true,
      }),
    );
  }

  get physicsEnabled(): boolean {
    return this._physicsEnabled;
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
        this.initForceGraph();
      } catch (e) {
        console.error("dagre layout failed:", e);
        this._loadingState = "error";
        this.render();
      }
    });
  }

  private initForceGraph() {
    const layout = this._pendingLayout;
    const graphData = this._graphData;
    if (!layout || !graphData) return;

    if (this._forceGraph) {
      this._forceGraph._destructor();
    }
    this.innerHTML = "";
    this._forceGraph = null;
    this._thumbnailCache.clear();

    const container = document.createElement("div");
    container.className = "graph-infinite-canvas-host";
    this.appendChild(container);

    const inspector = document.createElement("details");
    inspector.className = "graph-inspector";
    inspector.innerHTML = `<summary>?</summary><div class="graph-inspector-body"><p>Select a node or edge to inspect.</p></div>`;
    this.appendChild(inspector);

    this._graphControls = document.createElement(
      "graph-controls",
    ) as GraphControlsElement;
    this.appendChild(this._graphControls);
    this._graphControls.markers = this.buildNavMarkers();

    this._graphControls.addEventListener("navigate-node", ((e: CustomEvent) => {
      this.centerOnNode(e.detail.nodeId);
    }) as EventListener);

    this._graphControls.addEventListener("zoom-change", ((e: CustomEvent) => {
      this.zoomBy(e.detail.direction);
    }) as EventListener);

    this._graphControls.addEventListener("physics-toggle", (() => {
      this.togglePhysics();
      if (this._graphControls)
        this._graphControls.physicsEnabled = this.physicsEnabled;
    }) as EventListener);

    this._edgeWaypoints.clear();
    this._nodePositionMap.clear();

    const nodes = Object.keys(graphData.nodes).map((board_id) => {
      const pos = layout.nodes[nodeKey(board_id)];
      const nodeData = graphData.nodes[board_id];
      if (pos) this._nodePositionMap.set(nodeKey(board_id), pos);
      return {
        id: nodeKey(board_id),
        boardId: board_id,
        board: nodeData,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
      };
    });

    const links: any[] = [];
    for (const edge_id of Object.keys(graphData.edges)) {
      const edge = graphData.edges[edge_id];
      const sourceKey = nodeKey(edge.from);
      const targetKey = nodeKey(edge.to);
      const pts = layout.edges.find((e) => e.edge_id === edge_id)?.points ?? [];
      this._edgeWaypoints.set(edgeKey(edge_id), pts);
      links.push({
        id: edgeKey(edge_id),
        edgeId: edge_id,
        edge: edge,
        source: sourceKey,
        target: targetKey,
      });
    }

    const fg = new ForceGraph(container as HTMLElement);
    this._forceGraph = fg;

    fg.graphData({ nodes, links })
      .nodeId("id")
      .linkSource("source")
      .linkTarget("target")
      .width(container.clientWidth || 800)
      .height(container.clientHeight || 600)
      .nodeCanvasObjectMode(() => "replace")
      .nodeCanvasObject(this.renderNodeCanvas.bind(this))
      .nodePointerAreaPaint(this.renderNodePointer.bind(this))
      .linkCanvasObjectMode(() => "replace")
      .linkCanvasObject(this.renderLinkCanvas.bind(this))
      .linkPointerAreaPaint(this.renderLinkPointer.bind(this))
      .onNodeClick(this.handleNodeClick.bind(this))
      .onNodeHover(this.handleNodeHover.bind(this))
      .onLinkClick(this.handleLinkClick.bind(this))
      .onZoom(this.handleZoom.bind(this))
      .enableNodeDrag(false)
      .enablePointerInteraction(true)
      .minZoom(0.2)
      .maxZoom(3)
      .d3Force("charge", null)
      .d3Force("link", null)
      .d3Force("center", null);

    for (const node of fg.graphData().nodes) {
      node.fx = node.x;
      node.fy = node.y;
    }

    requestAnimationFrame(() => {
      fg.zoomToFit(400, 40);
    });

    container.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      this._mouseX = e.clientX - rect.left;
      this._mouseY = e.clientY - rect.top;
    });

    this.updateInspector();
  }

  private renderNodeCanvas(
    node: any,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) {
    const board: Board = node.board;
    const isSelected = this.selectedId === node.id;
    const isCurrent = this._games.some(
      (g) => g.current_board_id === node.boardId,
    );
    const isSource = this._games.some(
      (g) => g.source_board_id === node.boardId,
    );

    const scale = globalScale;
    const halfSize = NODE_SIZE / 2;

    if (scale < DOT_THRESHOLD - THRESHOLD_BAND) {
      const color = dominantTileColor(board);
      ctx.beginPath();
      ctx.arc(node.x, node.y, DOT_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      if (isSelected || isCurrent || isSource) {
        ctx.strokeStyle = isSelected
          ? "#4cc9f0"
          : isCurrent
            ? "#f72585"
            : "#4cc9f0";
        ctx.lineWidth = isSelected ? 2.5 : isCurrent ? 2 : 1.5;
        ctx.stroke();
      }
    } else if (scale > DOT_THRESHOLD + THRESHOLD_BAND) {
      this.drawThumbnail(node, ctx, board, isSelected, isCurrent, isSource);
    } else {
      const t =
        (scale - (DOT_THRESHOLD - THRESHOLD_BAND)) / (THRESHOLD_BAND * 2);
      const radius = lerp(DOT_RADIUS, halfSize, t);
      const color = dominantTileColor(board);

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (t > 0.3) {
        const gridAlpha = (t - 0.3) / 0.7;
        const [rows, cols] = board.dim;
        const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
        for (const cell of board.tiles) {
          if (grid[cell.pos.r]?.[cell.pos.c] !== undefined) {
            grid[cell.pos.r][cell.pos.c] = cell.tile;
          }
        }
        const innerR = radius * 0.85;
        const cellSize = (innerR * 2) / Math.max(rows, cols);
        const gap = cellSize * 0.12;

        ctx.globalAlpha = gridAlpha;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const value = grid[r][c];
            const tc = TILE_COLORS[value] ?? { bg: "#3c3a32", fg: "#f9f6f2" };
            const cx = node.x - innerR + c * cellSize + gap;
            const cy = node.y - innerR + r * cellSize + gap;
            const s = cellSize - gap * 2;

            ctx.fillStyle = tc.bg;
            ctx.beginPath();
            ctx.roundRect(cx, cy, s, s, 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      if (isSelected || isCurrent || isSource) {
        ctx.strokeStyle = isSelected
          ? "#4cc9f0"
          : isCurrent
            ? "#f72585"
            : "#4cc9f0";
        ctx.lineWidth = isSelected ? 2.5 : isCurrent ? 2 : 1.5;
        ctx.stroke();
      }
    }
  }

  private drawThumbnail(
    node: any,
    ctx: CanvasRenderingContext2D,
    board: Board,
    isSelected: boolean,
    isCurrent: boolean,
    isSource: boolean,
  ) {
    const bmp = this._thumbnailCache.get(node.boardId, board);
    if (bmp) {
      ctx.drawImage(bmp, node.x - NODE_SIZE / 2, node.y - NODE_SIZE / 2);
    } else {
      this._thumbnailCache.render(node.boardId, board);
      ctx.fillStyle = "#8f7a66";
      ctx.beginPath();
      ctx.roundRect(
        node.x - NODE_SIZE / 2,
        node.y - NODE_SIZE / 2,
        NODE_SIZE,
        NODE_SIZE,
        12,
      );
      ctx.fill();
    }

    if (isSelected || isCurrent || isSource) {
      ctx.strokeStyle = isSelected
        ? "#4cc9f0"
        : isCurrent
          ? "#f72585"
          : "#4cc9f0";
      ctx.lineWidth = isSelected ? 2.5 : isCurrent ? 2 : 1.5;
      ctx.stroke();
    }
  }

  private renderNodePointer(
    node: any,
    paintColor: string,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) {
    ctx.fillStyle = paintColor;
    if (globalScale < DOT_THRESHOLD) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, DOT_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillRect(
        node.x - NODE_SIZE / 2,
        node.y - NODE_SIZE / 2,
        NODE_SIZE,
        NODE_SIZE,
      );
    }
  }

  private renderLinkCanvas(
    link: any,
    ctx: CanvasRenderingContext2D,
    _globalScale: number,
  ) {
    const sourceNode = link.source;
    const targetNode = link.target;
    if (!sourceNode?.x || !sourceNode?.y || !targetNode?.x || !targetNode?.y)
      return;

    const waypoints = this._edgeWaypoints.get(link.id) ?? [];
    const color = edgeColor(link.edge);

    ctx.beginPath();
    if (waypoints.length > 0) {
      ctx.moveTo(waypoints[0].x, waypoints[0].y);
      for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
      }
    } else {
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    const lastPt =
      waypoints.length > 0
        ? waypoints[waypoints.length - 1]
        : { x: sourceNode.x, y: sourceNode.y };
    const prevPt =
      waypoints.length > 1
        ? waypoints[waypoints.length - 2]
        : { x: sourceNode.x, y: sourceNode.y };

    const dx = lastPt.x - prevPt.x;
    const dy = lastPt.y - prevPt.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;

    const ux = dx / len;
    const uy = dy / len;

    const arrowLen = 10;
    const arrowW = 4;
    const tipX = targetNode.x - ux * (NODE_SIZE / 2 + 2);
    const tipY = targetNode.y - uy * (NODE_SIZE / 2 + 2);
    const baseX = tipX - ux * arrowLen;
    const baseY = tipY - uy * arrowLen;
    const perpX = -uy * arrowW;
    const perpY = ux * arrowW;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + perpX, baseY + perpY);
    ctx.lineTo(baseX - perpX, baseY - perpY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private renderLinkPointer(
    link: any,
    paintColor: string,
    ctx: CanvasRenderingContext2D,
    _globalScale: number,
  ) {
    const sourceNode = link.source;
    const targetNode = link.target;
    if (!sourceNode?.x || !sourceNode?.y || !targetNode?.x || !targetNode?.y)
      return;

    ctx.strokeStyle = paintColor;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sourceNode.x, sourceNode.y);
    ctx.lineTo(targetNode.x, targetNode.y);
    ctx.stroke();
  }

  private handleNodeClick(node: any) {
    this.selectedId = node.id;
    this.updateInspector();
  }

  private handleNodeHover(node: any) {
    if (node) {
      this.hoveredId = node.id;
      this.showHoverCard(node);
    } else {
      this.hoveredId = null;
      this.removeHoverCard();
    }
  }

  private handleLinkClick(link: any) {
    this.selectedId = link.id;
    this.updateInspector();
  }

  private handleZoom({ k }: { k: number; x: number; y: number }) {
    if (this._graphControls) this._graphControls.zoom = k;
    this.dispatchEvent(
      new CustomEvent("zoom-level", {
        detail: { zoom: k },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private showHoverCard(node: any) {
    this.removeHoverCard();

    const card = document.createElement("div");
    card.className = "graph-hover-card";
    card.innerHTML = `<strong>Board ${node.id.slice(0, 16)}</strong><span>${boardSummary(node.board)}</span>`;
    card.style.left = `${this._mouseX + 16}px`;
    card.style.top = `${this._mouseY + 16}px`;

    const host = this.querySelector<HTMLElement>(".graph-infinite-canvas-host");
    if (host) {
      host.appendChild(card);
      this._hoverCard = card;
    }
  }

  private removeHoverCard() {
    if (this._hoverCard) {
      this._hoverCard.remove();
      this._hoverCard = null;
    }
  }

  private updateInspector() {
    const inspector = this.querySelector<HTMLElement>(".graph-inspector");
    if (!inspector) return;

    const graphData = this._graphData;
    const body = inspector.querySelector<HTMLElement>(".graph-inspector-body");
    if (!body || !graphData) return;

    const selectedNode = this.selectedId?.startsWith("board:")
      ? graphData.nodes[this.selectedId.slice("board:".length)]
      : undefined;
    const selectedEdge = this.selectedId?.startsWith("edge:")
      ? graphData.edges[this.selectedId.slice("edge:".length)]
      : undefined;
    const selectedEdgeId = selectedEdge
      ? this.selectedId!.slice("edge:".length)
      : null;
    const selectedNodeId = selectedNode
      ? this.selectedId!.slice("board:".length)
      : null;

    body.innerHTML = `
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
      ${
        !selectedNode && !selectedEdge
          ? `<p>Select a node or edge to inspect.</p>`
          : ""
      }
    `;
  }

  private buildNavMarkers(): Array<{ id: string; label: string }> {
    const markers: Array<{ id: string; label: string }> = [];
    const graph = this._graphData;
    if (!graph) return markers;

    if (this._activeGameId) {
      const game = this._games.find((g) => g.id === this._activeGameId);
      if (game) {
        markers.push({
          id: nodeKey(game.source_board_id),
          label: "Root",
        });
      }
    }

    const roots = new Set<string>();
    for (const game of this._games) {
      roots.add(game.source_board_id);
    }
    for (const rootId of roots) {
      const key = nodeKey(rootId);
      if (!markers.some((m) => m.id === key)) {
        markers.push({ id: key, label: "Root" });
      }
    }

    const tails = new Set<string>();
    for (const game of this._games) {
      if (!tails.has(game.current_board_id)) {
        tails.add(game.current_board_id);
        const key = nodeKey(game.current_board_id);
        if (!markers.some((m) => m.id === key)) {
          const suffix = this._games.length > 1 ? ` (${game.score})` : "";
          markers.push({ id: key, label: `Tail${suffix}` });
        }
      }
    }

    const adj = new Map<string, string[]>();
    for (const edge of Object.values(graph.edges)) {
      const from = edge.from;
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push(edge.to);
    }

    const depth = new Map<string, number>();
    const queue: string[] = [...roots];
    for (const r of queue) depth.set(r, 0);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const d = depth.get(curr) ?? 0;
      for (const next of adj.get(curr) ?? []) {
        const prev = depth.get(next);
        if (prev === undefined || d + 1 > prev) {
          depth.set(next, d + 1);
          queue.push(next);
        }
      }
    }

    let deepestId: string | null = null;
    let maxDepth = -1;
    for (const [id, d] of depth) {
      if (d > maxDepth) {
        maxDepth = d;
        deepestId = id;
      }
    }
    if (deepestId && maxDepth > 0) {
      const key = nodeKey(deepestId);
      if (!markers.some((m) => m.id === key)) {
        markers.push({ id: key, label: `Deepest (${maxDepth})` });
      }
    }

    return markers;
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

    if (!this._graphData) {
      this.innerHTML = `<div class="graph-empty">Build the graph by making a move.</div>`;
      return;
    }

    if (!this._forceGraph) {
      this.innerHTML = `<div class="graph-empty">No graph nodes yet.</div>`;
    }
  }
}
