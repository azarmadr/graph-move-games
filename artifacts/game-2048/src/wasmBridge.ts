/* WASM Bridge — types that mirror the Rust JSON contract exactly */

export interface Pos {
  r: number;
  c: number;
}

export interface Cell {
  pos: Pos;
  tile: number;
}

export interface Board {
  dim: [number, number];
  tiles: Cell[];
}

export type GameStatus = "Active" | "Terminated";

export type NodeKind =
  | { Source: {} }
  | { Regular: {} }
  | { Sink: { game_id: number; status: GameStatus } };

export interface Node {
  node_id: number;
  board: Board;
  kind: NodeKind;
}

export type Direction = "Up" | "Down" | "Left" | "Right";

export interface SpawnPayload {
  cells: Cell[];
}

export type EdgeType =
  | { Move: { direction: Direction } }
  | { Spawn: { spawn: SpawnPayload } };

export interface Edge {
  edge_id: number;
  from: number;
  to: number;
  edge_type: EdgeType;
}

export interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface GameCursor {
  game_id: number;
  sink_id: number;
  status: GameStatus;
  score: number;
}

export interface GameState {
  active_game_id: number;
  cursor: GameCursor;
  active_board: Board;
  graph: GraphSnapshot;
}

export interface GraphDelta {
  nodes_added: Node[];
  edges_added: Edge[];
  is_terminated: boolean;
}

export interface MoveResponse {
  game_state: GameState;
  delta: GraphDelta;
}

/* ── WASM module loader ────────────────────────────────────────────── */

let wasmModule: any = null;

export async function loadWasm(): Promise<any> {
  if (wasmModule) return wasmModule;
  const pkg = await import("../public/wasm-pkg/game_2048_wasm.js");
  await pkg.default();
  wasmModule = pkg;
  return pkg;
}

export async function createGame(): Promise<GameState> {
  const m = await loadWasm();
  const json = m.create_game();
  return JSON.parse(json) as GameState;
}

export async function makeMove(gameId: number, direction: Direction): Promise<MoveResponse> {
  const m = await loadWasm();
  const req = JSON.stringify({ game_id: gameId, direction });
  const json = m.make_move(req);
  return JSON.parse(json) as MoveResponse;
}

export async function getState(gameId: number): Promise<GameState> {
  const m = await loadWasm();
  const json = m.get_state(String(gameId));
  return JSON.parse(json) as GameState;
}
