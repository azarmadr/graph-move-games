## Purpose

Defines how a spawn is placed and how many tiles it places across the set of board slots a placement seat covers, so that placement is identical for every slot whenever the boards permit it, nothing fillable is ever skipped, and any failure to place identically is recorded rather than silently absorbed.

## ADDED Requirements

### Requirement: The spawn variant configures the count

The system SHALL take the number of tiles a spawn places from the game's spawn variant, with two Classic modes: a fixed count, and a count scaled by the board's empty cells. A Threes spawn places exactly one card.

A scaled count SHALL be rounded up, SHALL NOT fall below one for a fillable slot, and SHALL NOT exceed that slot's number of empty positions.

#### Scenario: Fixed count
- **WHEN** a Classic variant configures a fixed spawn count of n
- **THEN** each spawn places n tiles on each fillable slot in scope

#### Scenario: Threes places one card
- **WHEN** the game's variant is Threes
- **THEN** each spawn places exactly one tile on each fillable slot in scope, regardless of empty-cell count

#### Scenario: Count scaled by empties
- **WHEN** a match configures spawn count to scale by empty cells
- **THEN** the count for a slot is ceil(ln(empties)), clamped to that slot's empty positions
- **THEN** a slot with more empty positions receives at least as many tiles per spawn as a slot with fewer

#### Scenario: A fillable slot never receives zero tiles from a scaled count
- **WHEN** a scaled rule computes a count below one for a slot with at least one empty position
- **THEN** the count is one

#### Scenario: A full slot receives no tiles
- **WHEN** a spawn is applied to a slot with no empty positions
- **THEN** that slot receives no tiles

### Requirement: One placement decision covers the whole scope

The system SHALL determine a single placement for a placement seat's action and apply it to every board slot in that seat's scope.

Slots SHALL NOT each receive an unrelated decision: one decision covers the scope, applying the sharing and degradation rules below.

#### Scenario: A single decision produces placements for every slot
- **WHEN** a placement seat with more than one slot in scope applies a spawn
- **THEN** one placement decision determines the outcome for all slots in the scope
- **THEN** every slot in the scope receives a placement outcome

#### Scenario: Slots with identical empty sets share a placement
- **WHEN** two or more slots in the scope have identical sets of empty positions
- **THEN** those slots receive a spawn at the same position

#### Scenario: A scope of one slot needs no reconciliation
- **WHEN** a placement seat's scope covers exactly one board slot
- **THEN** the placement decision applies to that slot alone
- **THEN** no position is required to be shared with any other slot

### Requirement: Placement prefers a position empty in every slot

The system SHALL prefer a position that is empty in every fillable slot of the scope, and SHALL place the spawn there for every slot.

Slots with no empty positions take no part in this computation: their empty set is ∅, and including it would make the shared set empty regardless of what the other slots share — one full board would collapse the sharing for every other slot.

This is the only placement that places identically across slots whose contents differ.

#### Scenario: A shared empty position is used
- **WHEN** at least one position is empty in every fillable slot of the scope
- **THEN** the spawn is placed at a position that is empty in every slot
- **THEN** every slot in the scope receives the spawn at that same position

#### Scenario: The shared position is drawn from the shared set only
- **WHEN** a position is chosen for a scope whose slots share at least one empty position
- **THEN** the chosen position is one that is empty in every fillable slot of the scope

### Requirement: Placement degrades when no position is empty in every slot

The system SHALL degrade placement when no position is empty in every fillable slot of the scope, grouping slots whose empty sets are identical so that those slots still share a placement.

Slots whose empty sets differ from every other slot in the scope are placed against independently.

#### Scenario: Slots with matching empty sets still share
- **WHEN** no position is empty in every fillable slot of the scope
- **THEN** slots whose empty sets are identical to one another receive the spawn at the same position

#### Scenario: Slots with no matching counterpart are placed independently
- **WHEN** no position is empty in every fillable slot of the scope
- **THEN** a slot whose empty set matches no other slot in the scope receives its own placement
- **THEN** that placement is not required to match any other slot's

### Requirement: Placement that does not match across the scope is recorded as divergence

The system SHALL record a divergence event whenever slots in a scope do not all receive the spawn at the same position.

A divergence event identifies the scope's slots and the position each received.

#### Scenario: Divergence is recorded when placements differ
- **WHEN** two slots in a scope receive spawns at different positions
- **THEN** a divergence event is recorded for that placement
- **THEN** the recorded event identifies each affected slot and the position it received

#### Scenario: No divergence is recorded when placement matches
- **WHEN** every slot in a scope receives the spawn at the same position
- **THEN** no divergence event is recorded for that placement

### Requirement: The candidate set is fixed before the agent chooses

The system SHALL determine the set of positions an agent may choose from before the agent chooses, and SHALL NOT permit the agent to widen that set.

The set starts from the spawn variant's candidate positions for each board in scope. The board reports every empty position; the variant narrows that report using the board's last swipe when its placement rule requires it, such as the Threes opposite-edge rule. A board with no last swipe admits every empty position.

Holding the placement seat confers placement choice among the admissible positions; it does not confer discretion over what is admissible.

#### Scenario: The agent chooses within the shared set
- **WHEN** the scope's slots share at least one empty position
- **THEN** the agent may choose only among positions that are empty in every fillable slot of the scope

#### Scenario: The agent cannot elect a non-shared position
- **WHEN** the scope's slots share at least one empty position
- **THEN** the agent cannot place the spawn at a position that is empty in only some slots

### Requirement: Nothing is skipped unless it is unfillable

The system SHALL give every slot in a scope that has at least one empty position a placement every round, and SHALL treat a slot with no empty positions as unfillable rather than skipped.

A fillable slot — one with at least one empty position — is never passed over. An unfillable slot receives nothing because there is nowhere to place, not because it was overlooked; it rejoins placement as soon as its board has an empty position again.

#### Scenario: A fillable slot always gets its placement
- **WHEN** a slot in a scope has at least one empty position at placement time
- **THEN** that slot receives a placement in that round

#### Scenario: An unfillable slot is excluded, not skipped
- **WHEN** a slot in a scope has no empty positions at placement time
- **THEN** that slot receives no placement in that round
- **THEN** it is not counted as skipped and accrues no compensation

#### Scenario: A slot rejoins placement when it becomes fillable
- **WHEN** a previously unfillable slot has an empty position at placement time
- **THEN** it receives a placement in that round like any other fillable slot

#### Scenario: An unfillable slot does not degrade the other slots' sharing
- **WHEN** a scope contains a slot with no empty positions and other slots that share at least one empty position
- **THEN** the unfillable slot takes no part in determining the placement
- **THEN** the fillable slots still receive the placement at a position they share

### Requirement: The ledger records shortfalls and repays them

The system SHALL maintain a per-slot record of placements across rounds, and SHALL repay any slot that was fillable yet received no placement by preferring it in a later round.

A repayment is itself recorded as a divergence event, so compensation is visible rather than silently absorbed.

#### Scenario: A fillable slot that received nothing is owed
- **WHEN** a slot was fillable in a round yet received no placement
- **THEN** the ledger records that slot as owed
- **THEN** a later round's placement prefers the owed slot over slots already placed

#### Scenario: Repayment is recorded as divergence
- **WHEN** a round's placement is determined by repaying an owed slot
- **THEN** that placement is recorded as a divergence event

#### Scenario: The ledger does not accumulate for unfillable slots
- **WHEN** a slot has no empty positions for several consecutive rounds
- **THEN** the ledger records no shortfall for those rounds
- **THEN** the slot owes nothing when it becomes fillable again
