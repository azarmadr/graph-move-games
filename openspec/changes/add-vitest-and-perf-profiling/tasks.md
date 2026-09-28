## 1. Refactor — Extract Shared Utilities

- [x] 1.1 Create src/theme.ts — extract TILE_COLORS and fallback color constant
- [x] 1.2 Create src/types.ts — extract MoveResult type and shared component types
- [x] 1.3 Create src/canvas-utils.ts — extract buildGrid(), drawTile(), drawNodeHighlight()
- [x] 1.4 Create src/events.ts — extract dispatchEvent helper with bubbles+composed
- [x] 1.5 Update game-board.ts to use shared theme, types, canvas-utils, events
- [x] 1.6 Update graph-tab.ts to use shared theme, canvas-utils, events
- [x] 1.7 Update score-display.ts to use shared types, events
- [x] 1.8 Update graph-controls.ts to use shared events
- [x] 1.9 Verify build still passes after refactoring

## 2. Setup — Vitest

- [x] 2.1 Install vitest and happy-dom dev dependencies
- [x] 2.2 Create vitest.config.ts (extending vite.config.ts, no PORT/BASE_PATH requirement)
- [x] 2.3 Add test script to package.json
- [x] 2.4 Add just test and just bench commands to justfile

## 3. Performance Profiling

- [x] 3.1 Create src/bench/perf.ts with performance.now() wrappers (measure, measureAsync)
- [x] 3.2 Add graph layout profiling: measure makeDagLayout() execution time
- [x] 3.3 Add WASM bridge latency profiling: measure getGraph() round-trip time
- [x] 3.4 Add render profiling: measure initForceGraph() and renderNodeCanvas() time
- [x] 3.5 Create src/bench/run.ts that runs all profiles and prints results

## 4. Initial Tests

- [x] 4.1 Create src/__tests__/theme.test.ts — test TILE_COLORS has all expected keys
- [x] 4.2 Create src/__tests__/canvas-utils.test.ts — test buildGrid() produces correct grid
- [x] 4.3 Create src/__tests__/events.test.ts — test dispatchEvent helper
- [x] 4.4 Create src/__tests__/game-board.test.ts — test board canvas renders without error
- [x] 4.5 Create src/__tests__/game-app.test.ts — test game-app custom element mounts

## 5. Verification

- [x] 5.1 Run just test and verify all tests pass
- [x] 5.2 Run just bench and verify profiling output
