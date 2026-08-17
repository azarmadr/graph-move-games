## 1. Modular Web Components (Phase 1)

- [x] 1.1 Create `<graph-tab>` custom element: accepts graph-data, games, active-game-id properties; manages its own dagre layout and SVG rendering
- [x] 1.2 Create `<graph-controls>` custom element: renders hop filter buttons, legend, info; communicates filter changes via custom events
- [x] 1.3 Create `<game-board>` custom element: accepts game-state property; handles canvas rendering, keyboard/touch/button input internally; emits move events
- [x] 1.4 Create `<score-display>` custom element: accepts score and game-state properties; renders score, status, messages
- [x] 1.5 Refactor `game-app.ts` into thin orchestrator: initializes WASM, manages game state, passes state down to child WCs, listens for events
- [x] 1.6 Register all new custom elements in `main.ts`

## 2. Async Graph Loading (Phase 2)

- [ ] 2.1 Add skeleton/loading state to `<graph-tab>`: render skeleton placeholder immediately on connection
- [ ] 2.2 Make `openGraphVisualization()` async: call getGraph()/exportGraph() via Promise.all without blocking UI
- [ ] 2.3 Schedule dagre layout via setTimeout(0) or requestAnimationFrame after data arrives
- [ ] 2.4 Render graph nodes/edges in a single batch after layout completes (no incremental rendering)
- [ ] 2.5 Add loading state transitions: skeleton → loading → ready → error
- [ ] 2.6 Add error handling: catch fetch/layout failures and show error state

## 3. Infinite Canvas (Phase 3)

- [ ] 3.1 Remove visible canvas boundaries: no border, outline, or edge on graph container
- [ ] 3.2 Set overflow: visible on graph container so content extends beyond viewport
- [ ] 3.3 Set canvas dimensions to 100% width/height of viewport or parent container
- [ ] 3.4 Ensure graph background blends with page (transparent or matching color)
- [ ] 3.5 Position graph nodes/edges relative to viewport origin (center on active game)
- [ ] 3.6 Calculate content bounds from dagre node positions (min/max x/y + node dimensions)
- [ ] 3.7 Implement pan confinement: clamp panning at content boundaries, never show empty space
- [ ] 3.8 Center graph on active game's current board on initial load
- [ ] 3.9 Recalculate content bounds on hop filter change or new graph data

## 4. Floating UI Elements (Phase 4)

- [ ] 4.1 Position `<graph-controls>` with position: absolute relative to graph container
- [ ] 4.2 Set z-index: 10+ on graph-controls so it layers above the graph
- [ ] 4.3 Ensure graph-controls does not affect graph pan/zoom or content bounds
- [ ] 4.4 Test graph-controls remains visible and interactive when graph content is underneath

## 5. Integration & Verification (Phase 5)

- [ ] 5.1 Verify graph tab opens without page freeze (async loading works)
- [ ] 5.2 Verify graph appears infinite (no visible canvas boundary)
- [ ] 5.3 Verify settings/info float over the graph without affecting bounds
- [ ] 5.4 Verify pan stays within graph content (no empty space visible)
- [ ] 5.5 Verify hop filter changes recalculate bounds and re-center
- [ ] 5.6 Verify all modular WCs work together without regressions to board rendering or move logic