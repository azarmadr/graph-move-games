## Context

The project uses Vite 8, custom web components (`<game-app>`, `<game-board>`, `<graph-tab>`), and a Rust/WASM game engine. There are no JS/TS tests. Rust tests exist inline in `crates/core`. The `tsconfig.json` already excludes `**/*.test.ts`.

## Goals / Non-Goals

**Goals:**
- Vitest with browser mode for testing web components in a real browser (not jsdom)
- Performance profiling utilities for measuring render times and WASM bridge latency
- Test infrastructure that works alongside existing Rust tests via `just`
- Initial tests covering: game move, graph data update, board canvas render

**Non-Goals:**
- Visual regression testing (screenshot comparison)
- E2E testing with Playwright (user confirmed game works on mobile)
- CI/CD pipeline setup
- Testing the WASM Rust code (already has `cargo test`)
- Testing d3/force-graph rendering (too complex to mock, use profiling instead)

## Decisions

### Extract shared utilities before adding tests
**Choice**: Refactor duplications into shared modules first, then test the deduplicated code  
**Rationale**: 12+ duplications identified (TILE_COLORS, canvas patterns, event dispatch, types). Extracting them first means tests exercise shared code once, not copies.

### Module structure
- `src/theme.ts` — TILE_COLORS constant, fallback color
- `src/types.ts` — MoveResult type, shared interfaces
- `src/canvas-utils.ts` — buildGrid(), drawTile(), drawNodeHighlight()
- `src/events.ts` — dispatchEvent helper wrapping `{ bubbles: true, composed: true }`

### Use Vitest with happy-dom instead of browser mode
**Choice**: Vitest with `happy-dom` environment instead of `@vitest/browser`  
**Rationale**: happy-dom has good Shadow DOM and custom element support. No Playwright binary needed. Tests run fast in Node. `vitest preview` serves results on localhost if visual inspection is needed.

### Keep Vitest config separate from Vite config
**Choice**: `vitest.config.ts` extending `vite.config.ts`  
**Rationale**: The main `vite.config.ts` requires `PORT` and `BASE_PATH` env vars that tests don't need. A separate config avoids requiring those vars for `just test`.

### Use `performance.now()` for profiling, not a library
**Choice**: Simple `performance.now()` wrappers instead of a benchmarking library  
**Rationale**: The project needs targeted measurements (render time, WASM call latency), not micro-benchmarking. A lightweight utility module is sufficient. Can upgrade to `vitest bench` later if needed.

### Profile at the component boundary, not inside force-graph
**Choice**: Measure `initForceGraph()`, `makeDagLayout()`, and `renderNodeCanvas()` execution time  
**Rationale**: force-graph is a black box. Profiling at component boundaries catches regressions from our code without depending on internal force-graph implementation details.

## Risks / Trade-offs

**[Trade-off] happy-dom doesn't support canvas** → Mitigation: Test graph structure (node count, edge count) and component mounting, not pixel output. Use profiling for performance assertions.

**[Risk] Canvas tests are flaky** → Mitigation: Mock canvas context in tests that don't need real rendering. Use `getContext('2d')` stub.

**[Risk] WASM loading in test environment** → Mitigation: Mock `loadWasm` in tests that don't need the engine. Tests that need real WASM can use the built `public/wasm-pkg/` files.

## Migration Plan

1. Add vitest + @vitest/browser dev dependencies
2. Create `vitest.config.ts`
3. Add `just test` and `just bench` commands
4. Write initial test suites
5. No rollback needed — additive only
