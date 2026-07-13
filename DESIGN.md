# Design Document: 2048 + DAG Graph Visualizer

**Status:** Phase 2 – Data Model Complete, WASM Bridge Live, Graph Rendering in Progress

## Product Summary

A Rust/WASM 2048 game where every board state across all game instances forms a shared global DAG (Directed Acyclic Graph). Players play on a 4×4 board (or configurable NxN), and every move and tile spawn creates nodes and edges in a real-time graph visualization displayed alongside the board. Built for understanding game state branching across concurrent instances.

**Lead feature:** The dual-canvas layout dominates—board on the left (familiar 2048 gameplay), graph on the right (live neighborhood visualization). The board is the primary interaction point; the graph is the window into the global state structure.

---

## Visual Identity

Inherited from 2048, canvas-driven, minimalist dark/light contrast.

### Color Palette

From `App.tsx` TILE_COLORS and CSS:

| Tile Value | Background | Foreground |
|-----------|-----------|-----------|
| Empty (0) | `#cdc1b4` | `#cdc1b4` |
| 2 | `#eee4da` | `#776e65` |
| 4 | `#ede0c8` | `#776e65` |
| 8 | `#f2b179` | `#f9f6f2` |
| 16 | `#f59563` | `#f9f6f2` |
| 32 | `#f67c5f` | `#f9f6f2` |
| 64 | `#f65e3b` | `#f9f6f2` |
| 128 | `#edcf72` | `#f9f6f2` |
| 256 | `#edcc61` | `#f9f6f2` |
| 512 | `#edc850` | `#f9f6f2` |
| 1024 | `#edc53f` | `#f9f6f2` |
| 2048+ | `#edc22e` | `#f9f6f2` |

**Board background:** `#bbada0` (tan grid)  
**Page background:** `#faf8ef` (cream)  
**Text primary:** `#776e65` (dark brown)  
**Text secondary:** `#9b8f82` (light brown)

**Graph background:** `#1a1a2e` (dark navy)  
**Graph edge (predecessors):** `#4cc9f0` (cyan spawn)  
**Graph edge (successors):** `#f72585` (pink move)  
**Graph node current:** `#2a2a45` with glow

**Typography:** `"Clear Sans", Helvetica Neue, Arial, sans-serif` (system stack, no web fonts)

### Spacing & Scale

- **Padding:** 12px (board), 2px (mini tiles in graph)
- **Gap/grid:** 8px (board tiles), 1px (mini tiles)
- **Cell size:** Computed as `(size - padding*2 - gap*(cols-1)) / cols`
- **Canvas sizes:** 360×360 (board), 440×360 (graph)
- **Border radius:** 8px (board), 4px (tiles), 6px (buttons)
- **Font sizes:** 28px (tile 0–7), 24px (128–512), 20px (1024+); 12px monospace (labels)

---

## Data Model

Real data flowing from Rust→WASM→JSON→JS. No mocks—everything is `GameState`.

### Core Structures (from `wasmBridge.ts`)

```typescript
// Sparse board representation
interface Pos { r: number; c: number }
interface Cell { pos: Pos; tile: number }
interface Board { dim: [rows, cols]; tiles: Cell[] }

// DAG nodes: each represents a unique board state
type NodeKind = "Source" | "Regular" | { Sink: { game_id: number; status } }
interface Node {
  node_id: number
  board: Board
  kind: NodeKind
}

// DAG edges: moves and spawns
type EdgeType = { Move: { direction: Direction } } | { Spawn: { cells: Cell[] } }
interface Edge {
  edge_id: number
  from: number
  to: number
  edge_type: EdgeType
}

// Game cursor: which node the player is viewing
interface GameCursor {
  game_id: number
  sink_id: number      // current node
  status: "Active" | "Terminated"
  score: number
}

// Complete game state
interface GameState {
  active_game_id: number
  cursor: GameCursor
  active_board: Board      // current board, sparse
  graph: GraphSnapshot     // all nodes & edges
}

// Delta from a move
interface MoveResponse {
  game_state: GameState
  delta: { nodes_added: Node[]; edges_added: Edge[]; is_terminated: boolean }
}
```

