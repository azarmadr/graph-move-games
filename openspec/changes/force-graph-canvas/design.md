## Context

The graph tab (`graph-tab.ts`) currently renders the DAG using a hybrid SVG+DOM approach: SVG `<path>` elements for edges, absolutely-positioned `<button>` elements for nodes (each containing a CSS Grid of tile `<span>`s), and CSS `transform` for pan/zoom. Every interaction (hover, select, zoom) triggers a full `innerHTML` replacement. This degrades quickly beyond ~50 nodes.

The graph is a DAG of board states connected by Move/Spawn transitions, laid out by dagre in a top-down hierarchical configuration. The `GraphData` interface from `wasmBridge.ts` provides `{ nodes: {[BoardId]: Board}, edges: {[EdgeId]: Edge} }`.

## Goals / Non-Goals

**Goals:**
- Replace SVG+DOM rendering with a single HTML5 canvas via `force-graph`
- Keep dagre for deterministic hierarchical layout
- Preserve all existing UX: hover cards, inspector, zoom controls, nav markers, edge color-coding, arrow markers
- Enable optional physics mode for live exploration
- Reduce render cost from O(N) DOM operations to O(1) canvas paint per frame

**Non-Goals:**
- Changing the WASM bridge, graph model, or game logic
- Changing the graph data structure or dagre layout parameters
- Implementing virtualization (not needed with canvas)
- Changing graph-controls UI layout (only wiring changes)
- WebGL or 3D rendering

## Decisions

### 1. dagre layout → force-graph with frozen physics

**Decision**: Keep dagre for computing node positions. Feed `{x, y}` from dagre into force-graph nodes. Disable all d3-force forces (`d3Force("charge", null)`, etc.) so positions are frozen.

**Alternatives considered**:
- *Use force-graph's dagMode("td")*: Physics-based DAG layout. Nodes jiggle on load and don't produce the crisp hierarchy dagre gives. Rejected — users expect deterministic positions.
- *Hybrid dagre initial + d3-force refinement*: More complex, marginal benefit. Can be achieved later via the physics toggle if desired.

**Rationale**: dagre produces exact hierarchical positions. force-graph becomes a pure canvas renderer with built-in zoom/pan/hover.

### 2. Canvas node rendering — zoom-dependent detail

**Decision**: In `onNodeCanvasObject`, check `globalScale` (passed by force-graph as the third argument). Below scale 0.5, render a filled circle using the dominant tile color. At scale 0.5+, render the full board thumbnail (grid of colored tile rectangles with value text). Use `nodePointerAreaPaint` for hit detection at both levels.

**Dominant tile color**: Find the highest-value tile on the board. Use its `TILE_COLORS` entry for the circle fill. Empty boards use "#cdc1b4".

**Alternatives considered**:
- *Offscreen pre-render per board → createImageBitmap*: Faster per-frame (single drawImage call), but adds memory pressure for N unique boards and cache invalidation complexity. Overkill for 104x104px nodes with ~16 rects each.
- *Fixed detail level (always full thumbnail)*: At low zoom, 100+ tiny board grids become visual noise. Dots are cleaner.

**Rationale**: At 200 nodes × 16 tiles = 3,200 fillRect calls per frame is trivial for canvas 2D. Zoom-dependent rendering reduces visual clutter when zoomed out and keeps rendering cheap at overview scale.

### 3. Canvas edge rendering with arrowheads

**Decision**: In `onLinkCanvasObject`, draw lines from dagre edge waypoints. Render arrowheads as small triangles at the end of each path using canvas path operations.

**Alternatives considered**:
- *SVG overlay for edges*: Maintains SVG arrow markers. Defeats the purpose of moving to canvas — still have DOM elements.

**Rationale**: Canvas arrows are straightforward (3-point triangle fill). The arrowhead color matches the edge color (cyan for Move, pink for Spawn), same as current SVG markers.

### 4. Hover cards and inspector as DOM overlay

**Decision**: The inspector (`<details>` panel) and hover card remain as DOM elements positioned over the canvas. force-graph's `onNodeHover` drives the hover card. Inspector is driven by `onNodeClick` / `onLinkClick`.

**Alternatives considered**:
- *Draw hover state on canvas*: No DOM needed, but tooltip text rendering on canvas is limited (no word wrap, no selection). Inspector must remain DOM anyway.

**Rationale**: Canvas for the graph, DOM for the UI chrome. Natural split.

### 5. Zoom/pan via force-graph built-in

**Decision**: Remove manual `setupPanZoom`, `applyTransform`, `centerOnGraph`, `centerOnNode`, `zoomBy`. Replace with force-graph's `zoom()`, `centerAt()`, `zoomToFit()`. Wire `onZoom` to update graph-controls zoom display.

**Alternatives considered**:
- *Keep manual CSS transform*: Would fight with force-graph's internal coordinate system. Pointless.

**Rationale**: force-graph's d3-zoom is battle-tested and handles the math correctly.

### 6. Physics toggle — re-enable forces on demand

**Decision**: Add a toggle in graph-controls. When activated, re-enable d3-force charge/center/link forces. When deactivated, disable forces and freeze nodes at current positions.

**Rationale**: Low-effort feature that adds exploration value. The force-graph API makes this trivial — just call `d3Force()` to add forces and `d3Force("charge", null)` to remove them.

## Risks / Trade-offs

- **[Risk] Canvas text rendering at different zoom levels** → Mitigation: Use `onRenderFramePre` callback to read current scale from canvas context and adjust font size dynamically. Force-graph passes `(ctx, scale)` to this callback.
- **[Risk] Edge waypoints from dagre are polyline segments, not smooth curves** → Mitigation: This matches current behavior. If curves are desired later, can interpolate through dagre waypoints with quadratic bezier in `onLinkCanvasObject`.
- **[Risk] force-graph adds ~30KB gzipped dependency** → Acceptable. It replaces manual pan/zoom/hover code that's similar in size.
- **[Trade-off] Hover card position** → force-graph doesn't expose cursor position in `onNodeHover`. Will need to track mouse position separately via `onRenderFramePre` or a lightweight mousemove listener on the canvas element. Minor complexity.
- **[Trade-off] Node drag in frozen mode** → By default, force-graph reheats simulation on drag. With forces disabled, dragging a node just moves it. Need to explicitly disable `enableNodeDrag` or handle the no-forces case to prevent orphaned nodes. Can set `enableNodeDrag(false)` in frozen mode and `enableNodeDrag(true)` in physics mode.

## Migration Plan

1. Install `force-graph` dependency
2. Rewrite `graph-tab.ts` render pipeline: dagre layout → force-graph initialization → canvas callbacks
3. Remove: `setupPanZoom`, `applyTransform`, `centerOnGraph`, `centerOnNode`, `zoomBy`, `bindEvents` (DOM event wiring), `boardThumbnail` HTML generation, SVG edge generation
4. Add: `onNodeCanvasObject`, `onLinkCanvasObject`, `onNodeHover`, `onNodeClick`, `onLinkClick`, `nodePointerAreaPaint`
5. Update `graph-controls.ts` zoom events to call force-graph API
6. Update CSS: remove `.graph-board-card`, `.graph-edge` styles, add `.graph-infinite-container` for force-graph host
7. Add physics toggle to `graph-controls.ts`

Rollback: Revert to previous `graph-tab.ts` and `graph-controls.ts`. No data model changes.

## Open Questions

- Should physics mode remember its state across tab switches, or reset each time the graph tab is opened?
- Should the hop distance filter actually filter nodes from the force-graph graphData, or is it visual-only (dim non-matching nodes)?
