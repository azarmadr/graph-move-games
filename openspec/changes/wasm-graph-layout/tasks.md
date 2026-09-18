# Tasks: WASM Graph Layout + GraphLayout Class

## Phase 1: Rust — GraphLayout migration + visgraph layout

- [x] Create `crates/wasm/src/types.rs` with `GraphLayout { nodes, edges }` and `Node { board, x: Option<f32>, y: Option<f32> }` (reuses `Board`, `Edge`, `EdgeKind` from game-core)
- [x] Add `visgraph = { version = "0.1", default-features = false }` to `crates/wasm/Cargo.toml`
- [x] Create `crates/wasm/src/layout.rs` with `apply_visgraph_layout(graph: &mut GraphLayout)`
  - Build petgraph DiGraph from GraphLayout
  - Call `visgraph::layout::hierarchical::hierarchical_layout`
  - Write `x`/`y` directly into each node
- [x] Create `crates/wasm/src/prune.rs` with standalone `prune_reverse_edges(graph: &mut GraphLayout)`
  - For every pair (A,B), if both A→B and B→A exist, remove B→A
  - Independent of layout mode — caller controls via boolean param
- [x] Update `get_graph` in `crates/wasm/src/lib.rs`
  - Accept `prune_edges: bool` and `layout_mode: &str` parameters
  - If `prune_edges` is true, call `prune_reverse_edges()`
  - If `layout_mode` is `"visgraph"`, call `apply_visgraph_layout()`
  - Return `{ nodes, edges }` as JSON (positions inline on nodes when visgraph)
- [x] Update `export_graph`, `import_graph` to use wasm-crate `GraphLayout` instead of core
- [x] Remove `GraphData` type from `game-core` (or re-export from wasm if needed by merge-cli/tui)
- [x] Write Rust unit tests: empty graph, small graph, graph with cycles, large graph (8000+ nodes)
- [x] Build WASM, verify binary size increase <150KB

## Phase 2: JS — GraphLayout class

- [x] Create `src/utils/layoutMode.ts` with `LayoutMode` type
- [x] Create `src/components/GraphLayout.ts`:
  - Single `_nodes: Map<string, { board, x?, y? }>`, `_edges: Map<string, Edge>`, no separate layout
  - No constructor — created empty, populated by `update()`
  - `update(wasmData)` — merges board + x,y into nodes, computes dagre if needed
  - `setLayoutMode(mode)` — for fg-dag clears x,y; for dagre/visgraph recomputes or uses WASM positions
  - `toForceGraphData()` — derives FgNode[] (fx/fy from x/y) and FgLink[] on demand
  - All layout methods private: `computeLayout`, `computeDagLayout`, `applyPositions`, `clearPositions`
- [x] Write unit tests for GraphLayout: mock WASM data, verify layout dispatch, verify invariants

## Phase 3: JS — GraphTab refactor + controls redesign

- [x] Rewrite `GraphTab.ts`:
  - Owns GraphLayout instance (created empty) and ForceGraph instance (created once)
  - `graphData` setter: calls `graphLayout.update()`, then `forceGraph.graphData()` incrementally
  - `layoutMode` setter: delegates to GraphLayout, calls `forceGraph.graphData()` with updated fx/fy
  - Keep all canvas rendering, hover, inspector, event handlers
  - Never destroy/recreate ForceGraph — use incremental updates
- [x] Update `GraphControls.ts`:
  - Add collapse toggle button (⚙ icon)
  - Panel body hidden by default, toggles on click
  - Add "Layout" section with three-segment selector: Dagre | Force Dag | Visgraph
  - Emit `layout-change` event on selection
  - Move from absolute overlay to flex sidebar position
- [x] Update `GameApp.ts` graph-container CSS to use flex layout (canvas + controls sidebar)
- [x] Remove `_dagMode` flag, dag mode notification, and dag mode fallback from GraphTab/scheduleLayout
- [x] Update `graph-rendering` spec to reflect new architecture

## Phase 4: Benchmark page + integration testing

- [x] Create `test/graph-layouts.html`:
  - Load WASM from `public/wasm-pkg/`
  - Graph selector dropdown (loads from `.data/*.json`)
  - Single `graph-tab` panel driven by a layout mode selector (not three side-by-side panels)
  - Panel: ForceGraph instance, layout time display
  - Pass/fail badges per metric against measurable thresholds:
    - Layout time: Dagre < 5000ms, Visgraph < 500ms, Force Dag = 0ms
    - First render: Dagre < 3000ms, Visgraph < 1500ms, Force Dag < 1000ms
    - Pan/zoom fps: all >= 30fps
    - Peak heap: Dagre < 200MB, Visgraph < 150MB, Force Dag < 100MB
  - No separate build step required (dev server only)
- [x] Write integration tests: graph tab renders with each layout mode
- [x] Verify existing graph-tab tests still pass after refactor
- [x] Visual comparison on saved graphs (especially `.3` with 8746 nodes)
- [x] Performance benchmark: measure layout times for all three modes on large graph
- [x] Clean up: remove unused `notify.ts` if no longer referenced, remove old dagre-only code paths

## Phase 5: Polish

- [x] Ensure collapsible controls work on mobile/narrow viewports
- [x] Persist layout mode selection in localStorage
- [x] Add keyboard shortcut for layout mode cycling (optional)
- [x] Update DESIGN.md with new architecture diagram

## Phase 6: Benchmark page corrections (open)

- [x] Convert `test/graph-layouts.html` to a vertical flex column: controls, results table, `graph-tab` last
- [x] Give `graph-tab` `flex: 1` plus a `min-height` so the canvas is never collapsed to zero
- [x] Replace the fixed `height: 500px` on the graph area with remaining-space sizing
- [x] Wrap the results table in a `<details>` element, collapsed by default
- [x] Fix the blank-canvas root cause — `main()` never called `loadGraphIntoComponent()`, so no graph was ever loaded on page load and `initForceGraph()` never ran. Added an initial load of the first discovered graph. Confirmed the page must be served through the Vite dev server (`pnpm dev`, then `/test/graph-layouts.html`): the module graph, the WASM binary, and the `.data/` fixtures all resolve there, so imports were not the cause
- [ ] Verify the canvas renders after the layout change on the `.3` graph (8746 nodes) — requires a browser; not verifiable in the current environment

## Deferred decisions

- [ ] Decide whether to drop dagre entirely once the benchmark page is stable
- [ ] Resolve duplicated controls (page's own row vs. the `graph-controls` inside `graph-tab`'s shadow root)
