import dagre from "@dagrejs/dagre";
import type { GraphData, Edge } from "./wasmBridge";

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

function fallbackLayout(graphData: GraphData): DagLayout {
  const nodes = graphData.nodes;
  const edges = graphData.edges;
  const nodeIds = Object.keys(nodes);
  const edgeIds = Object.keys(edges);

  if (nodeIds.length === 0) {
    return { width: 320, height: 320, nodes: {}, edges: [] };
  }

  const adj: Record<string, string[]> = {};
  const inDeg: Record<string, number> = {};
  for (const id of nodeIds) {
    adj[id] = [];
    inDeg[id] = 0;
  }
  for (const eid of edgeIds) {
    const e = edges[eid];
    if (adj[e.from] && inDeg[e.to] !== undefined) {
      adj[e.from].push(e.to);
      inDeg[e.to]++;
    }
  }

  const rank: Record<string, number> = {};
  const queue: string[] = [];
  for (const id of nodeIds) {
    if (inDeg[id] === 0) {
      queue.push(id);
      rank[id] = 0;
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const next of adj[curr]) {
      const r = rank[curr] + 1;
      if (rank[next] === undefined || r > rank[next]) {
        rank[next] = r;
      }
      inDeg[next]--;
      if (inDeg[next] === 0) {
        queue.push(next);
      }
    }
  }

  for (const id of nodeIds) {
    if (rank[id] === undefined) rank[id] = 0;
  }

  const maxRank = Math.max(...nodeIds.map((id) => rank[id]), 0);
  const ranks: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of nodeIds) {
    ranks[rank[id]].push(id);
  }

  const spacingX = NODE_SIZE + 48;
  const spacingY = NODE_SIZE + 92;
  const marginX = 56;
  const marginY = 56;

  const positions: Record<string, Point> = {};
  let maxWidthInRow = 0;

  for (let r = 0; r <= maxRank; r++) {
    const row = ranks[r];
    maxWidthInRow = Math.max(maxWidthInRow, row.length);
    for (let c = 0; c < row.length; c++) {
      positions[nodeKey(row[c])] = {
        x: marginX + c * spacingX + NODE_SIZE / 2,
        y: marginY + r * spacingY + NODE_SIZE / 2,
      };
    }
  }

  const positionedEdges = edgeIds.flatMap((eid) => {
    const e = edges[eid];
    const fromPos = positions[nodeKey(e.from)];
    const toPos = positions[nodeKey(e.to)];
    if (fromPos && toPos) {
      return [
        {
          edge: e,
          edge_id: eid,
          points: [fromPos, toPos],
        },
      ];
    }
    return [];
  });

  const width =
    marginX * 2 + maxWidthInRow * spacingX;
  const height =
    marginY * 2 + (maxRank + 1) * spacingY;

  return {
    width: Math.max(width, 320),
    height: Math.max(height, 320),
    nodes: positions,
    edges: positionedEdges,
  };
}

export function makeDagLayout(graphData: GraphData): DagLayout {
  const nodeCount = Object.keys(graphData.nodes).length;

  if (nodeCount === 0) {
    return { width: 320, height: 320, nodes: {}, edges: [] };
  }

  const DEPTH_THRESHOLD = 800;

  let needsFallback = false;

  if (nodeCount > DEPTH_THRESHOLD) {
    needsFallback = true;
  }

  if (!needsFallback) {
    try {
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
    } catch (e) {
      if (e instanceof RangeError) {
        needsFallback = true;
      } else {
        throw e;
      }
    }
  }

  if (needsFallback) {
    return fallbackLayout(graphData);
  }

  return { width: 320, height: 320, nodes: {}, edges: [] };
}
