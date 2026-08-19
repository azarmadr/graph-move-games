# modular-web-components Specification

## Purpose

Defines the modular web component architecture that extracts the monolithic game-app into self-contained custom elements: graph-tab, graph-controls, game-board, score-display.

## Requirements

### Requirement: graph-tab custom element

The system SHALL provide a `<graph-tab>` custom element that owns its graph rendering, layout, and state.

#### Scenario: graph-tab lifecycle
- **WHEN** the graph-tab element is connected to the DOM
- **THEN** it accepts graph data and game instances via properties or attributes
- **AND** it manages its own dagre layout computation and SVG rendering
- **AND** it handles its own loading states (skeleton → loading → ready)

### Requirement: graph-controls custom element

The system SHALL provide a `<graph-controls>` custom element that renders settings and controls floating over the graph.

#### Scenario: graph-controls lifecycle
- **WHEN** the graph-controls element is connected to the DOM
- **THEN** it renders hop filter buttons, legend, info, and zoom controls that float over the graph canvas
- **AND** it communicates filter changes and zoom commands to the graph-tab via custom events or shared state
- **AND** it does not affect the graph's content bounds

### Requirement: game-board custom element

The system SHALL provide a `<game-board>` custom element that owns board rendering, input handling, and game state display.

#### Scenario: game-board lifecycle
- **WHEN** the game-board element is connected to the DOM
- **THEN** it accepts a GameState property and renders the canvas board
- **AND** it handles keyboard, touch, and button input internally
- **AND** it communicates moves to the parent via custom events

### Requirement: score-display custom element

The system SHALL provide a `<score-display>` custom element that renders score and status information.

#### Scenario: score-display lifecycle
- **WHEN** the score-display element is connected to the DOM
- **THEN** it accepts score and game state properties
- **AND** it renders the score, status, and any status messages

### Requirement: game-app orchestrator

The system SHALL refactor game-app into a thin orchestrator that delegates to modular custom elements.

#### Scenario: Orchestrator delegates rendering
- **WHEN** game-app connects
- **THEN** it initializes the WASM engine and creates game state
- **AND** it passes state down to child custom elements (game-board, score-display, graph-tab)
- **AND** it listens for events from child elements and orchestrates state updates
- **AND** it does not directly render board, graph, or controls
