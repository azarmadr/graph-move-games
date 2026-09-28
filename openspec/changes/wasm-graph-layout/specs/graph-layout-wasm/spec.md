## Purpose

Defines the WASM-exported graph data function with optional layout, the GraphLayout class, the collapsible controls with layout mode selector, and the benchmark test page.

## Requirements

### Requirement: WASM get_graph export

The system SHALL export a `get_graph` function from the WASM crate that returns graph data with positions optionally written into nodes.

#### Scenario: Graph data with visgraph layout
- **WHEN** `get_graph(false, "visgraph")` is called
- **THEN** the function builds GraphLayout from the current game state
- **THEN** visgraph layout is computed and `x`/`y` are written into each node
- **THEN** the function returns `{ nodes: { [key]: { board, x, y } }, edges: { [key]: { from, to, kind } } }` as JSON

#### Scenario: Graph data without layout
- **WHEN** `get_graph(false, "dagre")` or `get_graph(false, "fg-dag")` is called
- **THEN** nodes are returned without `x`/`y` fields
- **THEN** layout is computed client-side (dagre) or not needed (fg-dag)

#### Scenario: Empty graph
- **WHEN** `get_graph` is called with zero nodes
- **THEN** the function returns empty nodes and edges

### Requirement: Edge pruning (standalone)

The system SHALL provide a `prune_reverse_edges` function that removes bidirectional edges.

#### Scenario: Pruning function
- **WHEN** `prune_reverse_edges(&mut graph_data)` is called
- **THEN** for every pair of nodes (A, B) where both A→B and B→A edges exist, the B→A edge is removed
- **THEN** edges in only one direction are kept unchanged
- **THEN** the pruning does not affect longer cycles (A→B→C→A)

#### Scenario: Pruning is independent of layout mode
- **WHEN** `get_graph(true, "dagre")` is called
- **THEN** edges are pruned before layout computation
- **THEN** the caller controls pruning via the `prune_edges` boolean parameter

### Requirement: GraphLayout ownership in WASM crate

`GraphLayout` type SHALL be defined in and owned by the `game-wasm` crate, not `game-core`.

#### Scenario: GraphLayout type location
- **WHEN** `GraphLayout` is needed by the WASM bridge functions
- **THEN** it is defined in `crates/wasm/src/types.rs`
- **THEN** it reuses `Board` and `EdgeKind` from game-core (no duplicate enums)
- **THEN** `get_graph`, `export_graph`, and `import_graph` all use the wasm-crate `GraphLayout`

#### Scenario: Internal graph unchanged
- **WHEN** `game-core` manages the game graph internally
- **THEN** it continues using its `petgraph::DiGraph<Board, Edge>` representation
- **THEN** conversion to `GraphLayout` happens only at the WASM boundary

### Requirement: GraphLayout class

The system SHALL provide a `GraphLayout` class that encapsulates graph data, layout computation, and change detection.

#### Invariants
- All node keys follow the format `"board:{board_id}"`
- All edge keys follow the format `"edge:{edge_id}"`
- Every `edge.from` and `edge.to` must reference an existing node key
- `x`/`y` on nodes are absent when no layout has been computed
- `fx`/`fy` are `null` in fg-dag mode, set to `x`/`y` values otherwise

#### Scenario: Creation
- **WHEN** `GraphLayout` is created
- **THEN** it starts empty — no nodes, no edges, no layout mode
- **THEN** it is populated by the first `update()` call

#### Scenario: Data update
- **WHEN** `graphLayout.update(wasmData)` is called with WASM data
- **THEN** it merges nodes (board + optional x,y) and stores edges
- **THEN** if layoutMode is dagre and nodes have no x,y, computes dagre layout and writes positions

#### Scenario: Layout mode switching
- **WHEN** `graphLayout.setLayoutMode("visgraph")` is called
- **THEN** if nodes already have x,y (from WASM), positions are used
- **THEN** if not, computes dagre layout as fallback
- **THEN** fx/fy are set from x/y

#### Scenario: fg-dag mode
- **WHEN** `graphLayout.setLayoutMode("fg-dag")` is called
- **THEN** x/y are cleared from nodes
- **THEN** fx and fy are set to null on all nodes
- **THEN** force-graph uses its built-in dag mode

### Requirement: GraphTabElement incremental updates

`GraphTabElement` SHALL create the force-graph instance once and update it incrementally.

#### Scenario: First data load
- **WHEN** `graphData` is set for the first time
- **THEN** a new ForceGraph instance is created in the canvas host
- **THEN** canvas rendering callbacks are registered (node, link, hover, click)
- **THEN** `graphData()` is called with nodes and links

