## MODIFIED Requirements

### Requirement: Edge color-coding

The system SHALL color-code edges based on their kind: cyan for Swipe edges, pink for Spawn edges.

#### Scenario: Edge color assignment
- **WHEN** edgeColor(edge) is called with an Edge containing kind.Swipe or kind.Spawn
- **THEN** if edge.kind.Swipe, return "#4cc9f0" (cyan); if edge.kind.Spawn, return "#f72585" (pink)

### Requirement: Edge arrow markers

The system SHALL render directed edge arrows: marker-end "url(#graph-arrow-swipe)" for Swipe edges, "url(#graph-arrow-spawn)" for Spawn edges.

#### Scenario: Arrow marker rendering
- **WHEN** SVG paths for edges are generated
- **THEN** Swipe edges use the marker with id "graph-arrow-swipe" (fill "#4cc9f0")
- **THEN** Spawn edges use the marker with id "graph-arrow-spawn" (fill "#f72585")

#### Scenario: Markers exist for both kinds
- **WHEN** the graph renders with both kinds of edge present
- **THEN** a marker is defined for "graph-arrow-swipe" and for "graph-arrow-spawn"

### Requirement: Node selection and inspection

The system SHALL allow selecting a node to inspect its canonical data in the aside inspector.

#### Scenario: Node selection
- **WHEN** force-graph fires onNodeClick with a node
- **THEN** the selectedId is set and the inspector displays the selected board's ID, dimensions, and tile summary

#### Scenario: Edge selection
- **WHEN** force-graph fires onLinkClick with a link
- **THEN** the selected edge is displayed in the inspector with an edge label naming its kind and payload (e.g., "Swipe Up", "Spawn 2, 4")

#### Scenario: Swipe edge labels name the direction
- **WHEN** a Swipe edge is selected
- **THEN** the inspector label reads "Swipe" followed by the direction
