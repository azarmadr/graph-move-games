## MODIFIED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance from a shared game config and a spawn-variant config, covering board dimensions, mode, merge threshold, spawn variant, and spawn count.

#### Scenario: Starting a new game
- **WHEN** startNewGame(rows, cols) is called with valid dimensions
- **THEN** a new GameId is generated via GameId::from_nonce
- **THEN** a new game instance is created whose initial boards are empty
- **THEN** the opening spawn obligation is created and resolved as the game's first action
- **THEN** source_board_id is set to the empty starting board and current_board_id to the board the opening spawn produced
- **THEN** the game's score is derived from the resulting board and spawn credit rather than stored as a delta
- **THEN** is_terminated is determined by a valid-swipe check under the game's merge threshold
- **THEN** the game instance is stored in the engine's games map
- **THEN** the state is rendered and autosaved to localStorage

#### Scenario: The mode, merge threshold, and variant are part of the creation config
- **WHEN** startNewGame is called with a mode, a merge threshold, and a spawn variant
- **THEN** the new game uses that mode's seating and spawn scope
- **THEN** its boards are played under the given merge threshold
- **THEN** its spawn variant supplies values, positions, count, and score formula
- **THEN** omitting all of them creates a single-player Classic game under the threshold-2 merge

#### Scenario: The variant supplies the default merge threshold
- **WHEN** startNewGame is called with a Threes variant and no explicit threshold
- **THEN** the game's merge threshold is 3
- **THEN** a Classic variant defaults to a threshold of 2

#### Scenario: The opening spawn follows the variant
- **WHEN** startNewGame is called repeatedly with the same dimensions and variant
- **THEN** the opening spawn's positions vary across the board's cells rather than repeating at a fixed coordinate
- **THEN** a Classic spawn draws its tile values according to the configured weights
- **THEN** a Threes spawn draws its tile value from the deck's first card

## ADDED Requirements

### Requirement: Creation opens with a spawn rather than a seeded tile

The system SHALL create a game with empty boards and resolve an opening spawn as the game's first action.

No cell is pre-seeded, and no starting tile is special-cased: every tile, including the first, arrives through the spawn variant.

#### Scenario: Boards start empty
- **WHEN** a game is created
- **THEN** every board slot starts with no tiles
- **THEN** the first board node in the graph is the empty board under the game's threshold

#### Scenario: The opening spawn is an ordinary spawn
- **WHEN** the opening spawn resolves
- **THEN** it uses the same variant, count, and placement rules as a later spawn
- **THEN** the board after the opening spawn is recorded as a Spawn transition from the empty board

#### Scenario: The opening spawn has no swipe trace
- **WHEN** the opening spawn resolves before any swipe
- **THEN** the variant's candidate set is not constrained by a previous swipe

### Requirement: A creation payload names the config and variant explicitly

The system SHALL accept creation input as a shared game config plus a spawn-variant config, so a mode and a spawn variant are chosen independently.

#### Scenario: A Classic single-player payload
- **WHEN** a creation payload names the Single mode and the Classic variant with weights and a count
- **THEN** the engine builds a single-player game with weighted Classic spawning

#### Scenario: A Threes single-player payload
- **WHEN** a creation payload names the Single mode and the Threes variant with a seed
- **THEN** the engine builds a single-player game with a shuffled Threes deck

#### Scenario: Classic spawning under a custom threshold
- **WHEN** a creation payload names the Classic variant and an explicit threshold of 4
- **THEN** the game uses weighted spawning and threshold-4 merging