#### Scenario: Subsequent data update
- **WHEN** `graphData` is set with new data
- **THEN** `GraphLayout.update()` is called
- **THEN** `forceGraph.graphData()` is called with updated nodes and links
- **THEN** the force-graph diffs internally, no canvas teardown
- **THEN** camera position and zoom are preserved

#### Scenario: Layout mode change
- **WHEN** `layoutMode` is changed
- **THEN** `GraphLayout.setLayoutMode()` is called
- **THEN** `forceGraph.graphData()` is called with updated fx/fy values
- **THEN** force-graph is not destroyed or recreated

### Requirement: LayoutMode enum

The system SHALL define a `LayoutMode` type with three variants.

#### Scenario: Layout mode values
- **WHEN** layout mode is referenced
- **THEN** it is one of: `"dagre"`, `"fg-dag"`, `"visgraph"`
- **THEN** `"dagre"` uses JS dagre for hierarchical layout
- **THEN** `"fg-dag"` uses force-graph's built-in dag mode (no precomputed positions)
- **THEN** `"visgraph"` uses WASM visgraph for hierarchical layout

#### Scenario: Default layout mode
- **WHEN** no layout mode is specified
- **THEN** the default is `"dagre"`

#### Scenario: Auto-fallback
- **WHEN** graph node count exceeds 800 AND layout mode is `"dagre"`
- **THEN** the system automatically falls back to `"visgraph"` with a notification

### Requirement: Collapsible graph controls

The graph controls panel SHALL be collapsible and positioned outside the canvas area.

#### Scenario: Collapse toggle
- **WHEN** the user clicks the collapse/expand button on graph controls
- **THEN** the panel body (settings grid) toggles visibility
- **THEN** the toggle button remains always visible
- **THEN** the canvas area reclaims the freed space

#### Scenario: Positioning
- **WHEN** the graph tab is rendered
- **THEN** the controls panel sits outside the canvas in a flex layout
- **THEN** the canvas fills the remaining space
- **THEN** the controls do not overlay or eat into the canvas area

### Requirement: Layout mode selector in controls

The graph controls SHALL include a layout mode selector.

#### Scenario: Layout selector rendering
- **WHEN** graph controls are expanded
- **THEN** a "Layout" section is visible with three options: Dagre, Force Dag, Visgraph
- **THEN** the currently active layout mode is visually highlighted

#### Scenario: Layout mode change
- **WHEN** the user clicks a layout mode option
- **THEN** a `layout-change` event is emitted with `{ mode: LayoutMode }`
- **THEN** `GraphTab` receives the event and updates `GraphLayout.layoutMode`

### Requirement: Benchmark test page

A standalone HTML benchmark page SHALL exist at `test/graph-layouts.html`.

#### Scenario: Page structure
- **WHEN** the benchmark page is opened in a browser
- **THEN** it displays a single graph tab canvas panel driven by a layout mode selector
- **THEN** a graph selector dropdown lets the user choose which saved graph to load
- **THEN** an edge-pruning toggle lets the user compare pruned and unpruned graphs

#### Scenario: Vertical layout order
- **WHEN** the page is rendered
- **THEN** the controls row sits at the top of the page
- **THEN** the results table sits below the controls, wrapped in a `<details>` element that is collapsed by default
- **THEN** the graph tab panel is the last element in document order
- **THEN** the graph tab panel fills all remaining vertical space
- **THEN** the graph tab canvas is visible without scrolling

#### Scenario: Measurable criteria
- **WHEN** the `.3` graph (8746 nodes, 9042 edges) is loaded
- **THEN** the panel displays layout computation time in milliseconds
- **THEN** pass/fail badges are shown per metric against these thresholds:
  - Layout computation: Dagre < 5000ms, Visgraph < 500ms, Force Dag = 0ms
  - First render: Dagre < 3000ms, Visgraph < 1500ms, Force Dag < 1000ms
  - Pan/zoom frame rate: all modes >= 30fps
  - Peak JS heap: Dagre < 200MB, Visgraph < 150MB, Force Dag < 100MB
- **THEN** green badge = meets threshold, yellow = within 1.5x, red = exceeds

#### Scenario: Served via dev server
- **WHEN** the page is loaded
- **THEN** it is served by a dev server that transpiles the TypeScript component sources it imports
- **THEN** it loads the WASM module from `public/wasm-pkg/`
- **THEN** it requires no separate build step but does require a dev server
- **THEN** it is NOT openable directly via `file://`
