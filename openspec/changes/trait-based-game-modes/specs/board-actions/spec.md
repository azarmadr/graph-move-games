## Purpose

Defines the per-board contract: what a board reports about the actions available to it, how an action applies to it, and how its grid operations and tile rule compose. A board reports what exists, never what is due — it holds no knowledge of game modes, seats, players, or randomness.

## ADDED Requirements

### Requirement: A board is a grid plus a merge rule

The system SHALL build the tile-sliding board from a reusable `Grid` that owns every grid operation and a `MergeRule` that decides how two tiles merge and how a swipe scores.

The grid SHALL provide positions, rows, columns, lines, emptiness, and sliding, and SHALL NOT depend on any particular tile rule or game mode.

#### Scenario: The same grid serves both rules
- **WHEN** a board with the equal-tiles rule and a board with the Threes rule are created
- **THEN** both use the same grid implementation
- **THEN** they differ only in their merge rule

#### Scenario: The grid knows no game rules
- **WHEN** a grid operation is invoked
- **THEN** it performs only a positional or structural operation
- **THEN** it consults no merge rule, score table, deck, or mode

### Requirement: The merge rule decides whether two tiles merge

The system SHALL ask the board's merge rule whether two adjacent tiles combine, and SHALL use the rule's result when sliding.

#### Scenario: Equal tiles merge under the equal-tiles rule
- **WHEN** two equal tiles meet under the equal-tiles rule
- **THEN** the rule reports their sum as the merged tile

#### Scenario: A one and a two merge under the Threes rule
- **WHEN** a 1 and a 2 meet under the Threes rule
- **THEN** the rule reports 3 as the merged tile

#### Scenario: Ones do not merge under the Threes rule
- **WHEN** two 1 tiles meet under the Threes rule
- **THEN** the rule reports that they do not merge

### Requirement: Board reports its content address

The system SHALL report a content address for a board derived from its tile rule and its content, so that a slot can point at a graph node without the board carrying one.

#### Scenario: Identical content under the same rule reports the same address
- **WHEN** two boards with identical content and the same rule report their addresses
- **THEN** both addresses are equal

#### Scenario: Different content reports a different address
- **WHEN** two boards differ in any cell
- **THEN** their reported addresses differ

#### Scenario: Two tile rules never share an address
- **WHEN** two boards hold the same cell values under different rules
- **THEN** their reported addresses differ
- **THEN** both can be stored in the same graph without collision

### Requirement: Board reports available swipes

The system SHALL report exactly the swipe directions that would change a given board, and no others.

A swipe direction is available if and only if applying it produces a board with different content.

#### Scenario: Reported swipes are exactly the effective ones
- **WHEN** a board's available swipes are queried
- **THEN** every reported direction produces a board with different content when applied
- **THEN** every direction that would produce a board with different content is reported

#### Scenario: A board that can only slide rightward reports Right
- **WHEN** a board's only legal change is a tile sliding toward a higher column index
- **THEN** Right is among the reported swipes
- **THEN** no direction other than Right is reported for that board

#### Scenario: A board that can only slide downward reports Down
- **WHEN** a board's only legal change is a tile sliding toward a higher row index
- **THEN** Down is among the reported swipes
- **THEN** no direction other than Down is reported for that board

#### Scenario: Reported swipes are free of duplicates
- **WHEN** a board's available swipes are queried
- **THEN** each direction appears at most once in the result

### Requirement: Board reports its spawn space

The system SHALL report, for a board, the positions where a tile could be placed.

Positions are reported in a stable order so that an index into the list identifies the same position across repeated queries on an unchanged board. Tile values are not the board's business: the caller draws a value from the match's spawn configuration, never from the board.

#### Scenario: Spawn positions are empty cells
- **WHEN** a board's spawn space is queried
- **THEN** every reported position is currently empty
- **THEN** every currently empty position is reported

#### Scenario: Spawn space ordering is stable
- **WHEN** a board's spawn space is queried twice without the board changing
- **THEN** both queries return the same positions in the same order

#### Scenario: A full board reports no spawn positions
- **WHEN** a board has no empty positions
- **THEN** the reported spawn space contains no positions

### Requirement: Action application is free of any random source

The system SHALL apply an action to a board as a pure function of the board and the action, drawing no randomness from any source.

Randomness required to choose an action is supplied by the caller, never held by the board.

#### Scenario: Identical inputs produce identical results
- **WHEN** the same action is applied to two boards with identical content
- **THEN** both produce boards with identical content

#### Scenario: Applying a swipe does not place a tile
- **WHEN** a swipe action is applied to a board
- **THEN** the resulting board reflects only sliding and merging
- **THEN** no tile is added to the resulting board

#### Scenario: Applying a placement places exactly the given cells
- **WHEN** a placement action carrying a set of cells is applied to a board
- **THEN** exactly those cells are set on the resulting board to the given tile values
- **THEN** no other cell changes

### Requirement: Applying an action reports how the score changes

The system SHALL report, for an applied action, whether the running score should be increased by an amount or replaced by an amount, so the caller can maintain the score without knowing the board's scoring rule.

#### Scenario: A 2048 merge adds its value
- **WHEN** a 2048 swipe merges tiles
- **THEN** the reported change is an addition equal to the sum of the values of the tiles produced by merging

#### Scenario: A Threes merge replaces the score from the board
- **WHEN** a Threes swipe merges tiles
- **THEN** the reported change is a replacement whose value is the Threes rarity score of the resulting board

#### Scenario: A 2048 swipe with no merge adds nothing
- **WHEN** a 2048 swipe slides tiles without merging any
- **THEN** the reported change is an addition of zero

#### Scenario: A placement changes no score
- **WHEN** a placement action is applied to a board
- **THEN** the reported change is an addition of zero

### Requirement: Termination is equivalent to having no available swipe

The system SHALL report a board as terminated if and only if it reports no available swipes.

#### Scenario: A terminated board reports no swipes
- **WHEN** a board has no available swipes
- **THEN** the board is reported as terminated
- **THEN** the board's available swipe set is empty

#### Scenario: An un-terminated board reports at least one swipe
- **WHEN** a board is not reported as terminated
- **THEN** its available swipe set is non-empty

### Requirement: A terminated board has no spawn space

The system SHALL report no spawn positions for a terminated board.

A board with at least one tile and at least one empty position always admits a slide, so termination implies the board is full. The converse does not hold: a full board may still admit a merge.

#### Scenario: Termination implies no empty positions
- **WHEN** a board is reported as terminated
- **THEN** its spawn space contains no positions

#### Scenario: A full board with a merge is not terminated
- **WHEN** a board has no empty positions but two adjacent equal tiles
- **THEN** the board is not reported as terminated
- **THEN** its available swipes is non-empty

#### Scenario: A board with an empty position and a tile is never terminated
- **WHEN** a board has at least one tile and at least one empty position
- **THEN** the board is not reported as terminated
