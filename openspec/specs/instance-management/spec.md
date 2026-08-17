## Purpose

Defines the game instance management system that tracks multiple game instances, their state, and provides create/switch functionality with autosave/restore via localStorage.

## ADDED Requirements

### Requirement: create_game_with_config

The system SHALL create a new game instance with specified board dimensions and spawn configuration.

- **WHEN** startNewGame(rows, cols) is called with valid dimensions
- **THEN** a new GameId is generated via GameId::from_nonce, a new game instance is created with initial board (single tile 2 at (0,0)), source_board_id and current_board_id are set to the same starting board, score is 0, and is_terminated is determined by valid move check
- **THEN** the game instance is stored in the engine's games HashMap
- **THEN** the state is rendered and autosaved to localStorage

### Requirement: game state restoration

The system SHALL restore a previously saved game state from localStorage.

- **WHEN** connectedCallback loads saved exportData and activeGameId from localStorage
- **THEN** importGraph is called to restore the engine state, then getState is called for the active game, and setStateAndRender restores the UI state
- **WHEN** the restore fails (invalid JSON or import fails)
- **THEN** the error is caught and logged, and a new game is created with the default config

### Requirement: termination detection

The system SHALL accurately detect when a game is terminated (no valid moves remain).

- **WHEN** a game state is created or a move is made
- **THEN** has_any_valid_move_helper checks all four directions (Up, Down, Left, Right) from the current board
- **THEN** if no direction produces a valid move, is_terminated is set to true
- **WHEN** is_terminated is true
- **THEN** arrow buttons are disabled, "Game Over" overlay is shown, and keyboard/touch input is blocked for moves

### Requirement: score tracking

The system SHALL track and display the player's score across moves.

- **WHEN** a valid move is made (including merge)
- **THEN** the merge score is added to the game's running score
- **WHEN** an invalid move is made (no board change)
- **THEN** the score remains unchanged
- **WHEN** the score is displayed in the UI
- **THEN** it shows "SCORE: {score}" in the play area header

### Requirement: instance switching

The system SHALL allow switching between multiple game instances.

- **WHEN** a board size button is clicked (3×3, 4×4, 5×5)
- **THEN** startNewGame is called with the new dimensions, replacing the current game state
- **WHEN** the graph tab is opened
- **THEN** visualizationGames are set from the exported graph data, and visualizationActiveGameId tracks the active game