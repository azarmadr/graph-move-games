import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { makeDagLayout, NODE_SIZE } from "../utils/dagLayout";
import { buildGrid } from "../utils/types";
import { measure, printResult } from "./perf";
import type { GraphData, Board } from "../utils/wasmBridge";

const DATA_DIR = join(import.meta.dirname, "../../.data");

function loadGraphData(): GraphData[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const graphs: GraphData[] = [];

  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
      const exportData = raw.exportData ?? raw;

      if (exportData.graph?.nodes && !Array.isArray(exportData.graph.nodes)) {
        const nodes: GraphData["nodes"] = {};
        for (const [id, node] of Object.entries<any>(exportData.graph.nodes)) {
          const n = node as any;
          if (n.board) {
            nodes[id] = n.board;
          } else if (n.dim) {
            nodes[id] = n as Board;
          }
        }
        const edges: GraphData["edges"] = {};
        if (exportData.graph.edges) {
          for (const [id, edge] of Object.entries<any>(
            exportData.graph.edges,
          )) {
            const e = edge as any;
            if (e.from && e.to && e.kind) {
              edges[id] = e;
            }
          }
        }
        if (Object.keys(nodes).length > 0) {
          graphs.push({ nodes, edges });
        }
      }

      if (exportData.graph?.graph?.nodes) {
        const g = exportData.graph.graph;
        const nodes: GraphData["nodes"] = {};
        for (const [id, node] of Object.entries<any>(g.nodes)) {
          const n = node as any;
          if (n.board) {
            nodes[id] = n.board;
          } else if (n.dim) {
            nodes[id] = n as Board;
          }
        }
        const edges: GraphData["edges"] = {};
        if (g.edges) {
          if (Array.isArray(g.edges)) {
            for (let i = 0; i < g.edges.length; i++) {
              const e = g.edges[i];
              if (e?.from && e?.to && e?.kind) {
                edges[String(i)] = e;
              }
            }
          } else {
            for (const [id, edge] of Object.entries<any>(g.edges)) {
              const e = edge as any;
              if (e?.from && e?.to && e?.kind) {
                edges[id] = e;
              }
            }
          }
        }
        if (Object.keys(nodes).length > 0) {
          graphs.push({ nodes, edges });
        }
      }
    } catch {
      // skip unparseable files
    }
  }

  return graphs;
}

describe("dagre layout benchmarks", { timeout: 120_000 }, () => {
  const graphs = loadGraphData();

  it(`benchmarks dagre layout on ${graphs.length} saved graphs`, () => {
    expect(graphs.length).toBeGreaterThan(0);

    for (let i = 0; i < graphs.length; i++) {
      const g = graphs[i];
      const nodeCount = Object.keys(g.nodes).length;
      const edgeCount = Object.keys(g.edges).length;
      printResult(
        measure(`dagre layout [${i}] (${nodeCount}n, ${edgeCount}e)`, () => {
          makeDagLayout(g);
        }),
      );
    }
  });

  it("benchmarks buildGrid on saved graphs", () => {
    for (let i = 0; i < graphs.length; i++) {
      const boards = Object.values(graphs[i].nodes);
      if (boards.length === 0) continue;

      printResult(
        measure(
          `buildGrid [${i}] (${boards.length} boards)`,
          () => {
            for (const board of boards) {
              buildGrid(board);
            }
          },
          100,
        ),
      );
    }
  });
});
