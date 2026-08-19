## Purpose

Provides an optional toggle to enable d3-force physics simulation on the graph, allowing live force-directed exploration of the DAG structure. When disabled (default), the graph uses deterministic dagre positions frozen on canvas.

## ADDED Requirements

### Requirement: Physics mode toggle

The system SHALL provide a toggle control that switches between frozen dagre layout and live d3-force physics simulation.

#### Scenario: Toggle to physics mode
- **WHEN** the user activates the physics toggle
- **THEN** d3-force charge, center, and link forces are enabled on the force-graph simulation
- **THEN** nodes begin reacting to each other and settle into a force-directed layout
- **THEN** the toggle visually indicates physics is active

#### Scenario: Toggle back to frozen layout
- **WHEN** the user deactivates the physics toggle
- **THEN** d3-force forces are disabled
- **THEN** nodes stop moving and remain at their current positions
- **THEN** the toggle visually indicates physics is inactive

### Requirement: Physics mode preserves interactions

The system SHALL maintain node drag, hover, and click functionality in both physics and frozen modes.

#### Scenario: Drag in physics mode
- **WHEN** physics mode is active and the user drags a node
- **THEN** the dragged node moves and connected nodes react via the force simulation
- **THEN** the simulation reheats during drag

#### Scenario: Drag in frozen mode
- **WHEN** physics mode is inactive and the user drags a node
- **THEN** the dragged node moves to the new position without affecting other nodes
