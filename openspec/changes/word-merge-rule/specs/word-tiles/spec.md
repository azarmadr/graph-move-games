## Purpose

Defines word-based tiles and the per-match vocabulary that gives them meaning: how a tile identifies a word, how word identifiers stay stable, and how a match owns and extends its word list.

## ADDED Requirements

### Requirement: Tiles are word identifiers

The system SHALL represent a tile as a word identifier rather than a string, and SHALL resolve that identifier through the match vocabulary to obtain the word's text. A single letter SHALL be a valid one-letter word tile.

#### Scenario: A letter is a tile
- **WHEN** a match vocabulary contains the one-letter word `A`
- **THEN** a tile carrying `A`'s identifier is a valid tile

#### Scenario: A word is a tile
- **WHEN** a match vocabulary contains the word `ANT`
- **THEN** a tile carrying `ANT`'s identifier resolves to `ANT`

#### Scenario: An unknown identifier is rejected
- **WHEN** a tile identifier is not present in the match vocabulary
- **THEN** the board rejects it instead of displaying or merging it

### Requirement: Word identifiers are deterministic

The system SHALL assign word identifiers deterministically from the vocabulary's canonical word list, so that loading the same words in a different order produces the same identifiers.

#### Scenario: Order of loading does not matter
- **WHEN** the same set of words is loaded in two different orders
- **THEN** every word receives the same identifier in both loads
- **THEN** boards built from those words report the same content address

#### Scenario: A different word list has a different identity
- **WHEN** two vocabularies differ in any word
- **THEN** they report different vocabulary identities

### Requirement: Each match owns its vocabulary

The system SHALL associate a vocabulary with a single match, and SHALL NOT let one match's word identifiers silently resolve against another match's vocabulary.

#### Scenario: Matches may use different vocabularies
- **WHEN** two matches are created with different word lists
- **THEN** each match resolves its own identifiers

#### Scenario: A board is bound to its vocabulary
- **WHEN** a board's content address is computed
- **THEN** the vocabulary identity is part of that address, so equal tile identifiers under different vocabularies do not collide

### Requirement: Formed words are recorded

The system SHALL record a word formed by a merge in the match vocabulary, and SHALL make that recording deterministic, so replaying the same actions reconstructs the same vocabulary.

#### Scenario: A merge extends the vocabulary
- **WHEN** a merge produces the word `ANT`
- **THEN** `ANT` is recorded in the match vocabulary

#### Scenario: Replay reconstructs the vocabulary
- **WHEN** the same action history is replayed from the same seed vocabulary
- **THEN** the reconstructed vocabulary contains the same words
- **THEN** every recorded word has the same identifier

### Requirement: Vocabulary survives export and import

The system SHALL include the match vocabulary in exported state, and SHALL restore it before resolving any board or game that refers to it.

#### Scenario: Export carries the vocabulary
- **WHEN** a match with a vocabulary is exported
- **THEN** the exported payload contains that vocabulary's words and identity

#### Scenario: Import restores before resolving
- **WHEN** an exported payload is imported
- **THEN** the vocabulary is restored before boards and games are resolved
- **THEN** every tile identifier resolves to the word it had at export time

#### Scenario: Missing vocabulary is reported
- **WHEN** an imported payload refers to a vocabulary that is absent from the payload
- **THEN** the import fails with a clear error instead of resolving identifiers against a different vocabulary
