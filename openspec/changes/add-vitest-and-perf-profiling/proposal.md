## Why

The project has zero JavaScript/TypeScript tests and no performance benchmarks. Every code change risks silent regressions in game logic, graph rendering, and WASM bridge behavior. Additionally, there are 12+ code duplications across components (TILE_COLORS, canvas rendering patterns, event dispatch, type annotations). We need to extract shared utilities and components before adding tests, so tests exercise deduplicated code.

## What Changes

- Extract shared utilities: TILE_COLORS, canvas drawing helpers, event dispatch, MoveResult type
- Extract shared component base class for common lifecycle/property patterns
- Add Vitest with happy-dom environment for testing web components
- Add performance profiling utilities for measuring render times, WASM bridge latency, and graph layout computation
- Add initial test suites covering core game flows (move, graph update, board render)
- Add a `just test` command for running JS tests alongside existing Rust tests
- Add a `just bench` command for running performance benchmarks

## Capabilities

### New Capabilities

(none — this is pure tooling/infrastructure, no spec-level behavior changes)

### Modified Capabilities

(none)

## Impact

- `package.json`: Add `vitest`, `@vitest/browser` dev dependencies
- `vite.config.ts`: Add Vitest configuration (test block)
- `tsconfig.json`: Add test file includes
- `justfile`: Add `test` and `bench` commands
- New files: `vitest.config.ts`, `src/__tests__/`, `src/bench/`
