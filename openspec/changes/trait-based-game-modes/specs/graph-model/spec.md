## MODIFIED Requirements

### Requirement: Edge content-addressed ID

The system SHALL generate a content-addressed EdgeId for each unique transition using FNV-1a hashing of (from BoardId, to BoardId, edge kind).

#### Scenario: Computing an edge identifier
- **WHEN** an edge is inserted between two boards
- **THEN** the system computes EdgeId fromContent(from, to, edge) writing from.0, to.0, the edge kind tag (0 for Swipe, 1 for Spawn), and for a Spawn edge each cell's pos.r, pos.c, and tile value

#### Scenario: Kind tags are stable across the rename
- **WHEN** a swipe edge and a spawn edge are inserted between the same pair of boards
- **THEN** the identifiers computed are those determined by kind tags 0 and 1 respectively, together with the edge contents

## ADDED Requirements

### Requirement: Board identifiers include the tile rule

The system SHALL include the board's tile rule in its content address, so two boards holding identical cell values under different rules never resolve to the same node.

#### Scenario: Same cells, different tile rules
- **WHEN** two boards hold the same cell values under different rules
- **THEN** they receive different BoardIds
- **THEN** the graph stores both as distinct nodes

### Requirement: The graph store is oblivious to game modes

The system SHALL record only board states and board actions in the DAG, and SHALL NOT record game modes, seats, board slots, or scores.

#### Scenario: Recording a transition
- **WHEN** a transition is recorded from one board to another
- **THEN** the DAG stores the two board contents and the board action connecting them
- **THEN** the DAG stores no reference to the mode, seat, or slot that produced the transition

#### Scenario: Two modes converge on the same node
- **WHEN** two different game modes produce boards with identical content under the same tile rule
- **THEN** both boards resolve to the same node in the DAG

#### Scenario: The same slot reaching familiar content reuses the node
- **WHEN** a board slot reaches content already present in the DAG
- **THEN** no new node is created
- **THEN** the slot's board slot resolves to the existing content-addressed identifier
