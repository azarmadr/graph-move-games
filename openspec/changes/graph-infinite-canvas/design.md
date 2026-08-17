## Context

The current `game-app.ts` is a monolithic custom element that handles everything: WASM loading, game state, board rendering, graph rendering, tab switching, and input handling. When the user clicks "Graph", `openGraphVisualization()` calls `getGraph()` and `exportGraph()` synchronously, which blocks the main thread for large DAGs. The graph canvas has visible borders/bounds that break the infinite graph illusion.

Key constraints from existing specs:
- `GraphData` interface (nodes/edges HashMap) stays unchanged
- `wasmBridge.ts` types unchanged
- dagre layout algorithm stays the same
- petgraph DiGraph content-addressed deduplication unchanged
- TILE_COLORS, edge color-coding (cyan/pink), arrow markers unchanged

## Goals / Non-Goals

**Goals:**
- Extract monolithic game-app into modular, self-contained custom elements
- Remove visible graph canvas boundaries for infinite appearance
- Prevent page freeze when clicking Graph tab via async loading
- Allow settings/info to float over the graph without affecting its bounds
- Confine panning to graph content bounds

**Non-Goals:**
- Does not change WASM bridge, game logic, or persistence
- Does not add Web Worker (async uses setTimeout/requestAnimationFrame)
- Does not implement full zoom/pan animation framework

## Decisions

### Why modular custom elements
- game-app.ts is 488 lines handling everything - violates single responsibility
- Modular WCs are independently testable, reusable, and replaceable
- Each WC owns its rendering and state, making the system more maintainable
- Custom elements with shadow DOM provide encapsulation without framework overhead

### Why async loading with setTimeout/requestAnimationFrame
- Web Workers add complexity (message passing, no DOM access in worker)
- setTimeout(0) or requestAnimationFrame breaks long tasks into chunks
- Keeps the implementation simple and maintainable
- Can upgrade to Web Worker later if needed

### Why no visible canvas boundary
- Visible borders/edges indicate the canvas extent, breaking infinite graph illusion
- overflow: visible lets content extend beyond the container naturally
- Background blending (transparent or matching page) creates seamless appearance
- Settings/info float on top via position: absolute, not affecting graph bounds

### Why content-confinement as part of infinite canvas
- The graph is infinite in appearance - panning "outside" the graph should be impossible
- Content bounds are calculated from dagre node positions, not canvas size
- Viewport always shows valid graph content, never empty space
- This is not a separate capability but an intrinsic behavior of the infinite canvas

## Risks / Trade-offs

- **[Risk]: Initial complexity** - Modular WCs add more files and ceremony. Mitigation: each WC is small (< 200 lines), benefits outweigh costs.
- **[Risk]: Async rendering jank** - setTimeout/requestAnimationFrame may cause brief visual glitches. Mitigation: skeleton → smooth transition, single-batch rendering after layout.
- **[Risk]: Content bounds miscalculation** - Incorrect bounds could cause pan drift or visual artifacts. Mitigation: recalculate bounds on every filter change and data update.
- **[Trade-off]: Simplicity vs. extensibility** - Modular WCs add upfront complexity but make future features (save graph state, multiplayer sync) much easier.

## Open Questions

- Should the graph-tab expose its loading state via a public API (e.g., `graphTab.loadingState`)? This would let the orchestrator show a progress indicator.
- What should happen if the graph has zero nodes? Should it show an empty state or just the skeleton?
- Should the hop filter controls be inside graph-tab or graph-controls? If graph-controls, how does it communicate with graph-tab (custom events vs. shared state)?
- What's the default hop distance for initial render? (Suggested: 1, showing only immediate neighbors)
- Should pan position be remembered between tab switches, or always center on active game?