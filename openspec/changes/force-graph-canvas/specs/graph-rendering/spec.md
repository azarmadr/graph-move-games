## MODIFIED Requirements

### Requirement: dagre graph layout

The system SHALL use dagre to layout the DAG in a top-down (rankdir: TB) hierarchical layout, and feed the resulting positions to force-graph for canvas rendering.

- **WHEN** makeDagLayout(graphData) is called with GraphData
- **THEN** dagre.graphlib.Graph is configured with directed: true, multigraph: true, rankdir: "TB", align: "UL", nodesep: 48, ranksep: 92, edgesep: 24, marginx: 56, marginy: 56
- **THEN** each board node is set with width: NODE_SIZE (104px) and height: NODE_SIZE (104px)
- **THEN** dagre.layout(layout) is called to compute positions
- **THEN** the returned layout has width/height, positioned nodes, and positioned edges
- **THEN** node positions are mapped to force-graph node objects with pre-computed x, y coordinates

### Requirement: Edge color-coding

The system SHALL color-code edges based on their kind: cyan for Move edges, pink for Spawn edges.

- **WHEN** edgeColor(edge) is called with an Edge containing kind.Move or kind.Spawn
- **THEN** if edge.kind.Move, return "#4cc9f0" (cyan); if edge.kind.Spawn, return "#f72585" (pink)

### Requirement: Board thumbnail rendering

The system SHALL render mini board thumbnails for each graph node by drawing colored tile rectangles and value text directly on the HTML5 canvas, with zoom-dependent detail levels.

#### Scenario: Zoomed out — dot mode
- **WHEN** a node is rendered on canvas via onNodeCanvasObject callback AND globalScale < 0.5
- **THEN** the system draws a filled circle (radius ~12px) using the dominant tile color from the board
- **THEN** the dominant tile color is the TILE_COLORS background of the highest-value tile on the board, or "#cdc1b4" for empty boards

#### Scenario: Zoomed in — thumbnail mode
- **WHEN** a node is rendered on canvas via onNodeCanvasObject callback AND globalScale >= 0.5
- **THEN** the system draws a grid of filled rectangles with TILE_COLORS background colors
- **THEN** tile value text is drawn centered in each cell using the tile's foreground color

#### Scenario: Pointer area
- **WHEN** nodePointerAreaPaint is called for a node
- **THEN** the painted hit area matches the current render mode (circle for dot mode, rectangle for thumbnail mode)

### Requirement: Hover cards

The system SHALL display hover cards showing board summary when a node is hovered.

- **WHEN** force-graph fires onNodeHover with a node
- **THEN** a floating DOM element appears near the cursor showing "Board [summary]" and board summary text
- **WHEN** onNodeHover fires with null (mouse leaves)
- **THEN** the hover card is removed

### Requirement: Node selection and inspection

The system SHALL allow selecting a node to inspect its canonical data in the aside inspector.

- **WHEN** force-graph fires onNodeClick with a node
- **THEN** the selectedId is set and the inspector displays the selected board's ID, dimensions, and tile summary
- **WHEN** force-graph fires onLinkClick with a link
- **THEN** the selected edge is displayed in the inspector with edge label (e.g., "Move Up", "Spawn 2, 4")
