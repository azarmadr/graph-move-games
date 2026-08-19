## Purpose

Defines the async graph loading system that fetches graph data and performs dagre layout without blocking the main thread, so the Graph tab opens immediately with a skeleton and fills in when ready.

## ADDED Requirements

### Requirement: Immediate skeleton render

The system SHALL render a skeleton or loading state immediately when the Graph tab is activated, before graph data is fetched.

- **WHEN** user clicks the "Graph" tab button
- **THEN** the graph-tab element renders a skeleton placeholder (spinner, "Loading graph...", or empty state) without waiting for graph data
- **THEN** the skeleton occupies the same space the graph will fill, preventing layout shift

### Requirement: Async graph fetch

The system SHALL fetch graph data asynchronously using Promise.all with non-blocking execution.

- **WHEN** the graph-tab skeleton is rendered
- **THEN** getGraph() and exportGraph() are called via Promise.all without blocking the UI
- **WHEN** the promises resolve
- **THEN** the graph data is set on the graph-tab element and rendering proceeds

### Requirement: Non-blocking layout computation

The system SHALL compute dagre layout asynchronously using requestAnimationFrame or setTimeout to avoid main-thread blocking.

- **WHEN** the graph-tab receives graph data
- **THEN** dagre.layout() is scheduled via requestAnimationFrame or setTimeout(0) instead of executing synchronously
- **WHEN** the layout computation completes
- **THEN** the graph nodes and edges are rendered in a single batch to the canvas

### Requirement: Loading state management

The system SHALL track and display loading state transitions: skeleton → loading → ready.

- **WHEN** the graph-tab connects and no data is available
- **THEN** loading state is "skeleton"
- **WHEN** async fetch begins
- **THEN** loading state transitions to "loading" (with optional progress indicator)
- **WHEN** layout completes and graph renders
- **THEN** loading state transitions to "ready"
- **WHEN** an error occurs during fetch
- **THEN** loading state transitions to "error" with appropriate user feedback