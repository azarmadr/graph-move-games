## Purpose

Defines the infinite canvas rendering system where the graph appears continuous without visible boundaries, settings/info elements float over the graph, and users navigate to nodes via markers and zoom controls.

## ADDED Requirements

### Requirement: No visible canvas boundary

The system SHALL render the graph without visible borders, edges, or boundaries that indicate the canvas extent.

- **WHEN** the graph-tab renders the graph canvas
- **THEN** no border, outline, or edge is visible on the container
- **THEN** the canvas extends beyond the viewport with overflow: visible
- **THEN** the background blends seamlessly with the surrounding page (or is transparent)

### Requirement: Graph fills available space

The system SHALL size the graph canvas to fill the available viewport width/height.

- **WHEN** the graph-tab renders
- **THEN** the graph canvas dimensions match the viewport or parent container (100% width, 100% height)
- **THEN** the graph content (nodes/edges) is positioned relative to the viewport origin, not a fixed canvas origin

### Requirement: Floating settings/info elements

The system SHALL render settings, info, and controls as separate elements that float over the graph canvas.

- **WHEN** the graph-tab renders controls (hop filter, legend, etc.)
- **THEN** these elements are positioned with position: absolute or position: fixed relative to the graph container
- **THEN** they layer on top of the graph (z-index: 10+) without being clipped by the graph's overflow
- **THEN** they do not affect the graph's pan/zoom or content bounds

### Requirement: Node navigation markers

The system SHALL provide navigation buttons that center the viewport on specific graph nodes.

- **WHEN** the graph-tab renders the graph overview
- **THEN** navigation marker buttons are visible (e.g., "Active game", "Root")
- **WHEN** the user clicks a navigation marker
- **THEN** the viewport centers on the corresponding node
- **THEN** the node is positioned at the center of the visible area

### Requirement: Zoom controls

The system SHALL provide zoom in/out controls in the graph-controls panel.

- **WHEN** the graph-tab renders the graph overview
- **THEN** zoom in and zoom out buttons are visible in graph-controls
- **WHEN** the user clicks zoom in
- **THEN** the graph scale increases by a fixed step
- **WHEN** the user clicks zoom out
- **THEN** the graph scale decreases by a fixed step
- **THEN** the zoom level is bounded between a minimum and maximum (e.g., 0.2x to 3x)

### Requirement: Center on active game

The system SHALL center the graph on the active game's current board on initial load and after filter changes.

- **WHEN** the graph renders or the hop filter changes
- **THEN** the viewport centers on the active game's current board node
- **THEN** the active node is positioned at the center of the visible area
- **WHEN** new graph data arrives (after moves)
- **THEN** the viewport remains centered on the active game