## Purpose

Defines the content-addressed DAG board model where every canonical board state is globally deduplicated by an FNV-1a hashed BoardId. The graph stores boards and transition payloads (Move/Spawn) as a directed acyclic graph using petgraph DiGraph.

## ADDED Requirements

### Requirement: Board content-addressed ID

The system SHALL generate a content-addressed BoardId for each unique board state using FNV-1a hashing of the board's dimension and tile positions.

- **WHEN** a board is created or modified
- **THEN** the system computes BoardId fromBoard(board) using Fnv1a hasher writing dim.0, dim.1, and each tile's pos.r, pos.c, and tile value

### Requirement: Edge content-addressed ID

The system SHALL generate a content-addressed EdgeId for each unique transition using FNV-1a hashing of (from BoardId, to BoardId, edge kind).

- **WHEN** an edge is inserted between two boards
- **THEN** the system computes EdgeId fromContent(from, to, edge) writing from.0, to.0, edge kind tag (0=Move, 1=Spawn), and for Spawn: each cell's pos.r, pos.c, and tile value

### Requirement: Board deduplication

The system SHALL NOT create duplicate nodes in the DAG for boards with identical content.

- **WHEN** get_or_create_node is called with a board
- **THEN** if the board already exists (BoardId matches), return existing node index; otherwise add new node and return new index

### Requirement: Edge deduplication

The system SHALL NOT create duplicate edges in the DAG for identical transitions.

- **WHEN** insert_edge is called with (from, to, edge)
- **THEN** if EdgeId already exists (from, to, edge content matches), return existing edge index; otherwise add new edge and return new index

### Requirement: Graph node count consistency

The system SHALL maintain accurate node and edge counts consistent with the DAG structure.

- **WHEN** graph_data() is called
- **THEN** nodes count matches the number of unique boards in the DiGraph, and edges count matches the number of unique transitions