---

## Architecture

### Layout

Two canvases side-by-side (or stacked on mobile):

```
┌─────────────────────────────────────────────┐
│  2048 + DAG Graph Visualizer               │
│  Rust/WASM · Phase 2 — real data model...  │
├─────────────────────────────────────────────┤
│  Board size: [3×3] [4×4] [5×5]             │
├──────────────────────┬──────────────────────┤
│                      │                      │
│   Board Canvas       │   Graph Canvas       │
│   360×360            │   440×360            │
│   - 4×4 2048 board   │   - Neighborhood:    │
│   - SCORE display    │     preds, current,  │
│   - Tile rendering   │     successors       │
│   - Touch/keyboard   │   - Mini boards      │
│     controls         │   - Edge labels      │
│                      │   - Node glow        │
├──────────────────────┴──────────────────────┤
│  Phase 2 Status: [checklist of impl]       │
└─────────────────────────────────────────────┘
```

### Components

**App.tsx** — Main React container, state management
- Loads WASM on mount
- Creates initial game with config
- Renders two canvas refs
- Handles keyboard + touch input

**drawBoard()** — Board canvas rendering
- Sparse tile layout via `Cell` array
- Rounded rectangles, 2048-standard colors
- Dynamic font sizing (28px → 20px by tile value)
- Mobile-safe touch start/move/end handlers

**drawFocusedGraph()** — Graph canvas rendering
- Fixed positions: predecessor row (top), current center, successor row (bottom)
- Edge color-coding: cyan (spawn from pred), pink (move to succ)
- Mini boards (44×44) showing snapshots at each node
- Edge labels: "up", "down", "left", "right", "spawn"
- Glow effect on current node
- Legend: game ID, node ID, score, status

**wasmBridge.ts** — Typed JSON serialization layer
- `loadWasm()` — imports `game_2048_wasm.js`, initializes
- `createGameWithConfig(config)` → `GameState`
- `makeMove(gameId, direction)` → `MoveResponse`
- Full TypeScript types matching Rust struct shapes

### WASM Boundary

**JS → Rust (JSON over the bridge):**
```typescript
// Create game
m.create_game_with_config(JSON.stringify({ rows: 4, cols: 4 }))
  → GameState (JSON string) → parsed by JS

// Make move
m.make_move(JSON.stringify({ game_id: 1, direction: "Up" }))
  → MoveResponse (JSON string) → parsed by JS
```

**Rationale for JSON:**
- Explicit contract; both sides serialize/deserialize identically
- Debuggable (can log JSON on both sides)
- Easy to version if schema changes
- `serde` + `serde-wasm-bindgen` handle all serialization

---

## Critical Files

### Frontend (TypeScript/React)

| File | Purpose |
|------|---------|
| `artifacts/game-2048/src/App.tsx` | Canvas rendering, input handlers, state updates |
| `artifacts/game-2048/src/wasmBridge.ts` | Type definitions + WASM module loader/bridge |
| `artifacts/game-2048/src/main.tsx` | React entry point (2 lines) |
| `artifacts/game-2048/src/index.css` | Global styles + mobile responsive (touch-action, media query) |
| `artifacts/game-2048/index.html` | Root HTML, script src `/src/main.tsx` |
| `artifacts/game-2048/vite.config.ts` | Vite config (port, base path, outDir) |
| `artifacts/game-2048/package.json` | Scripts: `dev`, `build`, `build-wasm`, `serve`, `typecheck` |

### WASM (Rust)

