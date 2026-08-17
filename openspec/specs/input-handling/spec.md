## Purpose

Defines the input handling system for keyboard, touch, and button controls in the 2048 game.

## ADDED Requirements

### Requirement: keyboard input

The system SHALL handle keyboard input for game moves.

- **WHEN** a keydown event occurs with key ArrowUp, ArrowDown, ArrowLeft, ArrowRight, w, a, s, d (case-insensitive)
- **THEN** e.preventDefault() is called, and the corresponding Direction ("Up"|"Down"|"Left"|"Right") is mapped
- **WHEN** the map contains the key
- **THEN** handleMove is called with the mapped Direction
- **WHEN** the key is not in the map
- **THEN** the event is ignored (no move triggered)

### Requirement: touch swipe input

The system SHALL handle touch swipe gestures for game moves.

- **WHEN** a touchstart event records touch coordinates on the canvas
- **WHEN** a touchend event computes dx = changedX - startX and dy = changedY - startY
- **WHEN** max(abs(dx), abs(dy)) < 24 (threshold)
- **THEN** the touch is ignored (no move triggered)
- **WHEN** abs(dx) > abs(dy) (horizontal swipe)
- **THEN** handleMove is called with "Right" if dx > 0, otherwise "Left"
- **WHEN** abs(dy) >= abs(dx) (vertical swipe, preferred)
- **THEN** handleMove is called with "Down" if dy > 0, otherwise "Up"
- **WHEN** touchmove event occurs
- **THEN** e.preventDefault() is called to prevent scrolling

### Requirement: button controls

The system SHALL handle button controls for moves, board size selection, and tab switching.

- **WHEN** arrow direction buttons (↑, ↓, ←, →) are clicked
- **THEN** handleMove is called with the corresponding Direction, unless the game is terminated (buttons are disabled)
- **WHEN** a board size button (3×3, 4×4, 5×5) is clicked
- **THEN** startNewGame is called with the selected rows and cols, replacing the current game
- **WHEN** the "Play" tab button is clicked
- **THEN** activeTab is set to "play", render is called, and the graph tab button receives disabled attribute when no game state exists
- **WHEN** the "Graph" tab button is clicked
- **THEN** openGraphVisualization is called, which fetches graph snapshot and export, sets visualization state, and switches activeTab to "graph"
- **WHEN** a "New Game" button is clicked (shown when game is over)
- **THEN** startNewGame is called with the current config rows and cols

### Requirement: game over state handling

The system SHALL properly handle input when the game is terminated.

- **WHEN** game.is_terminated is true
- **THEN** all arrow buttons are disabled (disabled attribute and opacity: 0.5)
- **WHEN** keyboard events occur while game is terminated
- **THEN** handleMove returns early without making a move (game state check at start)
- **WHEN** touch events occur while game is terminated
- **THEN** the swipe threshold check still runs but handleMove blocks on the early return