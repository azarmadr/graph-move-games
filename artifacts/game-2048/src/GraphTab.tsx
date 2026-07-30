import { useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import type { GraphData, Edge, GameInstance, Node } from "./wasmBridge";

interface GraphTabProps {
  graphData: GraphData | null;
  games: GameInstance[];
  activeGameId?: string;
}

type Point = { x: number; y: number };

type DagLayout = {
  width: number;
  height: number;
  nodes: Record<string, Point>;
  edges: Array<{ edge: Edge; points: Point[] }>;
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

function boardSummary(node: Node) {
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
    const node = nodes[board_id];
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
    const node = nodes[board_id];
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
  return {
    width: Math.max(graphSize.width ?? 0, 320),
    height: Math.max(graphSize.height ?? 0, 320),
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

export default function GraphTab({
  graphData,
  games,
  activeGameId,
}: GraphTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeGame = games.find((game) => game.id === activeGameId);
  const selectedNode = selectedId?.startsWith("board:")
    ? graphData?.nodes[selectedId.slice("board:".length)]
    : undefined;
  const selectedEdge = selectedId?.startsWith("edge:")
    ? graphData?.edges[selectedId.slice("edge:".length)]
    : undefined;
  const selectedEdgeId = selectedEdge ? selectedId.slice("edge:".length) : null;
  const selectedNodeId = selectedEdge
    ? selectedId.slice("board:".length)
    : null;
  const hoveredNode = hoveredId?.startsWith("board:")
    ? graphData?.nodes[hoveredId.slice("board:".length)]
    : undefined;
  const layout = useMemo(
    () => (graphData ? makeDagLayout(graphData) : null),
    [graphData],
  );

  if (!graphData || !layout) {
    return <div className="graph-empty">Build the graph by making a move.</div>;
  }

  const nodes = graphData.nodes;
  const nodeCount = nodes.length;
  const edgeCount = Object.keys(graphData.edges).length;

  return (
    <section className="full-graph-panel">
      <div className="full-graph-heading">
        <div>
          <p className="eyebrow">Global DAG</p>
          <h2>Every board state, one graph</h2>
          <p className="graph-subtitle">
            Every canonical state is shown as a mini 2048 board.
          </p>
        </div>
        <div className="graph-metrics">
          <span>
            <strong>{nodeCount}</strong> nodes
          </span>
          <span>
            <strong>{edgeCount}</strong> edges
          </span>
          <span>
            <strong>{games.length}</strong> games
          </span>
        </div>
      </div>

      <div className="full-graph-stage">
        <div
          className="graph-canvas"
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            className="graph-edges"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
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
            {layout.edges.map(({ edge, edge_id, points }) => {
              const color = edgeColor(edge);
              return (
                <path
                  key={edge_id}
                  d={edgePath(points)}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={`url(#${
                    edge.kind.Move ? "graph-arrow-move" : "graph-arrow-spawn"
                  })`}
                  className="graph-edge"
                  onClick={() => setSelectedId(edgeKey(edge_id))}
                />
              );
            })}
          </svg>

          {Object.keys(nodes).map((board_id) => {
            const node = nodes[board_id];
            const position = layout.nodes[nodeKey(board_id)];
            if (!position) return null;
            const isCurrent = board_id === activeGame?.current_board_id;
            const isSource = games.some(
              (game) => game.source_board_id === board_id,
            );
            const isSelected =
              selectedId === nodeKey(board_id) ||
              hoveredId === nodeKey(board_id);
            return (
              <button
                key={board_id}
                type="button"
                className={[
                  "graph-board-card",
                  isCurrent ? "current" : "",
                  isSource ? "source" : "",
                  isSelected ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: position.x,
                  top: position.y,
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                }}
                onMouseEnter={() => setHoveredId(nodeKey(board_id))}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(nodeKey(board_id))}
                onBlur={() => setHoveredId(null)}
                onClick={() => setSelectedId(nodeKey(board_id))}
                aria-label={`Board ${boardSummary(node)}`}
              >
                <BoardThumbnail node={node} />
              </button>
            );
          })}
        </div>

        {hoveredNode && (
          <div className="graph-hover-card">
            <strong>Board {hoveredId.slice(0, 12)}</strong>
            <span>{boardSummary(hoveredNode)}</span>
          </div>
        )}
        {!nodeCount && <div className="graph-empty">No graph nodes yet.</div>}
      </div>

      <aside className="graph-inspector">
        {!selectedNode && !selectedEdge && (
          <p>Select a node or edge to inspect its canonical data.</p>
        )}
        {selectedNode && (
          <>
            <p className="eyebrow">Selected board</p>
            <h3>{selectedNodeId}</h3>
            <p>{selectedNode.dim.join(" × ")} board</p>
            <p>{boardSummary(selectedNode)}</p>
          </>
        )}
        {selectedEdge && (
          <>
            <p className="eyebrow">Selected transition</p>
            <h3>{selectedEdgeId}</h3>
            <p>{edgeLabel(selectedEdge)}</p>
            <p>
              {selectedEdge.from.slice(0, 10)} → {selectedEdge.to.slice(0, 10)}
            </p>
          </>
        )}
      </aside>
    </section>
  );
}

function BoardThumbnail({ node }: { node: Node }) {
  const [rows, cols] = node.dim;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  node.tiles.forEach((cell) => {
    if (grid[cell.pos.r]?.[cell.pos.c] !== undefined) {
      grid[cell.pos.r][cell.pos.c] = cell.tile;
    }
  });

  return (
    <span
      className="board-thumbnail"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {grid.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => {
          const colors = TILE_COLORS[value] ?? {
            bg: "#3c3a32",
            fg: "#f9f6f2",
          };
          return (
            <span
              key={`${rowIndex}-${colIndex}`}
              className="board-thumbnail-cell"
              style={{ background: colors.bg, color: colors.fg }}
            >
              {value || ""}
            </span>
          );
        }),
      )}
    </span>
  );
}
