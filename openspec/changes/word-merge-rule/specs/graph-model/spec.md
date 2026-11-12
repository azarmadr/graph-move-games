## MODIFIED Requirements

### Requirement: Board content-addressed ID

The system SHALL generate a content-addressed BoardId for each unique board state using FNV-1a hashing of the board's dimension, its merge rule identity, and its tile positions. The merge rule identity SHALL include the vocabulary identity when the rule resolves words through a match vocabulary.

- **WHEN** a board is created or modified
- **THEN** the system computes BoardId fromBoard(board) using Fnv1a hasher writing dim.0, dim.1, the rule identity, and each tile's pos.r, pos.c, and tile identifier
- **WHEN** the rule is vocabulary-backed
- **THEN** the rule identity includes the vocabulary identity

#### Scenario: Identical content under the same rule shares an address
- **WHEN** two boards have identical content, the same rule, and the same vocabulary
- **THEN** both report the same BoardId

#### Scenario: Different vocabularies never collide
- **WHEN** two boards have identical tile identifiers under different vocabularies
- **THEN** their BoardIds differ
- **THEN** both can be stored in the same graph without collision

#### Scenario: Different rules never collide
- **WHEN** two boards have identical content under different merge rules
- **THEN** their BoardIds differ
