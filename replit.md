# 2048 + DAG Graph Visualizer

A 2048 game where every board state across all game instances forms a global DAG (Directed Acyclic Graph), visualized in real time alongside the board. Built with Rust/WASM for game logic and JavaScript/Canvas for rendering.

## Run & Operate

- `pnpm run dev` — run the frontend (Vite, port 26141)
- `pnpm run build-wasm` — compile Rust crate → WASM pkg
- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build
- `cargo test -p game-core` — run Rust unit tests
- `just dev` — run the dev server (same as pnpm run dev)
- `just test` — run Rust tests (same as cargo test -p game-core)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Game logic**: Rust 1.88.0 + wasm-bindgen → WebAssembly
- **Frontend**: Vite (canvas rendering, no CSS framework needed for game UI)
- **WASM build**: wasm-pack 0.13.1 (see Gotchas for NixOS wrapper setup)
- **TUI**: ratatui + crossterm (terminal frontend)

## Where things live

- `src/` — Vite + vanilla TS frontend (canvas rendering)
- `crates/core/` — Pure Rust game logic (no I/O, no rendering)
- `crates/wasm/` — Thin WASM wrappers around core
- `crates/tui/` — Terminal frontend (ratatui)
- `public/wasm-pkg/` — wasm-pack output (gitignored)
- `scripts/build-wasm.mjs` — WASM build script

## Architecture decisions

- **Cargo workspace at root**: `core` (pure logic), `wasm` (JS bindings), `tui` (terminal)
- **Rust/WASM for game logic**: All move resolution, graph management, and spawn logic lives in Rust for correctness guarantees and performance. JS handles input, rendering, and timing only.
- **JSON over the WASM bridge**: Cross-boundary communication uses JSON-serialized structs (`serde` + `serde-wasm-bindgen`). Explicit, debuggable, and easy to version.
- **Client-side game state**: No server roundtrip for moves. The WASM module holds all state.
- **DAG as a global structure**: All game instances share a single node space. Nodes are board snapshots; edges carry direction/spawn metadata. No cycles by construction (moves only go forward).
- **Nodes are pure board states**: Per `model.md`, a node is just `{ nodeId, board }`. There is no `NodeKind` (Source/Regular/Sink); game frontier is tracked in the `GameInstance`.
- **Atomic transitions are two-step**: A valid move creates a `Move` edge from the current node to a merge node, then a `Spawn` edge from the merge node to the new current node. This matches the `extend_path` semantics in `model.md`.
- **Strong, content-addressed IDs**: `NodeId`, `EdgeId`, and `GameId` are strong newtypes over `u64` (not raw integers). Node IDs are board-content hashes; edge IDs hash `(from, to, kind)`. Same board state / transition always resolves to the same ID across runs and import/export cycles.
- **Graph export/import**: The full WASM engine state (graph snapshot + all game instances + nonce counter) can be serialized via `export_graph()` and restored via `import_graph(json)`. The UI exposes **Export** and **Import** buttons in the graph panel.
- **Canvas over DOM**: Both the board and graph are rendered on HTML `<canvas>` for pixel-level control needed in the graph visualization.

## Product

- Players play 2048 on a 4×4 board
- Every move and spawn creates nodes/edges in a global DAG
- The graph canvas shows all game instances simultaneously (color-coded by game)
- Hover tooltips show board snapshot previews and edge metadata
- Filtering highlights one game while dimming others
- Multiple concurrent game instances can be created and switched between

## Build pipeline

```
crates/core/ → crates/wasm/ → wasm-pack build → public/wasm-pkg/ → imported by Vite frontend
```

## Gotchas

- **WASM build**: The Nix environment provides `rustup` and `wasm-pack`. Run `rustup toolchain install 1.88.0 --target wasm32-unknown-unknown` once, then `pnpm run build-wasm` rebuilds cleanly via `rustup run 1.88.0 wasm-pack build`. No compiler wrappers or sysroots are committed.
- **Required env**: None for dev (game state is client-side only)
