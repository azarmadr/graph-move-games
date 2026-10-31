## Purpose

Defines Survival Race: N players each swipe their own board while a single shared bot places tiles across all of them, so every player faces an identical opponent and the standings compare players rather than luck.

## ADDED Requirements

### Requirement: Mode composition

The system SHALL compose Survival Race from N board slots, one seat per player whose scope is that player's own slot and which owes swipes, and a single seat whose scope is every slot in the mode and which owes placements.

N SHALL be at least one. At N = 1 the mode has one player seat owing swipes and one bot seat owing placements, both scoped to the single slot, with no other player to compare against.

#### Scenario: A race with three players
- **WHEN** Survival Race is created for three players
- **THEN** the mode holds three board slots
- **THEN** there are three seats owing swipes, each scoped to a distinct slot
- **THEN** there is exactly one seat owing placements

#### Scenario: A single-player race
- **WHEN** Survival Race is created for one player
- **THEN** the mode holds one board slot
- **THEN** there is one seat owing swipes, held by the player and scoped to that slot
- **THEN** there is exactly one seat owing placements, scoped to that same slot
- **THEN** the mode holds no player ranking

#### Scenario: Every live slot is covered by exactly one swipe seat
- **WHEN** a Survival Race is in progress
- **THEN** each live board slot is the target of exactly one seat owing swipes
- **THEN** the placement seat's scope contains every live slot in the mode

### Requirement: The placement seat is held by one bot and by no player

The system SHALL bind the Survival Race placement seat to a single automated agent whose scope covers every slot, and SHALL NOT bind any player to a placement seat.

The bot is shared: it is the same agent for every slot, so any difference between what players receive is attributable to the boards rather than to the placement source.

#### Scenario: No player holds a placement seat
- **WHEN** a Survival Race is in progress
- **THEN** every player holds only a swipe seat
- **THEN** the sole placement seat is held by an automated agent

#### Scenario: One bot serves every slot
- **WHEN** the placement seat acts on the mode's slots
- **THEN** a single agent determines the placement for every slot in its scope
- **THEN** no separate placement source exists per slot

#### Scenario: The bot's playing strength applies to the whole mode
- **WHEN** a Survival Race is configured with an agent playing strength
- **THEN** the placement seat is filled by an agent of that strength
- **THEN** no slot is served by an agent of a different strength

### Requirement: Per-slot bots with a shared seed are offered as an alternate

The system SHALL offer, as an in-game alternate, a configuration where each slot is served by its own placement seat filled by a bot seeded identically to the others, in place of the single shared placement seat.

The shared seat remains the default: identical seeds resolve against each board's own empty set, so placements diverge as soon as the boards differ. The alternate trades that guarantee for simpler implementation, and any divergence it produces is recorded rather than absorbed.

#### Scenario: The alternate is selectable when creating the match
- **WHEN** Survival Race is created with the per-slot bot alternate selected
- **THEN** each slot has its own placement seat filled by an automated agent
- **THEN** every one of those agents is seeded identically
- **THEN** no single placement seat spans the whole mode

#### Scenario: Divergence under the alternate is recorded
- **WHEN** the per-slot bots draw placements for boards with different empty sets
- **THEN** the placements may land at different positions
- **THEN** the difference is recorded as a divergence event

#### Scenario: The default remains the shared seat
- **WHEN** Survival Race is created without selecting the alternate
- **THEN** there is exactly one placement seat scoped to every slot

### Requirement: Round structure defers placement until all swipes complete

The system SHALL declare the placement seat's placement obligation as deferred, holding it until every swipe seat able to act has applied its action for the round, and SHALL then resolve all held placements together.

The deferral exists because one decision spans every slot: it must be computed against every board's final state for the round. A player whose slot is terminated cannot swipe and is not counted — otherwise their dead seat would hold the round open and the surviving players would stop receiving placements.

#### Scenario: Placement waits for the slowest player
- **WHEN** some players have swiped for the round and at least one has not
- **THEN** no slot has yet received the round's placement

#### Scenario: Placements land together
- **WHEN** every swipe seat able to act has applied its action for the round
- **THEN** the held placement resolves
- **THEN** the round's placements appear on their slots in that same round

#### Scenario: A terminated player cannot stall the round
- **WHEN** one player's slot is terminated while other slots remain live
- **THEN** that player's swipe seat is not counted toward round completion
- **THEN** the remaining players' rounds continue to resolve placements

### Requirement: Placement covers every slot as one decision

The system SHALL determine the round's placement for the placement seat's entire scope as a single decision, applying it to every slot in the scope.

The placement seat's scope covers every slot, so the placement SHALL be determined across all of them rather than per slot.

#### Scenario: One decision for the whole field
- **WHEN** the placement seat places in a round
- **THEN** a single decision determines the outcome for every slot in the mode
- **THEN** every slot in the mode receives a placement outcome

#### Scenario: A divergent placement is recorded
- **WHEN** slots in the mode do not all receive the placement at the same position
- **THEN** a divergence event is recorded identifying each affected slot and the position it received

### Requirement: Terminated slots leave the placement seat's scope

The system SHALL exclude a terminated slot from the placement seat's scope, since a terminated slot has no empty positions and admits no placement.

#### Scenario: A terminated slot receives no placement
- **WHEN** a slot in the mode is terminated
- **THEN** that slot receives no placement in later rounds
- **THEN** it is excluded when the scope's placement is determined

#### Scenario: The scope shrinks as slots terminate
- **WHEN** some but not all slots in the mode are terminated
- **THEN** the placement seat's scope contains only the slots that are not terminated

#### Scenario: The mode continues while any slot remains live
- **WHEN** at least one slot is not terminated
- **THEN** the mode continues and the remaining slots keep receiving placements

### Requirement: Every slot plays out before the outcome is decided

The system SHALL conclude a Survival Race only when every slot in the mode is terminated.

Where the mode holds more than one player, the system SHALL then rank players by their score.

#### Scenario: The match continues while a slot is live
- **WHEN** at least one slot is not terminated
- **THEN** the mode reports no outcome

#### Scenario: The match concludes when every slot is terminated
- **WHEN** every slot in the mode is terminated
- **THEN** the mode reports the match as concluded

#### Scenario: Single-player has no ranking
- **WHEN** the mode holds one player and every slot is terminated
- **THEN** the mode reports the match as concluded
- **THEN** the mode reports no ranking among players

#### Scenario: Higher score wins
- **WHEN** the match has concluded and one player's score exceeds every other player's
- **THEN** that player is reported as the winner

#### Scenario: Equal scores are a draw
- **WHEN** the match has concluded and the highest score is held by more than one player
- **THEN** the mode reports a draw among those players