| File | Purpose |
|------|---------|
| `artifacts/game-2048/wasm-game/Cargo.toml` | deps: wasm-bindgen, serde, serde_json, serde-wasm-bindgen |
| `artifacts/game-2048/wasm-game/src/lib.rs` | Public WASM API: `#[wasm_bindgen]` functions |
| `artifacts/game-2048/wasm-game/src/*.rs` | Game logic, DAG, state, utilities (internal) |
| `artifacts/game-2048/public/wasm-pkg/` | Output of `wasm-pack build` (gitignored, generated at build time) |

### Workspace Root

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Workspace packages; supply-chain security settings |
| `replit.md` | Developer guide (Run & Operate, Build pipeline, Gotchas) |
| `.github/workflows/deploy-pages.yml` | CI/CD: build WASM + frontend, deploy to GitHub Pages |

---

## Rendering Pipeline

### Board Rendering

1. **Input:** `GameState.active_board` (sparse `Cell[]`)
2. **Build dense grid:** Iterate cells, fill 2D array
3. **Canvas draw:**
   - Background: tan grid (`#bbada0`) with rounded corners
   - Per-cell: color lookup, rounded rect, tile text
   - Font size: dynamic by tile value
4. **Output:** Visual board with current game state

### Graph Rendering

1. **Input:** `GameState.graph` (all `Node[]`, all `Edge[]`) + `GameState.cursor.sink_id`
2. **Neighborhood extraction:**
   - Find all edges where `to === cursorSink` → predecessors
   - Find all edges where `from === cursorSink` → successors
3. **Position assignment:**
   - Predecessors: horizontal row above center
   - Current: center
   - Successors: horizontal row below center
4. **Draw edges:** Lines with directional labels (up/down/left/right/spawn)
5. **Draw nodes:** Mini 44×44 boards (dense tile rendering), glowing border if current
6. **Legend:** Game ID, node ID, score, status

---

## Input & Interaction

### Keyboard

- **Arrow keys** or **WASD** → Move (Up, Down, Left, Right)
- Board canvas listens globally via `window.addEventListener('keydown')`

### Touch

- **Swipe threshold:** 24px (small taps ignored)
- `onTouchStart` → record coords
- `onTouchEnd` → compute dx, dy; determine direction
- Vertical swipe preferred over horizontal (by absDy vs absDx)

### Button Controls

- **Board size selector:** 3×3, 4×4, 5×5 buttons at top
- **Arrow buttons:** Visible on desktop, hidden on mobile (`@media (max-width: 480px)`)
- **New game:** Creating a game re-renders everything

---

## Phase Breakdown

| Phase | Focus | Status | Shipped |
|-------|-------|--------|---------|
| 1 | Setup: workspace, Rust, Vite, wasm-pack | ✅ Done | `pnpm-workspace.yaml`, `vite.config.ts`, `wasm-game/Cargo.toml` |
| 2 | Data model: Board, Cell, Node, Edge, GameState | ✅ Done | `wasmBridge.ts` types, `Cargo` deps, Rust structs (internal) |
| 3 | Move logic: 2048 rules, board updates | 🔄 In progress | Rust logic (not exposed in Phase 2 design) |
| 4 | Spawning: random 2 or 4 | 🔄 In progress | Integrated into moves (Phase 3) |
| 5 | Graph updates: node/edge creation | 🔄 In progress | `delta` in `MoveResponse` ready to consume |
| 6 | Instance management: create, switch games | ✅ Done | `createGameWithConfig()`, `active_game_id` in state |
| 7 | JS bridge: JSON serialization | ✅ Done | `wasmBridge.ts`, `serde-wasm-bindgen` |
| 8 | Board rendering: canvas, visuals, score | ✅ Done | `drawBoard()`, TILE_COLORS, font sizing |
| 9 | Graph rendering: nodes, edges, layout | 🔄 In progress | `drawFocusedGraph()`, neighborhood extraction, edge labels |
| 10 | Graph rendering: zoom, pan, filters | ⏳ Pending | Multi-game filtering, viewport controls |
| 11 | Interactivity: tooltips, inspect nodes | ⏳ Pending | Hover metadata, click-to-expand |
| 12 | Performance: rendering optimization | ⏳ Pending | DAG query speed, canvas redraws |
| 13 | Polish: UI refinement, final integration | ⏳ Pending | Mobile breakpoints, accessibility |

