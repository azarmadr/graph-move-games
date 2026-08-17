## Why

This change documents the current state and captures the specification of the 2048 + DAG Graph Visualizer application. The project is a Rust/WASM-based 2048 game where every board state across all game instances forms a shared global DAG (Directed Acyclic Graph), with real-time graph visualization alongside the board. The purpose of this spec is to accurately document the existing codebase, its current phase status, architectural decisions, and roadmap, serving as a foundation for future development and onboarding.

## What Changes

- **Documentation**: Capture the current app state, architecture, and roadmap in OpenSpec artifacts for maintainability and future reference.
- **Phase Tracking**: Document the 13-phase breakdown with current status (complete, in-progress, pending) for each phase.
- **Architecture Specification**: Formalize the Rust/WASM engine, TypeScript/React frontend, WASM boundary, DAG storage, and graph layout approach.
- **Roadmap Alignment**: Align the OpenSpec artifacts with the existing DESIGN.md phase breakdown and technical decisions.

## Capabilities

### New Capabilities

- `graph-model`: The content-addressed DAG board model with FNV-1a hashed BoardId/EdgeId, petgraph DiGraph storage, and EdgeKind (Move/Spawn) transitions.
- `wasm-bridge`: The typed JSON serialization layer between JavaScript and Rust/WASM, including `createGameWithConfig`, `makeMove`, `getGraph`, `exportGraph`, and `importGraph` functions.
- `graph-rendering`: The dagre-based graph layout engine and Canvas-based visualization of nodes (mini boards), edges (color-coded move/spawn), and interactive features (hover cards, selection, inspector).
- `instance-management`: Multi-game instance tracking with source/current board IDs, score, termination state, and autosave/Restore via localStorage.
- `input-handling`: Keyboard (Arrow keys/WASD), touch (swipe gestures), and button controls for game moves and board size selection.

### Modified Capabilities

- None at this time. This change captures the existing state without modifying existing spec requirements.

## Impact

- **Rust/WASM side** (`artifacts/game-2048/wasm-game/`): Engine struct, GraphStore, game logic (move_logic, spawn), types, and hash utilities.
- **TypeScript/React side** (`artifacts/game-2048/src/`): `wasmBridge.ts` type definitions, `game-app.ts` (main game loop, input, rendering), `graph-tab.ts` (DAG visualization with dagre).
- **API server** (`artifacts/api-server/`): Express server with routes, though currently not the primary focus (single-player, no persistence).
- **Build pipeline**: `vite.config.ts`, `scripts/build-wasm.mjs`, `pnpm-workspace.yaml`, Cargo.toml dependencies.
- **No breaking changes** - this is a documentation/specification change that preserves all existing behavior.