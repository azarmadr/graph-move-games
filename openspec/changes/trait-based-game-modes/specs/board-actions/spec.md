## Purpose

Defines the per-board contract: a board is a grid of natural numeric tiles, a
merge threshold supplied by the game, and the board-level actions of swiping
and placing. A board reports what exists, never what is due. It holds no
rule value, no game mode, no seat, no score, and no random source.

## ADDED Requirements

### Requirement: A board is content and geometry only

The system SHALL represent a board as a grid of natural-number tiles with no
embedded merge rule, no game mode, no spawn policy, no score, and no random
source.

The merge threshold SHALL be supplied by the caller for every operation whose
result depends on it. The board SHALL remain a single concrete numeric value
that the graph can store, compare, hash, and serialize.

#### Scenario: The board carries no rule
- **WHEN** a board is inspected
- **THEN** it contains only its dimensions and occupied cells
- **THEN** it contains no rule, threshold, deck, spawn configuration, score, or mode

#### Scenario: The same board plays under two thresholds
- **WHEN** the same board value is swiped with two different merge thresholds
- **THEN** each call uses the threshold it was given
- **THEN** the board value itself is unchanged by either call

### Requirement: The grid is a separate geometry contract

The system SHALL provide a grid abstraction that owns positions, dimensions,
line iteration, emptiness, and sliding, and SHALL NOT make the board generic
over the grid implementation.

The grid SHALL consult no merge rule, score, deck, or mode.

#### Scenario: A grid operation is rule-agnostic
- **WHEN** a grid operation is invoked
- **THEN** it performs only a positional or structural operation
- **THEN** it consults no merge threshold, score table, deck, or mode

#### Scenario: The board uses the concrete grid
- **WHEN** a numeric board is created
- **THEN** it holds the repository's dense grid implementation
- **THEN** the board type is not parameterized by a grid type

#### Scenario: Sliding preserves reading order
- **WHEN** a grid slides tiles toward the right or downward
- **THEN** a pair offered to the merge operation is ordered left-before-right or upper-before-lower
- **THEN** the direction decides where a result lands, not the operand order

### Requirement: The merge threshold decides whether two tiles merge

The system SHALL merge two tiles according to the configured threshold `x`:

- when both tiles are below `x`, they merge only if they differ and their sum is at most `x`;
- otherwise, they merge only if they are equal.

#### Scenario: Classic threshold
- **WHEN** the threshold is 2 and two 2 tiles meet
- **THEN** they merge into 4
- **THEN** a 1 and any other tile do not merge

#### Scenario: Threes threshold
- **WHEN** the threshold is 3 and a 1 and a 2 meet
- **THEN** they merge into 3
- **THEN** two 1 tiles do not merge
- **THEN** two 2 tiles do not merge

#### Scenario: Equal tiles at or above the threshold merge
- **WHEN** the threshold is 3 and two 3 tiles meet
- **THEN** they merge into 6
- **THEN** two 6 tiles merge into 12

#### Scenario: A higher threshold admits more low pairs
- **WHEN** the threshold is 4 and a 1 and a 3 meet
- **THEN** they merge into 4
- **THEN** a 2 and a 3 do not merge because their sum exceeds the threshold

#### Scenario: A tile produced by a merge does not merge again in the same swipe
- **WHEN** a swipe produces a merged tile and an equal tile is adjacent to it
- **THEN** the produced tile does not merge again during that swipe

### Requirement: Board reports exactly the available swipes

The system SHALL report, for a given board and merge threshold, exactly the
swipe directions that would change the board, and no others.

A swipe direction is available if and only if applying it with that threshold
produces a board with different content.

#### Scenario: Reported swipes are exactly the effective ones
- **WHEN** a board's available swipes are queried with a threshold
- **THEN** every reported direction produces a different board when applied with that threshold
- **THEN** every direction that would produce a different board is reported

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

The system SHALL report, for a board, every empty position where a tile could
be placed, in a stable order.

Tile values are not the board's business: the spawn variant supplies them.

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

### Requirement: Action application is pure and random-free

The system SHALL apply an action to a board as a pure function of the board,
the action, and the merge threshold, drawing no randomness from any source.

Randomness required to choose an action is supplied by the caller, never held
by the board.

#### Scenario: Identical inputs produce identical results
- **WHEN** the same action is applied to two boards with identical content under the same threshold
- **THEN** both produce boards with identical content

#### Scenario: Applying a swipe does not place a tile
- **WHEN** a swipe action is applied to a board
- **THEN** the resulting board reflects only sliding and merging
- **THEN** no tile is added to the resulting board

#### Scenario: Applying a placement places exactly the given cells
- **WHEN** a placement action carrying a set of cells is applied to a board
- **THEN** exactly those cells are set on the resulting board to the given tile values
- **THEN** no other cell changes

#### Scenario: A swipe that changes nothing is rejected
- **WHEN** a swipe direction would not move or merge any tile
- **THEN** applying it reports an invalid action
- **THEN** the board is unchanged

### Requirement: Termination is equivalent to having no available swipe

The system SHALL report a board as terminated, under a given merge threshold,
if and only if it reports no available swipes under that threshold.

#### Scenario: A terminated board reports no swipes
- **WHEN** a board has no available swipes
- **THEN** the board is reported as terminated
- **THEN** the board's available swipe set is empty

#### Scenario: An un-terminated board reports at least one swipe
- **WHEN** a board is not reported as terminated
- **THEN** its available swipe set is non-empty

### Requirement: A terminated board has no spawn space

The system SHALL report no spawn positions for a terminated board.

A board with at least one tile and at least one empty position always admits a
slide, so termination implies the board is full. The converse does not hold: a
full board may still admit a merge.

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

### Requirement: The board reports no score

The system SHALL NOT compute, store, or report a score on a board or as part of
an action application.

Score SHALL be derived by the spawn variant from the resulting board and the
spawn record, so that the board remains a pure content value.

#### Scenario: Applying an action reports only the resulting board
- **WHEN** a swipe or placement is applied
- **THEN** the result contains the resulting board and no score delta
- **THEN** the caller obtains the score from the spawn variant when it needs one

#### Scenario: One board supports two score formulas
- **WHEN** the same board content is scored by the Classic and Threes formulas
- **THEN** the board is not modified or annotated by either formula
- **THEN** each formula returns its own value
