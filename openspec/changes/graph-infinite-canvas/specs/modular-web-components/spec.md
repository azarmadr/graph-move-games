## Purpose

Defines the modular web component architecture that extracts the monolithic game-app into self-contained custom elements: graph-tab, graph-controls, game-board, score-display.

## ADDED Requirements

### Requirement: graph-tab custom element

The system SHALL provide a `<graph-tab>` custom element that owns its graph rendering, layout, and state.

- **WHEN** the graph-tab element is connected to the DOM
- **THEN** it accepts graph data and game instances via properties or attributes
- **THEN** it manages its own dagre layout computation and SVG rendering
- **THEN** it handles its own loading states (skeleton → loading → ready)

### Requirement: graph-controls custom element

The system SHALL provide a `<graph-controls>` custom element that renders settings and controls floating over the graph.

- **WHEN** the graph-controls element is connected to the DOM
- **THEN** it renders hop filter buttons, legend, and info that float over the graph canvas
- **THEN** it communicates filter changes to the graph-tab via custom events or shared state
- **THEN** it does not affect the graph's pan/zoom or content bounds

### Requirement: game-board custom element

The system SHALL provide a `<game-board>` custom element that owns board rendering, input handling, and game state display.

- **WHEN** the game-board element is connected to the DOM
- **THEN** it accepts a GameState property and renders the canvas board
- **THEN** it handles keyboard, touch, and button input internally
- **THEN** it communicates moves to the parent via custom events

### Requirement: score-display custom element

The system SHALL provide a `<score-display>` custom element that renders score and status information.

- **WHEN** the score-display element is connected to the DOM
- **THEN** it accepts score and game state properties
- **THEN** it renders the score, status, and any status messages

### Requirement: game-app orchestrator

The system SHALL refactor game-app into a thin orchestrator that delegates to modular custom elements.

- **WHEN** game-app connects
- **THEN** it initializes the WASM engine and creates game state
- **THEN** it passes state down to child custom elements (game-board, score-display, graph-tab)
- **THEN** it listens for events from child elements and orchestrates state updates
- **THEN** it does not directly render board, graph, or controls