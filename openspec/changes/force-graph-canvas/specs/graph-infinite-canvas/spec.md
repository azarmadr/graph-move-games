## MODIFIED Requirements

### Requirement: No visible canvas boundary

The system SHALL render the graph without visible borders, edges, or boundaries that indicate the canvas extent.

#### Scenario: No visible boundary
- **WHEN** the graph-tab renders the graph canvas
- **THEN** no border, outline, or edge is visible on the force-graph container
- **AND** the canvas extends to fill the viewport without visible edges

### Requirement: Graph fills available space

The system SHALL size the force-graph canvas to fill the available viewport width/height.

#### Scenario: Canvas fills viewport
- **WHEN** the graph-tab renders
- **THEN** the force-graph canvas dimensions match the parent container (100% width, 100% height)
- **AND** force-graph handles all coordinate transforms internally

### Requirement: Floating settings/info elements

The system SHALL render settings, info, and controls as separate elements that float over the graph canvas.

#### Scenario: Controls float over graph
- **WHEN** the graph-tab renders controls (hop filter, legend, etc.)
- **THEN** these elements are positioned with position: absolute or position: fixed relative to the graph container
- **AND** they layer on top of the force-graph canvas (z-index: 10+) without being clipped
- **AND** they do not affect the graph's pan/zoom or content bounds

### Requirement: Node navigation markers

The system SHALL provide navigation buttons that center the viewport on specific graph nodes.

#### Scenario: Navigate to node
- **WHEN** the graph-tab renders the graph overview
- **THEN** navigation marker buttons are visible (e.g., "Active game", "Root")
- **WHEN** the user clicks a navigation marker
- **THEN** force-graph's centerAt API centers the viewport on the corresponding node

### Requirement: Zoom controls

The system SHALL provide zoom in/out controls in the graph-controls panel.

#### Scenario: Zoom in and out
- **WHEN** the graph-tab renders the graph overview
- **THEN** zoom in and zoom out buttons are visible in graph-controls
- **WHEN** the user clicks zoom in
- **THEN** force-graph's zoom API increases the scale by a fixed step with animation
- **WHEN** the user clicks zoom out
- **THEN** force-graph's zoom API decreases the scale by a fixed step with animation
- **AND** the zoom level is bounded between a minimum and maximum (e.g., 0.2x to 3x)

### Requirement: Center on active game

The system SHALL center the graph on the active game's current board on initial load and after filter changes.

#### Scenario: Center on active game
- **WHEN** the graph renders or the hop filter changes
- **THEN** force-graph's zoomToFit or centerAt centers the viewport on the active game's current board node
- **WHEN** new graph data arrives (after moves)
- **THEN** the viewport remains centered on the active game
