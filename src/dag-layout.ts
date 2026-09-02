import dagre from "@dagrejs/dagre";
import type { GraphData, Edge, Board } from "./wasmBridge";

export type Point = { x: number; y: number };

export type DagLayout = {
  width: number;
  height: number;
  nodes: Record<string, Point>;
  edges: Array<{ edge: Edge; edge_id: string; points: Point[] }>;
};

export const NODE_SIZE = 104;

export function nodeKey(boardId: string) {
  return `board:${boardId}`;
}

export function edgeKey(edgeId: string) {
  return `edge:${edgeId}`;
}

export function makeDagLayout(graphData: GraphData): DagLayout {
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
