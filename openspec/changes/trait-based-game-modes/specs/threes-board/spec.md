## Purpose

Defines the Threes spawn variant and the Threes merge threshold, and how they
compose with every game mode. Threes is not a board type, a rule value, or a
separate mode: it is the numeric board with `split = 3` merging, the
spawn-only Threes variant, and the rarity score formula.

## ADDED Requirements

### Requirement: Threes merging is the threshold-3 rule

The system SHALL play Threes on the numeric board with a merge threshold of 3.

The merge SHALL merge a 1 with a 2 into a 3, and two equal tiles of value 3 or
greater into their sum. It SHALL NOT merge 1 with 1, 2 with 2, or a tile
produced by a merge in that same swipe.

#### Scenario: A one and a two become a three
- **WHEN** a swipe brings a 1 and a 2 together under the threshold-3 rule
- **THEN** the resulting tile is 3

#### Scenario: Equal threes become a six
- **WHEN** a swipe brings two 3 tiles together
- **THEN** the resulting tile is 6

#### Scenario: Equal sixes become a twelve
- **WHEN** a swipe brings two 6 tiles together
- **THEN** the resulting tile is 12

#### Scenario: Ones do not merge with ones
- **WHEN** a swipe brings two 1 tiles together
- **THEN** no merge occurs and both tiles remain 1

#### Scenario: Twos do not merge with twos
- **WHEN** a swipe brings two 2 tiles together
- **THEN** no merge occurs and both tiles remain 2

#### Scenario: A merged tile does not merge again
- **WHEN** a swipe produces a merged tile and another equal tile is adjacent to it
- **THEN** the produced tile does not merge again during that swipe

### Requirement: The threshold is configurable beyond Threes

The system SHALL allow the merge threshold to be configured, so a variant with
a split other than 2 or 3 uses the same numeric board and the same rule.

A threshold `x` SHALL merge different tiles below `x` only when their sum is at
most `x`, and SHALL merge equal tiles at or above `x`.

#### Scenario: Threshold four
- **WHEN** a game is configured with a merge threshold of 4 and a 1 and a 3 meet
- **THEN** they merge into 4
- **THEN** a 2 and a 3 do not merge because their sum exceeds 4

#### Scenario: The variant supplies a default
- **WHEN** a Threes game is created without an explicit threshold
- **THEN** its threshold is 3
- **THEN** a Classic game created without an explicit threshold uses 2

### Requirement: Threes values come from the deck

The system SHALL draw the next Threes tile's value from the spawn variant's
shuffled deck of 1, 2, and 3 cards, and SHALL place exactly the cells the
variant supplies.

The board SHALL NOT hold or draw from the deck. The deck and its cursor SHALL
be part of the serialized game state, so a restored save continues the same
sequence.

#### Scenario: The deck supplies the value
- **WHEN** the Threes variant places its next card
- **THEN** the tile value is the deck's next card
- **THEN** the board receives that value in the supplied cells and draws nothing itself

#### Scenario: The deck survives export and import
- **WHEN** a Threes game is exported and imported
- **THEN** the deck's remaining cards and cursor are restored
- **THEN** the next placement continues the same sequence

#### Scenario: One card per spawn
- **WHEN** the Threes variant is asked for a spawn count
- **THEN** the count is one card

### Requirement: Threes placement enters from the opposite edge

The system SHALL, after a Threes swipe, restrict the spawn candidate set to
empty cells on the edge opposite the swipe direction, in the lines the swipe
actually changed.

The board SHALL still report every empty position. The restriction belongs to
the spawn variant and is supplied with the swipe trace as context; the variant
does not record swipe state itself.

#### Scenario: Only the opposite edge is offered
- **WHEN** the player swipes left and the Threes candidate set is queried
- **THEN** every offered position lies on the right edge
- **THEN** every offered position lies in a row the swipe changed

#### Scenario: The board still reports all empties
- **WHEN** the board's spawn space is queried directly under the threshold-3 rule
- **THEN** it reports every empty position, including those the variant will not offer

#### Scenario: The opening card is not edge-constrained
- **WHEN** a Threes game is created and its opening card is placed
- **THEN** the candidate set is every empty cell, because no swipe has happened yet

#### Scenario: A swipe that changes nothing is rejected
- **WHEN** a Threes swipe would not move or merge any tile
- **THEN** the swipe is not in the board's available swipes
- **THEN** no placement follows

### Requirement: Threes scores by tile rarity

The system SHALL report a Threes score as the sum of the rarity values of the
tiles on the board.

The rarity SHALL be zero for 1 and 2, and SHALL be `3^(k + 1)` for a tile
`3 * 2^k`: 3 → 3, 6 → 9, 12 → 27, 24 → 81.

The score SHALL be computed by the spawn variant from the board, not stored on
the board and not reported as an action delta.

#### Scenario: A merge raises the rarity total
- **WHEN** two 3 tiles merge into a 6
- **THEN** a 6 contributes 9 to the score, not its face value
- **THEN** the slot's score is the rarity total of the resulting board

#### Scenario: Color tiles score nothing
- **WHEN** a board holds 1 and 2 tiles
- **THEN** those tiles contribute nothing to the rarity score

#### Scenario: The formula is pure
- **WHEN** two games reach boards with identical content
- **THEN** the Threes formula returns the same score for both
- **THEN** no history beyond the board is required

### Requirement: Threes is a variant, not a mode

The system SHALL select Threes as a spawn variant on any game mode, and SHALL
NOT create a separate Threes game mode or a separate Threes board type.

The variant SHALL supply the deck, the opposite-edge placement, and the rarity
formula. The mode SHALL supply only its seating, obligations, and spawn scope.

#### Scenario: A Threes single-player game
- **WHEN** a single-player game is created with the Threes variant
- **THEN** its board uses the threshold-3 merge
- **THEN** its spawn variant holds a deck and offers opposite-edge placements
- **THEN** its seating and opening spawn are the single-player mode's

#### Scenario: A Threes Survival Race
- **WHEN** Survival Race is created with the Threes variant
- **THEN** every slot uses the threshold-3 merge and the Threes spawn variant
- **THEN** the race seating and fairness policy are unchanged

#### Scenario: A Classic Crossfire
- **WHEN** Crossfire is created with the Classic variant
- **THEN** every slot uses the threshold-2 merge and the Classic spawn variant
- **THEN** the Crossfire target strategy is unchanged

### Requirement: The variant composes with any mode and any threshold

The system SHALL treat the spawn variant and the merge threshold as independent
choices at creation, so a mode can run Classic spawning with a custom threshold
or Threes spawning with the Classic threshold.

#### Scenario: Classic spawning with a custom threshold
- **WHEN** a game is created with the Classic variant and threshold 4
- **THEN** it uses weighted 2/4 spawning and the threshold-4 merge

#### Scenario: Threes spawning with the Classic threshold
- **WHEN** a game is created with the Threes variant and threshold 2
- **THEN** it uses the deck and opposite-edge placement
- **THEN** its merges follow the equal-tile rule

#### Scenario: The merge threshold is part of board identity
- **WHEN** two games hold the same cell values under different thresholds
- **THEN** their boards receive different graph addresses
- **THEN** both can coexist in one graph
