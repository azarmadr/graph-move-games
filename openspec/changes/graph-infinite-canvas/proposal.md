## Why

When clicking the "Graph" tab, the page halts completely. This is a blocking operation happening during the tab switch itself, not during gameplay. Additionally, the graph canvas has a visible boundary that looks constrained, when it should appear infinite to match the DAG's unbounded nature. Settings and info elements should float over the graph.

The problem is twofold:
1. **Freeze on graph button**: `openGraphVisualization()` calls `getGraph()` and `exportGraph()` synchronously before rendering, which blocks the main thread for large DAGs.
2. **Visible boundary**: The graph has a visible canvas border/edge that breaks the infinite graph illusion.

## What Changes

- **Modular web components**: Extract monolithic `game-app` into self-contained custom elements: `<graph-tab>` (infinite canvas), `<graph-controls>` (floats over graph), `<game-board>`, `<score-display>`. Each owns its rendering and state.
- **Async graph loading**: Move graph fetch and layout computation so the Graph tab opens immediately with a skeleton, then fills in when the graph data arrives.
- **Infinite canvas look**: Remove visible canvas boundaries/borders. The graph canvas should render continuously without perceptible edges. Use overflow: visible or larger-than-viewport canvas.
- **Floating UI elements**: Settings, info, and controls float over the graph canvas (position: absolute/fixed). They layer on top of the graph without being confined by it.
- **Pan within graph**: When panning, the view should stay within the graph content bounds - never pan "outside" the graph into empty space. The graph itself is infinite in appearance, but panning is constrained to content.

## Capabilities

### New Capabilities

- `graph-async-loading`: Load graph data and perform dagre layout asynchronously so clicking the Graph tab doesn't freeze the UI. Initial render shows a skeleton; graph populates when ready.
- `graph-infinite-canvas`: Render the graph without visible canvas boundaries. The graph appears continuous and extends beyond the viewport. Settings/info elements float over the graph canvas. Panning is confined to graph content bounds.
- `modular-web-components`: Extract monolithic game-app into self-contained custom elements (graph-tab, graph-controls, game-board, score-display) that own their rendering and state.

### Modified Capabilities

- `graph-rendering`: Update render pipeline to support async layout, infinite canvas appearance, and floating UI elements.

## Impact

- **New modular WCs** in `artifacts/game-2048/src/`: `<graph-tab>`, `<graph-controls>`, `<game-board>`, `<score-display>` as separate custom element files
- **`artifacts/game-2048/src/game-app.ts`**: Becomes orchestrator only - delegates rendering to modular WCs
- **`artifacts/game-2048/src/index.css`**: Graph container CSS - remove visible borders/bounds, add overflow: visible, float settings elements over graph
- **No WASM bridge changes**: GraphData interface unchanged; only rendering behavior changes
- **No breaking changes to game logic or persistence**

## Non-Goals

- Does not change move logic, DAG storage, or WASM bridge
- Does not add Web Worker implementation (async loading uses setTimeout/requestAnimationFrame instead)
- Does not implement full zoom/pan animation (initial infinite canvas is static with content-constrained pan)