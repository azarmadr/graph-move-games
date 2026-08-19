## 1. Dependency Setup

- [x] 1.1 Install `force-graph` package via pnpm
- [x] 1.2 Verify force-graph imports correctly in the Vite bundle

## 2. Core force-graph Integration

- [x] 2.1 Rewrite `graph-tab.ts` render() to create a ForceGraph instance on the `.graph-infinite-container` element
- [x] 2.2 Map dagre layout output to force-graph `graphData({ nodes, links })` format with pre-computed x/y
- [x] 2.3 Disable d3-force forces (charge, center, link) to freeze dagre positions
- [x] 2.4 Configure force-graph dimensions to fill the container element

## 3. Canvas Node Rendering

- [x] 3.1 Implement `dominantTileColor(board)` helper: find highest-value tile, return its TILE_COLORS bg, or "#cdc1b4" for empty
- [x] 3.2 Implement `onNodeCanvasObject` callback with zoom-dependent branching: if globalScale < 0.5 draw dot (filled circle, radius ~12px, dominant color); else draw full board thumbnail (colored tile rectangles + value text)
- [x] 3.3 Implement `nodePointerAreaPaint` for hover/click hit detection on nodes (circle for dot mode, rectangle for thumbnail mode)
- [x] 3.4 Handle node selection visual state (border/glow for selected node) in the canvas callback

## 4. Canvas Edge Rendering

- [x] 4.1 Implement `onLinkCanvasObject` callback to draw edge lines using dagre waypoint coordinates
- [x] 4.2 Render arrowheads as canvas triangles at edge endpoints with appropriate colors (cyan/pink)

## 5. Interaction Wiring

- [x] 5.1 Wire `onNodeClick` callback to set selectedId and update inspector panel
- [x] 5.2 Wire `onLinkClick` callback to set selected edge and update inspector panel
- [x] 5.3 Wire `onNodeHover` callback to show/hide hover card DOM element
- [x] 5.4 Wire `onZoom` callback to update graph-controls zoom display

## 6. Zoom/Pan Migration

- [x] 6.1 Replace manual `setupPanZoom` / `applyTransform` with force-graph built-in zoom/pan
- [x] 6.2 Replace `centerOnGraph` with `forceGraph.zoomToFit()`
- [x] 6.3 Replace `centerOnNode` with `forceGraph.centerAt(x, y)`
- [x] 6.4 Replace `zoomBy` with `forceGraph.zoom(zoom * factor, 200)`
- [x] 6.5 Update `graph-controls.ts` zoom events to call force-graph API instead of dispatching custom events
- [x] 6.6 Update `graph-controls.ts` nav marker events to call `forceGraph.centerAt()`

## 7. Inspector and Hover Card

- [x] 7.1 Keep inspector `<details>` panel as DOM overlay, update event wiring from DOM to force-graph callbacks
- [x] 7.2 Keep hover card as DOM element, position near cursor using tracked mouse position

## 8. CSS Cleanup

- [x] 8.1 Remove `.graph-board-card`, `.graph-edge`, `.graph-canvas` transform styles from index.css
- [x] 8.2 Add styles for force-graph container (fills parent, no overflow hidden)
- [x] 8.3 Ensure inspector and hover card z-index layering over canvas is correct

## 9. Physics Toggle

- [x] 9.1 Add physics toggle button to `graph-controls.ts` UI
- [x] 9.2 Implement toggle logic: enable d3-force forces on, disable forces off
- [x] 9.3 Toggle `enableNodeDrag` based on physics mode state
- [x] 9.4 Dispatch `physics-mode` custom event for state tracking

## 10. Code Cleanup

- [x] 10.1 Remove `setupPanZoom`, `applyTransform`, `centerOnGraph`, `centerOnNode`, `zoomBy` methods
- [x] 10.2 Remove `bindEvents` method (DOM event wiring replaced by force-graph callbacks)
- [x] 10.3 Remove `boardThumbnail` HTML string generation function
- [x] 10.4 Remove SVG edge generation code (edgesSvg, marker definitions)
- [x] 10.5 Remove unused `DagLayout` type fields (keep dagre layout function, remove edge points if unused)
