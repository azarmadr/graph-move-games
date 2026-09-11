import type { Board, Edge } from "./wasmBridge";

export interface ForceGraphNode {
  id: string;
  boardId: string;
  board: Board;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
}

export interface ForceGraphLink {
  id: string;
  edgeId: string;
  edge: Edge;
  source: string;
  target: string;
}
