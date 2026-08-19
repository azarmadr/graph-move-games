## Why

The graph tab renders nodes as DOM `<button>` elements with CSS Grid tile thumbnails and edges as SVG `<path>` elements. Every interaction (hover, select, zoom) triggers a full `innerHTML` replacement of all nodes and edges. This breaks down at scale — 100+ nodes means 100+ absolutely-positioned buttons each containing 16-25 tile spans, all destroyed and recreated on every mouseenter. The rendering also contradicts the project's own DESIGN.md rationale for choosing Canvas over DOM for graph complexity.

## What Changes

- Replace SVG edges and DOM node buttons with a single HTML5 canvas via the `force-graph` library
- Keep dagre for hierarchical layout — feed pre-computed `{x, y}` positions to force-graph with d3-force physics disabled
- Draw board thumbnails (colored tile rectangles) directly on canvas via `onNodeCanvasObject` callback
- Draw edges with arrowheads on canvas via `onLinkCanvasObject` callback
- Replace manual pan/zoom (`setupPanZoom`, CSS transform) with force-graph's built-in d3-zoom
- Replace manual `centerOnGraph` / `centerOnNode` with force-graph's `zoomToFit` / `centerAt`
- Replace hover/select DOM event wiring with force-graph's `onNodeClick`, `onNodeHover` callbacks
- Keep the inspector panel (`<details>`) and graph-controls as DOM siblings overlaying the canvas
- Add an optional physics mode toggle that re-enables d3-force for live graph exploration

## Capabilities

### New Capabilities
- `graph-physics-toggle`: Optional toggle to enable/disable d3-force physics simulation for live graph exploration

### Modified Capabilities
- `graph-rendering`: Rendering backend changes from SVG+DOM to HTML5 Canvas via force-graph. Edge drawing, node rendering, hover cards, and selection highlighting are now canvas-based. Dagre layout requirement is unchanged.
- `graph-infinite-canvas`: Zoom/pan implementation changes from manual CSS transform to force-graph's built-in d3-zoom. Node navigation uses `centerAt`/`zoomToFit`. The UX requirements (no visible boundary, fills space, floating controls) are unchanged.

## Impact

- **Dependencies**: Add `force-graph` (npm). Remove direct dependency on manual DOM rendering (no new deps removed, `@dagrejs/dagre` stays).
- **Files**: `graph-tab.ts` (major rewrite of rendering), `graph-controls.ts` (simplified zoom API), `index.css` (remove graph-node/graph-edge DOM styles, add canvas container styles)
- **Graph data contract**: `GraphData` interface from `wasmBridge.ts` is unchanged — force-graph receives the same nodes/edges data, mapped to its `{nodes, links}` format
- **Performance**: Single canvas element replaces hundreds of DOM nodes. Hover/select are flag changes, not full re-renders.
