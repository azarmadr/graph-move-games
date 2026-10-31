## Purpose

Defines the Threes tile rule and the Threes game mode. The rule supplies Threes merging and rarity scoring through `MergeRule`; the mode supplies the deck, the opposite-edge entry rule, and the seating. The two are separate so the rule composes with any mode and the mode composes with any rule.

## ADDED Requirements

### Requirement: Threes merge rules

The system SHALL merge, within a single swipe, a 1 with a 2 into a 3, and two equal tiles of value 3 or greater into their sum.

The system SHALL NOT merge 1 with 1, 2 with 2, or a tile produced by a merge in that same swipe.

The rule SHALL be expressed as `Rule::Threes` implementing `MergeRule<u32>`, so the board asks its rule rather than checking a board type.

#### Scenario: A one and a two become a three
- **WHEN** a swipe brings a 1 and a 2 together
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

### Requirement: Threes scores by tile rarity

The system SHALL report a Threes swipe's score change as a replacement computed from the rarity table over the resulting board's tiles, not as the sum of the tiles' face values.

The replacement SHALL come from `MergeRule::score_delta` as `ScoreDelta::Set`, so the caller applies it without knowing the rule.

#### Scenario: A merge reports the board's rarity score
- **WHEN** two 3 tiles merge into a 6
- **THEN** the reported replacement score is the rarity total of the resulting board
- **THEN** that total includes the rarity value of the 6, which is not its face value
- **THEN** the slot's score becomes that total rather than being increased by the merge

#### Scenario: Color tiles score nothing
- **WHEN** a board holds 1 and 2 tiles
- **THEN** those tiles contribute nothing to the rarity score

### Requirement: The next Threes tile comes from the deck

The system SHALL draw the next tile's value from the mode's shuffled deck and SHALL place exactly the cells the mode supplies; the board SHALL NOT hold or draw from the deck.

The deck and its cursor SHALL be part of the serialized match state, so a restored save continues the same sequence.

#### Scenario: The deck supplies the value
- **WHEN** the Threes mode places its next card
- **THEN** the tile value is the deck's next card
- **THEN** the board receives that value in the supplied cells and draws nothing itself

#### Scenario: The deck survives export and import
- **WHEN** a Threes game is exported and imported
- **THEN** the deck's remaining cards and cursor are restored
- **THEN** the next placement continues the same sequence

### Requirement: Threes placement enters from the opposite edge

The system SHALL, after a Threes swipe, restrict the placement candidate set to empty cells on the edge opposite the swipe direction, in the lines the swipe actually changed.

The board SHALL still report every empty position; the restriction is the mode's rule, not the board's.

#### Scenario: Only the opposite edge is offered
- **WHEN** the player swipes left and the placement candidate set is queried
- **THEN** every offered position lies on the right edge
- **THEN** every offered position lies in a row the swipe changed

#### Scenario: The board still reports all empties
- **WHEN** the board's spawn space is queried directly under the Threes rule
- **THEN** it reports every empty position, including those the mode will not offer

#### Scenario: The opening card is not edge-constrained
- **WHEN** a Threes game is created and its opening card is placed
- **THEN** the candidate set is every empty cell, because no swipe has happened yet

#### Scenario: A swipe that changes nothing is rejected
- **WHEN** a Threes swipe would not move or merge any tile
- **THEN** the swipe is not in the board's available swipes
- **THEN** no placement follows

### Requirement: Threes is created as its own mode

The system SHALL create a Threes game as a mode that holds a deck and an entry rule, and SHALL NOT express it as the 2048 single-player mode with a flag.

#### Scenario: A Threes game holds the Threes rule and the deck
- **WHEN** a Threes game is created
- **THEN** its slots hold boards carrying `Rule::Threes`
- **THEN** its mode holds the deck and the entry rule

#### Scenario: The 2048 mode is unchanged
- **WHEN** a 2048 game is created
- **THEN** its slots hold boards carrying `Rule::EqualTiles`
- **THEN** its mode holds spawn weights and a spawn count, not a deck

### Requirement: Tile rules and game modes compose independently

The system SHALL treat the tile rule and the game mode as independent choices at creation, so any rule can be played under any mode.

#### Scenario: 2048 with Threes tiles
- **WHEN** a game is created with the `Single` mode and `Rule::Threes`
- **THEN** it uses the 2048 seating and spawn policy
- **THEN** its tiles merge and score by the Threes rule

#### Scenario: Threes with 2048 tiles
- **WHEN** a game is created with the `Threes` mode and `Rule::EqualTiles`
- **THEN** it uses the deck and opposite-edge entry rule
- **THEN** its tiles merge and score by the equal-tiles rule

#### Scenario: The rule is part of the board's address
- **WHEN** two games hold the same cell values under different rules
- **THEN** their boards receive different addresses
- **THEN** both can coexist in one graph