**Delivery:** Stop after each phase for feedback.

---

## Technical Decisions

### Why Canvas Over DOM?

- **Graph complexity:** 100+ nodes/edges would choke DOM render performance
- **Pixel-level control:** Graph layout, mini boards, edge curves require absolute positioning
- **Consistent rendering:** Canvas is deterministic across browsers
- **Memory efficiency:** Single canvas vs. 100+ HTML elements

### Why Sparse Board Representation?

- **Graph efficiency:** Only store non-empty cells; saves memory
- **Deterministic hashing:** Empty cells don't affect state equality
- **Rebuild on-demand:** JS side can construct dense grid for rendering

### Why JSON Over WASM Bridge?

- **Debugging:** Both sides can log JSON; easy to inspect at boundary
- **Versioning:** Schema changes are explicit
- **Type safety:** TypeScript types on JS side, Rust types on WASM side; serde bridges them
- **Future:** API server can consume same JSON for persistence/multiplayer

### Why Client-Side Game State?

- **No latency:** Moves happen immediately (WASM runs in-browser)
- **Offline capable:** Game works without network
- **Simplifies backend:** API server reserved for future persistence
- **Current phase:** All state fits in WASM memory

---

## Current Limitations & Future Work

### Phase 2 Doesn't Include

- **Multiplayer:** Single game instance only
- **Persistence:** Game state lost on page reload
- **Advanced graph:** No zoom, pan, filtering by game ID
- **Node inspection:** No click-to-inspect or tooltip hover

### Phase 3+ Roadmap

- **Phase 3:** Complete move logic + spawning (Rust tests)
- **Phase 9-10:** Global graph rendering (all nodes, not neighborhood)
- **Phase 11:** Click node → inspect full board snapshot + move history
- **Phase 12:** Render only visible graph region (viewport)
- **Phase 13:** Multiplayer (server broadcasts moves, merges DAG)

---

## Running Locally

```bash
# 1. Install dependencies
pnpm install

# 2. Build WASM once
pnpm --filter @workspace/game-2048 run build-wasm

# 3. Run frontend (Vite, port 26141)
pnpm --filter @workspace/game-2048 run dev

# 4. (Optional) Run API server (Express, port 5000)
pnpm --filter @workspace/api-server run dev

# Full build
pnpm run build
```

---

## Environment & Dependencies

**Node.js:** 24+  
**pnpm:** 9+  
**Rust:** 1.88.0 (via rustup)  
**wasm-pack:** 0.13.1  

**Key npm packages:**
- `vite@^7.3.2` — build + dev server
- `react@19.1.0` — UI framework
- `typescript@~5.9.3` — type checking
- `wasm-bindgen@0.2` — JS↔WASM bindings

**Key Rust crates:**
- `wasm-bindgen` — expose Rust to JS
- `serde` + `serde_json` — serialization
- `serde-wasm-bindgen` — bridge JSON between Rust and JS

---

## Known Gotchas

1. **WASM build fails:** Ensure `rustup toolchain install 1.88.0 --target wasm32-unknown-unknown`
2. **PORT/BASE_PATH required:** Vite config throws if env vars missing (set by `pnpm run dev`)
3. **wasm-pkg/ gitignored:** Don't commit generated files; regenerate via `build-wasm`
4. **DATABASE_URL for API:** Not used in Phase 2, but required if API server runs

---

## Metrics & Health

- **Bundle size:** WASM `.wasm` file should stay <500KB
- **Canvas FPS:** Target 60 FPS on graph redraw
- **Graph size:** Track max nodes/edges as players explore
- **Time-to-first-move:** <100ms from keystroke to rendered board

