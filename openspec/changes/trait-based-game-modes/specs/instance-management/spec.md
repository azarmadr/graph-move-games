## MODIFIED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance with specified board dimensions, mode, tile rule, and spawn configuration.

#### Scenario: Starting a new game
- **WHEN** startNewGame(rows, cols) is called with valid dimensions
- **THEN** a new GameId is generated via GameId::from_nonce
- **THEN** a new game instance is created whose initial boards are empty
- **THEN** the opening spawn obligation is created and resolved as the game's first action
- **THEN** source_board_id is set to the empty starting board and current_board_id to the board the opening spawn produced, score starts at zero because the board began empty, and is_terminated is determined by a valid-swipe check
- **THEN** the game instance is stored in the engine's games map
- **THEN** the state is rendered and autosaved to localStorage

#### Scenario: The mode and tile rule are part of the creation config
- **WHEN** startNewGame is called with a mode and a tile rule
- **THEN** the new game uses that mode's seating and spawn policy
- **THEN** its slots hold boards carrying that rule
- **THEN** omitting both creates a single-player 2048 game with `Rule::EqualTiles`

#### Scenario: The opening spawn follows the spawn distribution
- **WHEN** startNewGame is called repeatedly with the same dimensions and spawn_config
- **THEN** the opening spawn's positions vary across the board's cells rather than repeating at a fixed coordinate
- **THEN** the spawned tiles' values are drawn according to the configured weights
