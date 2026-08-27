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

export type Direction = "Up" | "Down" | "Left" | "Right";

export interface EdgeKind {
  Move?: Direction;
  Spawn?: Cell[];
}

export interface Edge {
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
  nodes: { [key: BoardId]: Board };
  edges: { [key: EdgeId]: Edge };
}

export interface GameState {
  game: GameInstance;
  active_board: Board;
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
  const pkg = await import("../public/wasm-pkg/game_wasm.js");
  await pkg.default();
  wasmModule = pkg;
  return pkg;
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
): Promise<GameState> {
  const m = await loadWasm();
  const json = m.make_move(gameId, direction);
  return JSON.parse(json) as GameState;
}

export async function getState(gameId: string): Promise<GameState> {
  const m = await loadWasm();
  const json = m.get_state(gameId);
  return JSON.parse(json) as GameState;
}

export async function getGraph(): Promise<GraphData> {
  const m = await loadWasm();
  const json = m.get_graph();
  return JSON.parse(json) as GraphData;
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
