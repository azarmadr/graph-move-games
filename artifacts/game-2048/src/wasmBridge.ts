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
  dim: [number, number]; // [rows, cols]
  tiles: Cell[];
}

export interface Node {
  board_id: string;
  board: Board;
}

export type Direction = "Up" | "Down" | "Left" | "Right";

export interface EdgeKind {
  Move?: { direction: Direction };
  Spawn?: { cells: Cell[] };
}

export interface Edge {
  edge_id: string;
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface GameInstance {
  id: string;
  source_board_id: string;
  current_board_id: string;
  score: number;
  is_terminated: boolean;
  config: GameConfig;
}

export type BoardId = string;
export type EdgeId = string;
export interface GraphData {
  nodes: { [key: BoardId]: Node };
  edges: { [key: EdgeId]: Edge };
}

export interface GameState {
  game: GameInstance;
  active_board: Board;
  graph: GraphData;
}

export interface GraphDelta {
  is_terminated: boolean;
  nodes: Node[];
  edges: Edge[];
  current_board_id: string;
  score_delta: number;
}

export interface MoveResponse {
  game_state: GameState;
  delta: GraphDelta;
}

export interface GameConfig {
  rows: number;
  cols: number;
  spawn_config: SpawnConfig;
}

export interface SpawnConfig {
  spawns: { [key: number]: number }; // mapping from tile value to spawn probability
}

export interface Engine {
  version: number;
  graph: GraphData;
  games: { [key: string]: GameInstance };
  next_game_nonce: number;
}

export type ExportData = Engine;

export interface ImportResult {
  success: boolean;
  games: GameState[];
}

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

export async function createGameWithConfig(
  config: GameConfig,
): Promise<GameState> {
  const m = await loadWasm();
  const json = m.create_game_with_config(JSON.stringify(config));
  return JSON.parse(json) as GameState;
}

export async function makeMove(
  gameId: string,
  direction: Direction,
): Promise<MoveResponse> {
  const m = await loadWasm();
  const req = JSON.stringify({ game_id: gameId, direction });
  const json = m.make_move(req);
  return JSON.parse(json) as MoveResponse;
}

export async function getState(gameId: string): Promise<GameState> {
  const m = await loadWasm();
  const json = m.get_state(gameId);
  return JSON.parse(json) as GameState;
}

export async function exportGraph(): Promise<ExportData> {
  const m = await loadWasm();
  const json = m.export_graph();
  return JSON.parse(json) as ExportData;
}

export async function importGraph(jsonText: string): Promise<ImportResult> {
  const m = await loadWasm();
  const json = m.import_graph(jsonText);
  return JSON.parse(json) as ImportResult;
}
