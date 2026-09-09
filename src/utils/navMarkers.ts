import type { GraphData, GameInstance } from "./wasmBridge";
import { nodeKey } from "./dagLayout";

export type NavMarker = { id: string; label: string };

export function buildNavMarkers(
  graph: GraphData,
  games: GameInstance[],
  activeGameId: string | undefined,
): NavMarker[] {
  const markers: NavMarker[] = [];

  if (activeGameId) {
    const game = games.find((g) => g.id === activeGameId);
    if (game) {
      markers.push({
        id: nodeKey(game.source_board_id),
        label: "Root",
      });
    }
  }

  const roots = new Set<string>();
  for (const game of games) {
    roots.add(game.source_board_id);
  }
  for (const rootId of roots) {
    const key = nodeKey(rootId);
    if (!markers.some((m) => m.id === key)) {
      markers.push({ id: key, label: "Root" });
    }
  }

  const tails = new Set<string>();
  for (const game of games) {
    if (!tails.has(game.current_board_id)) {
      tails.add(game.current_board_id);
      const key = nodeKey(game.current_board_id);
      if (!markers.some((m) => m.id === key)) {
        const suffix = games.length > 1 ? ` (${game.score})` : "";
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

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const d = depth.get(curr) ?? 0;
    for (const next of adj.get(curr) ?? []) {
      if (!depth.has(next)) {
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
