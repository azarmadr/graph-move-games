# 2048 + DAG Graph Visualizer

A 2048 game where every board state across all game instances forms a global DAG (Directed Acyclic Graph), visualized in real time alongside the board. Built with Rust/WASM for game logic and JavaScript/Canvas for rendering.

## Run & Operate

- `pnpm --filter @workspace/game-2048 run dev` — run the frontend (Vite, port 26141)
- `pnpm --filter @workspace/game-2048 run build-wasm` — compile Rust crate → WASM pkg
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Game logic**: Rust 1.88.0 + wasm-bindgen → WebAssembly
- **Frontend**: Vite + React (canvas rendering, no CSS framework needed for game UI)
- **WASM build**: wasm-pack 0.13.1 (see Gotchas for NixOS wrapper setup)
- **API**: Express 5 (minimal — game state lives in WASM/client)
- **DB**: PostgreSQL + Drizzle ORM (available, not used for game state)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (CJS bundle for API), Vite (frontend)

## Where things live

- `artifacts/game-2048/` — Vite + React frontend (canvas rendering)
- `artifacts/game-2048/wasm-game/` — Rust crate (game logic, compiled to WASM)
- `artifacts/game-2048/public/wasm-pkg/` — wasm-pack output (gitignored)
- `artifacts/game-2048/src/App.tsx` — main canvas rendering entry point
- `artifacts/api-server/src/` — Express API server (health + future endpoints)
- `lib/api-spec/openapi.yaml` — OpenAPI spec source of truth
- `lib/db/src/schema/` — Drizzle schema

## Architecture decisions

- **Rust/WASM for game logic**: All move resolution, graph management, and spawn logic lives in Rust for correctness guarantees and performance. JS handles input, rendering, and timing only.
- **JSON over the WASM bridge**: Cross-boundary communication uses JSON-serialized structs (`serde` + `serde-wasm-bindgen`). Explicit, debuggable, and easy to version.
- **Client-side game state**: No server roundtrip for moves. The WASM module holds all state; the API server is reserved for future persistence/multiplayer features.
- **DAG as a global structure**: All game instances share a single node space. Nodes are board snapshots; edges carry game ID + direction/spawn metadata. No cycles by construction (moves only go forward).
- **Canvas over DOM**: Both the board and graph are rendered on HTML `<canvas>` for pixel-level control needed in the graph visualization.

## Product

- Players play 2048 on a 4×4 board
- Every move and spawn creates nodes/edges in a global DAG
- The graph canvas shows all game instances simultaneously (color-coded by game)
- Hover tooltips show board snapshot previews and edge metadata
- Filtering highlights one game while dimming others
- Multiple concurrent game instances can be created and switched between

## Build pipeline (Phase 1 complete)

```
Rust crate (wasm-game/) → wasm-pack build → public/wasm-pkg/ → imported by Vite frontend
```

Phases: 1 ✅ Setup | 2 Data model | 3 Move logic | 4 Spawning | 5 Graph updates |
        6 Instance management | 7 JS bridge | 8 Board rendering | 9–10 Graph rendering |
        11 Interactivity | 12 Performance | 13 Final integration

## User preferences

- Phase-by-phase delivery — stop after each phase and wait for feedback before continuing.

## Gotchas

- **WASM build**: The Nix environment provides `rustup` and `wasm-pack`. Run `rustup toolchain install 1.88.0 --target wasm32-unknown-unknown` once, then `pnpm --filter @workspace/game-2048 run build-wasm` rebuilds cleanly via `rustup run 1.88.0 wasm-pack build`. No compiler wrappers or sysroots are committed.
- **Required env**: `DATABASE_URL` — Postgres connection string (for API server)
- **Run `pnpm --filter @workspace/api-spec run codegen`** after any OpenAPI spec change

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
