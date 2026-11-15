## Purpose

Defines Crossfire, an N-player mode where each player swipes their own board and immediately fires a single spawn at one opponent's board chosen by a declared strategy, so each turn is one placement decision on one target board.

## ADDED Requirements

### Requirement: Mode composition

The system SHALL compose Crossfire from N board slots, with one seat per player owing a swipe and scoped to that player's own slot, and one seat per player owing a placement.

N SHALL be at least two.

#### Scenario: A crossfire with three players
- **WHEN** Crossfire is created for three players
- **THEN** the mode holds three board slots
- **THEN** there are three seats owing swipes, each scoped to a distinct slot
- **THEN** there are three seats owing placements, one per player

#### Scenario: Every live slot is swiped by exactly one player
- **WHEN** a Crossfire is in progress
- **THEN** each live board slot is the target of exactly one seat owing swipes
- **THEN** no player's swipe seat covers a slot other than their own

### Requirement: A spawn targets exactly one board

The system SHALL apply a player's spawn to exactly one other board slot, and SHALL NOT apply it to every other slot in the mode.

The acting player's own slot SHALL NOT receive their own spawn.

#### Scenario: One target per spawn
- **WHEN** a player applies a spawn
- **THEN** exactly one slot other than their own receives a placement
- **THEN** no other slot changes

#### Scenario: A player's own board is untouched by their own spawn
- **WHEN** a player applies a spawn
- **THEN** the slot they swipe is unchanged by that spawn

### Requirement: The target is chosen by a declared strategy

The system SHALL select a spawn's target using a target-selection strategy declared by the mode.

The default strategy is rotation: a per-player cursor advances cyclically over the slots other than that player's own, one step each time that player spawns. This keeps every player's fire distributed evenly across their opponents rather than concentrating on one. Other strategies — first-come-first-served, where players claim a target in the order they act — are alternatives the declaration can select.

#### Scenario: Rotation is the default strategy
- **WHEN** Crossfire is created without an explicit target strategy
- **THEN** the rotation strategy is used

#### Scenario: The cursor advances on each spawn
- **WHEN** a player applies a spawn under the rotation strategy
- **THEN** their target for that spawn is the slot at their cursor
- **THEN** their cursor advances one step for their next spawn

#### Scenario: Every other slot is targeted equally often
- **WHEN** a player has spawned N-1 consecutive times in a mode of N players under the rotation strategy
- **THEN** every slot other than their own has been targeted exactly once

#### Scenario: Rotation skips terminated slots
- **WHEN** a slot in the rotation is terminated
- **THEN** that slot is skipped
- **THEN** the player's cursor lands on the next non-terminated slot in the cycle

### Requirement: Placement on the target board is free

The system SHALL let the spawning player select a position from the spawn variant's candidate set on the target board, drawing the tile value from the same variant.

For a Classic variant the candidate set is every empty position of the target board. For a Threes variant it is the opposite-edge cells, in the lines the target board's last swipe changed; a target with no last swipe admits every empty position. No position on any other board constrains the choice.

#### Scenario: Any empty position may be chosen under Classic spawning
- **WHEN** a player with a Classic variant spawns on a target board that has at least one empty position
- **THEN** the player may select any of the target board's empty positions

#### Scenario: Threes spawning follows the target's last swipe
- **WHEN** a player with a Threes variant spawns on a target board that has a last swipe trace
- **THEN** the player may select only opposite-edge cells in the lines that swipe changed

#### Scenario: An occupied position is rejected
- **WHEN** a player selects a position that is not empty on the target board
- **THEN** the spawn is rejected
- **THEN** no placement occurs

#### Scenario: Other boards do not constrain the choice
- **WHEN** a player selects an empty position on the target board that is occupied on another player's board
- **THEN** the selection is accepted

#### Scenario: Tile value follows the spawn variant
- **WHEN** a player's spawn is accepted
- **THEN** a Classic spawn draws the placed tile's value according to the configured weights
- **THEN** a Threes spawn places the deck's next card

### Requirement: A Crossfire opens with every player's spawn pending

The system SHALL create a Crossfire with empty boards and one opening spawn obligation per player, rather than seeding a starting tile.

The opening spawns SHALL resolve in seat order. Each SHALL target the first slot the player's rotation strategy selects, and SHALL place tiles according to the game's spawn variant and its count. A player's cursor SHALL advance as if the opening spawn were an ordinary one, so their first swipe fires at the next target.

#### Scenario: Every player owes an opening spawn
- **WHEN** a Crossfire is created for N players
- **THEN** the boards start empty
- **THEN** each player's placement seat holds an unresolved opening obligation

#### Scenario: Opening spawns resolve in seat order
- **WHEN** the opening obligations are resolved
- **THEN** the first player's spawn lands before the second player's
- **THEN** each player's spawn targets a slot other than their own

#### Scenario: The opening spawn uses the rotation's first target
- **WHEN** a player's opening spawn resolves
- **THEN** it targets the slot their rotation cursor names
- **THEN** their cursor advances to the next slot for their first swipe-spawn

#### Scenario: The opening spawn places the variant's count
- **WHEN** a Crossfire is created with a Classic variant count of k
- **THEN** each opening spawn places up to k tiles on its target
- **THEN** a Crossfire with the Threes variant places one card per opening spawn

### Requirement: A counterattack lands without waiting for other players

The system SHALL resolve a player's spawn as an immediate obligation of that player's own swipe, landing it as soon as it is applied, and SHALL NOT hold it until the other players have swiped.

Each player's cycle — swipe, then fire at the target — completes independently of the other players' cycles.

#### Scenario: The counterattack lands before the next player swipes
- **WHEN** a player swipes and applies their spawn
- **THEN** the spawn lands on the target board immediately
- **THEN** it is live before any other player needs to act

#### Scenario: Players' cycles do not wait on each other
- **WHEN** one player has completed their swipe and spawn while another has not swiped this round
- **THEN** no state blocks the completed player's spawn from having landed
- **THEN** no state holds the other player's pending cycle hostage to it

### Requirement: Terminated slots cannot be swiped or targeted

The system SHALL exclude a terminated slot from its player's swipe seat, from every other player's rotation, and from receiving placements.

A terminated slot has no empty positions, so it admits no placement in any case.

#### Scenario: A terminated player cannot swipe
- **WHEN** a player's slot is terminated
- **THEN** no swipe is available to that player

#### Scenario: A terminated slot is not targeted
- **WHEN** a player's rotation would select a terminated slot
- **THEN** the slot is skipped
- **THEN** no placement is made on it

### Requirement: Every slot plays out before the outcome is decided

The system SHALL conclude a Crossfire only when every slot in the mode is terminated, and SHALL then rank players by their score.

#### Scenario: The match continues while a slot is live
- **WHEN** at least one slot is not terminated
- **THEN** the mode reports no outcome

#### Scenario: The match concludes when every slot is terminated
- **WHEN** every slot in the mode is terminated
- **THEN** the mode reports the match as concluded

#### Scenario: Higher score wins
- **WHEN** the match has concluded and one player's score exceeds every other player's
- **THEN** that player is reported as the winner

#### Scenario: Equal scores are a draw
- **WHEN** the match has concluded and the highest score is held by more than one player
- **THEN** the mode reports a draw among those players
