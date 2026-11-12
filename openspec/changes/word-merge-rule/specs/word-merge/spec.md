## Purpose

Defines how two word tiles combine: concatenation in reading order, validated against the match vocabulary, and the effect of that relation on which swipes a board reports.

## ADDED Requirements

### Requirement: A merge is a concatenation in reading order

The system SHALL combine two tiles by concatenating the left tile's word with the right tile's word, where left and right are their reading order on the board, and SHALL produce the vocabulary word equal to that concatenation.

#### Scenario: A letter extends a letter
- **WHEN** `A` and `N` are adjacent and the vocabulary contains `AN`
- **THEN** the pair merges into `AN`

#### Scenario: A letter extends a word
- **WHEN** `AN` and `T` are adjacent and the vocabulary contains `ANT`
- **THEN** the pair merges into `ANT`

#### Scenario: A word extends a word
- **WHEN** `ANT` and `E` are adjacent and the vocabulary contains `ANTE`
- **THEN** the pair merges into `ANTE`

#### Scenario: Reading order is preserved
- **WHEN** `AN` is to the left of `T` and the board is swiped right
- **THEN** the pair merges into `ANT`, not `TAN`

#### Scenario: Swipe direction does not reverse operands
- **WHEN** two tiles are adjacent in reading order under any swipe direction
- **THEN** the rule is asked about `left + right` for that reading order

### Requirement: A pair merges only when the result is a known word

The system SHALL merge a pair only when the concatenation is present in the match vocabulary, and SHALL NOT merge a pair merely because the two tiles are equal.

#### Scenario: Equal letters may not merge
- **WHEN** `A` and `A` are adjacent and the vocabulary does not contain `AA`
- **THEN** the pair does not merge

#### Scenario: Equal letters may merge when the word exists
- **WHEN** `A` and `A` are adjacent and the vocabulary contains `AA`
- **THEN** the pair merges into `AA`

#### Scenario: Unknown concatenation does not merge
- **WHEN** two tiles are adjacent and their concatenation is absent from the vocabulary
- **THEN** the pair does not merge and the tiles only slide

### Requirement: Swipe availability follows the merge rule

The system SHALL report a swipe direction as available if and only if applying it changes the board under the word merge rule, and SHALL NOT rely on tile equality to decide availability.

#### Scenario: A word merge makes a swipe available
- **WHEN** a board contains `AN` and `T` with no equal neighbours and the vocabulary contains `ANT`
- **THEN** the direction that brings them together is reported as available

#### Scenario: Reported swipes remain exact
- **WHEN** available swipes are queried for any word board
- **THEN** every reported direction changes the board when applied
- **THEN** every direction that would change the board is reported
- **THEN** no direction appears twice

### Requirement: The merge result is deterministic

The system SHALL produce exactly one result for a given ordered pair of words under a given vocabulary, so that replay and export reproduce the same board.

#### Scenario: Repeating a merge gives the same result
- **WHEN** the same ordered pair is merged twice under the same vocabulary
- **THEN** both merges produce the same word

#### Scenario: A different vocabulary may produce a different result
- **WHEN** the same ordered pair is merged under two vocabularies that differ in the concatenation's presence
- **THEN** each vocabulary applies its own result
