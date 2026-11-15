## MODIFIED Requirements

### Requirement: Board content-addressed ID

The system SHALL generate a content-addressed BoardId for each unique board state from the board's content **and** the merge threshold it is played under, using FNV-1a hashing, so two boards holding identical cells under different thresholds never resolve to the same node.

#### Scenario: Computing a board identifier
- **WHEN** a board is created or modified
- **THEN** the system computes BoardId by writing the merge threshold's split value, the board's dimensions, and each occupied cell's position and value through the Fnv1a hasher
- **THEN** the board value itself is the hash input only, and carries no rule or threshold field

### Requirement: Edge content-addressed ID

The system SHALL generate a content-addressed EdgeId for each unique transition using FNV-1a hashing of (from BoardId, to BoardId, edge kind).

#### Scenario: Computing an edge identifier
- **WHEN** an edge is inserted between two boards
- **THEN** the system computes EdgeId fromContent(from, to, edge) writing from.0, to.0, the edge kind tag (0 for Swipe, 1 for Spawn), and for a Spawn edge each cell's pos.r, pos.c, and tile value

#### Scenario: Kind tags are stable across the rename
- **WHEN** a swipe edge and a spawn edge are inserted between the same pair of boards
- **THEN** the identifiers computed are those determined by kind tags 0 and 1 respectively, together with the edge contents

## ADDED Requirements

### Requirement: Identifiers live in the graph module

The system SHALL define BoardId, EdgeId, and GameId inside the graph module, and SHALL NOT require the board to report its own identity.

Board identity is a graph concern because it combines board content with the merge threshold. The board reports content; the graph owns addressing.

#### Scenario: The board exposes no identity
- **WHEN** the board type is inspected
- **THEN** it exposes no identifier method and no identifier field
- **THEN** the graph computes a board's identifier from the board and its threshold

#### Scenario: Game identity is allocated by the engine
- **WHEN** a new game is created
- **THEN** the graph module supplies a nonce-derived GameId
- **THEN** no content hash is used for game identity

### Requirement: The graph node stores the merge threshold

The system SHALL store each board node together with the merge threshold it is played under, so identity can be recomputed after deserialization and so one store holds boards from games whose thresholds differ.

#### Scenario: Recomputing identity after import
- **WHEN** a serialized graph is imported
- **THEN** each node carries its merge threshold beside its board content
- **THEN** the board identifiers can be recomputed without consulting any game

#### Scenario: Same cells, different thresholds
- **WHEN** two boards hold the same cell values under different thresholds
- **THEN** they receive different BoardIds
- **THEN** the graph stores both as distinct nodes

### Requirement: The graph store is explicit node and edge maps

The system SHALL store boards in a map keyed by BoardId and transitions in a map keyed by EdgeId.

The store SHALL NOT rely on a hidden graph index that must be rebuilt after deserialization: the serialized schema is the storage schema.

#### Scenario: The serialized schema is the storage schema
- **WHEN** the graph is serialized
- **THEN** nodes appear as a map from BoardId to board node
- **THEN** edges appear as a map from EdgeId to graph edge
- **THEN** no derived index is serialized or required to interpret the payload

#### Scenario: Inserting a board is idempotent
- **WHEN** a board with an existing BoardId is inserted
- **THEN** the existing node is reused
- **THEN** no duplicate node is created

#### Scenario: Inserting an edge is idempotent
- **WHEN** a transition with an existing EdgeId is inserted
- **THEN** the existing edge is reused
- **THEN** no duplicate edge is created

### Requirement: The graph store is oblivious to game modes

The system SHALL record only board states and board actions in the DAG, and SHALL NOT record game modes, seats, board slots, scores, spawn variants, or agent state.

#### Scenario: Recording a transition
- **WHEN** a transition is recorded from one board to another
- **THEN** the DAG stores the two board contents, their merge thresholds, and the board action connecting them
- **THEN** the DAG stores no reference to the mode, seat, slot, score, or agent that produced the transition

#### Scenario: Two modes converge on the same node
- **WHEN** two different game modes produce boards with identical content under the same merge threshold
- **THEN** both boards resolve to the same node in the DAG

#### Scenario: The same slot reaching familiar content reuses the node
- **WHEN** a board slot reaches content already present in the DAG under the same threshold
- **THEN** no new node is created
- **THEN** the slot resolves to the existing content-addressed identifier

### Requirement: The graph stores boards but not games

The system SHALL keep game state out of the graph store, so several games share one graph without the graph knowing which game, seat, or mode produced a node.

#### Scenario: Two games share one graph
- **WHEN** two games reach the same board content under the same threshold
- **THEN** the graph holds one node for both
- **THEN** each game independently references that node

#### Scenario: A game is not a graph node
- **WHEN** the graph's contents are inspected
- **THEN** the graph holds board nodes and transition edges only
- **THEN** games, agents, obligations, and scores are held outside the graph
