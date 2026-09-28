# Move graph layout to Rust/WASM using visgraph

## Problem

The current dagre.js layout in `dagLayout.ts` uses recursive DFS algorithms that blow the JS call stack on large graphs (>800 nodes). The `.3` saved graph (8746 nodes, 9042 edges) hits `RangeError: Maximum call stack size exceeded` in dagre's acyclic, order-init, and rank-util stages. This forces us to skip dagre entirely for large graphs and use force-graph's dag mode, which produces poor layouts.

Additionally, dagre layout on mid-size graphs (500-800 nodes) takes 2-8 seconds in JS, blocking the main thread.

Beyond the layout engine, the graph-related code across the frontend has grown without proper encapsulation. `GraphTab.ts` is 900+ lines mixing layout computation, force-graph wiring, canvas rendering, hover cards, inspector panel, and controls. `GraphData` lives in `wasmBridge.ts` despite only being consumed by the graph visualization. The graph tab controls are rendered as an absolute-positioned overlay eating ~20% of the canvas area with no way to collapse them. There is no way to switch between layout strategies at runtime.

## Solution

### 1. Move layout to Rust/WASM via visgraph

Replace the JS dagre layout with a Rust/WASM layout function using the `visgraph` crate (v0.1.0). visgraph provides a `hierarchical_layout` function that:

- Uses iterative algorithms (no recursive DFS, no stack overflow)
- Operates on `petgraph` graphs (already used by `game-core`)
- Returns normalized `(f32, f32)` position maps
- Supports top-down hierarchical orientation

The layout computation moves to the WASM crate, returned as part of `get_graph` when visgraph mode is requested. JS receives pre-computed positions in the same call that returns graph data.

### 2. Migrate GraphLayout from core to WASM crate

`GraphLayout` (the `nodes: Record<string, { board, x?, y? }> + edges: Record<string, Edge>` type) is a serialization format that only exists for the JS frontend boundary. It has no purpose inside `game-core`'s internal graph representation. Move it to the `game-wasm` crate where it belongs — it's a WASM bridge concern, not a domain concern. WASM types reuse `Board` and `EdgeKind` from game-core directly — no duplicate enums.

### 3. Create GraphLayout class

Extract graph data management from `GraphTab.ts` into a dedicated `GraphLayout` class that encapsulates:

- Node and edge data from WASM
- Layout computation (dagre / fg-dag / visgraph — dispatched by mode)
- Change detection (returns whether data changed on update)
- Position application (x/y to fx/fy for force-graph)

`GraphTab` keeps the DOM, force-graph instance, canvas rendering, hover cards, inspector, and controls. This makes the data logic testable without DOM or force-graph dependency.

### 4. Collapsible graph controls with layout selector

Redesign `GraphControls` to:

- Render as a collapsible panel (toggle button shows/hides the settings grid)
- Sit outside the canvas area (no more absolute positioning eating canvas space)
- Include a layout mode selector: `dagre | fg-dag | visgraph` as a segmented control
- Include existing controls: navigation markers, zoom, physics toggle

### 5. Layout enum and runtime switching

Introduce a `LayoutMode` enum (`dagre | fg-dag | visgraph`) that:

- Is exposed as a setting in GraphControls
- Drives the layout dispatch in GraphLayout
- Persists across graph data updates (user choice is respected)
- Defaults to `dagre` for small graphs, `visgraph` for large (auto-fallback)

### 6. Benchmark test page

Create `test/graph-layouts.html` — a standalone HTML page that:

- Loads the WASM module directly
- Loads a saved graph from `.data/` (user-selectable)
- Renders three side-by-side panels: dagre, fg-dag, visgraph
- Shows layout computation time for each
- Shows pass/fail badges against measurable thresholds
- Allows toggling between saved graphs

## Non-goals

- Changing the force-graph rendering pipeline (still uses force-graph for canvas)
- Changing the internal petgraph data model in game-core
- Adding visgraph's image/SVG rendering (only using its layout algorithms)
- Removing physics mode (kept as an additional option alongside layout modes)

## Why visgraph over dagre-rs

Both exist as Rust ports. visgraph is preferred because:

1. **Already uses petgraph 0.8** — same version as `game-core`, no dependency conflict
2. **Simpler API** — `hierarchical_layout(&graph, orientation)` returns a closure `NodeId -> (f32, f32)`, no need to build a separate graph structure
3. **Iterative algorithms** — no recursive DFS, handles large graphs without stack overflow
4. **Actively maintained** — published August 2026, 100% documented
5. **Optional extras** — force-directed, circular, bipartite layouts available if needed later

dagre-rs has its own `Graph` type that would require converting from petgraph, adding complexity.

## Impact

- `game-wasm` crate: add `visgraph` dependency, update `get_graph` to accept `prune_edges` and `layout_mode` params, own `GraphLayout` type (reuses game-core's `EdgeKind`)
- `game-core` crate: remove `GraphData` type (moved to wasm), internal graph unchanged
- JS `dagLayout.ts`: replaced by `GraphLayout` class, WASM layout for large graphs
- JS `GraphTab.ts`: reduced to thin shell, keeps force-graph and DOM
- JS `GraphControls.ts`: collapsible panel with layout mode selector
- New `test/graph-layouts.html`: benchmark page with measurable criteria
- Bundle size: visgraph adds ~50-100KB to WASM binary (estimate)
