## Purpose

Defines the game-level contract: one first-class `Game` owns a first-class
`Table` of slots, seats, obligations, and agents, and drives every mode through
the same board trait. There is no parallel gameplay trait and no special-case
single-player path.

## ADDED Requirements

### Requirement: The game is one first-class structure

The system SHALL represent a match as one concrete game value that owns its
table, configuration, spawn variant, and mode wiring.

The system SHALL NOT require a separate gameplay trait, a generic game wrapper,
or a mode-tagged enum at the storage boundary.

#### Scenario: One game value holds the match
- **WHEN** a match is inspected
- **THEN** it owns its table, config, spawn variant, history, and last swipe
- **THEN** its mode-specific state is private to the game

#### Scenario: Adding a mode does not add a public abstraction
- **WHEN** a new mode is added
- **THEN** its seating and obligation wiring are added to the game
- **THEN** no existing public trait or generic wrapper changes

### Requirement: The table is first-class shared state

The system SHALL model the match table as a first-class value containing the
board slots, seats, open obligations, agents, the round, and the seats that
have acted in the round.

Configuration and the spawn variant SHALL live on the game, not on a mode, so
every mode receives the same dimensions, merge threshold, value source, and
spawn count.

#### Scenario: Every mode receives the shared config
- **WHEN** any mode is created
- **THEN** its game holds one config and one spawn variant
- **THEN** no mode keeps a second copy of dimensions, merge, deck, weights, or count

#### Scenario: Mode state is only what differs
- **WHEN** a Race and a Crossfire are compared
- **THEN** their tables have the same shape
- **THEN** their different state is limited to the Race fairness policy and the Crossfire target cursors

### Requirement: A seat binds an agent to a set of board slots

The system SHALL model participation as seats, where each seat binds an agent
to one or more board slots.

The set of board slots a seat covers is that seat's scope. What the seat owes
is carried by an obligation, not by the seat: an obligation names the action
kind (`Swipe` or `Place`) it requires.

#### Scenario: A seat that owes a swipe covers a single board slot
- **WHEN** a mode creates a swipe obligation against a seat
- **THEN** that seat's scope names the board slot the swipe acts upon

#### Scenario: A seat that owes a placement may cover several board slots
- **WHEN** a mode creates a placement obligation against a seat
- **THEN** that seat's scope may name more than one board slot
- **THEN** a single action by that seat is applied to every slot in its scope

#### Scenario: The same agent may hold more than one seat
- **WHEN** an agent is bound to two or more seats
- **THEN** each seat reports its own scope independently
- **THEN** each obligation reports its own action kind

### Requirement: Board slots are local to the game

The system SHALL address the boards a match operates on by identifiers local to
that match, distinct from the content-addressed identifiers of the graph store.

A board slot identifies a position within a match; the content-addressed
identifier identifies board content and its merge threshold wherever it occurs.

#### Scenario: Two slots may hold the same board content
- **WHEN** two board slots currently hold boards with identical content and threshold
- **THEN** the slots remain distinguishable from one another
- **THEN** both resolve to the same content-addressed identifier

#### Scenario: A slot's identifier is stable while its content changes
- **WHEN** a board slot's board changes during play
- **THEN** the slot's identifier is unchanged
- **THEN** the content-addressed identifier it resolves to changes

### Requirement: Available choices come from the board trait

The system SHALL derive what a seat may choose next from the board reports of
the boards in that seat's scope, and SHALL NOT enumerate complete actions.

The boards say what exists (`valid_swipes`, `spawn_space`), the obligation says
what is due, and the seat's scope or the obligation's target says where it
applies. The game holds no separate list that could disagree with the boards.

For a seat that must produce several placements in one action, the system SHALL
report the candidates for the next placement given the choices already made,
rather than the combinations those choices could become.

#### Scenario: A seat with no open obligation reports no choice
- **WHEN** a seat holds no obligation that is currently due
- **THEN** no choice is reported for that seat

#### Scenario: Choices reflect the state of every slot in scope
- **WHEN** a seat's scope covers more than one board slot
- **THEN** the choices reported for that seat account for the state of every slot in the scope

#### Scenario: The game holds no independent list
- **WHEN** a board's reports change after an action is applied
- **THEN** the choices available to a seat over that board change accordingly
- **THEN** the game holds no separate list that could disagree with the board's reports

#### Scenario: Several placements do not multiply the reported choices
- **WHEN** a seat must place several tiles in one action
- **THEN** the choices reported are the positions admissible for the next placement given those already chosen
- **THEN** the number of reported choices does not grow with the number of placements remaining

### Requirement: Seating and obligations are readable

The system SHALL expose a game's seat table and its open obligations.

A seat entry reports the agent that fills it and its scope. An obligation
reports the seat that owes it, the action kind it requires, its target, and
when it resolves.

#### Scenario: The seat table is readable
- **WHEN** a game's seats are queried
- **THEN** each reported seat identifies its agent and the board slots in its scope

#### Scenario: Open obligations are readable
- **WHEN** a game's obligations are queried
- **THEN** each reported obligation identifies the seat that owes it, the action kind it requires, and its target

#### Scenario: An agent may hold seats on several boards
- **WHEN** one agent is bound to seats whose scopes name different board slots
- **THEN** the agent acts on each seat when that seat's obligation comes due
- **THEN** acting on one seat neither waits for nor blocks the agent's other seats

### Requirement: Applying an action has an immediate and a deferred effect

The system SHALL apply an action so that its effect on the boards in scope is
immediate, and so that it may additionally create obligations on other seats.

The boards transitioned by an action are those in the acting seat's scope. An
obligation is a duty that a named seat has acquired and must perform.

#### Scenario: The acting seat's boards transition immediately
- **WHEN** a seat applies an action
- **THEN** every board slot in that seat's scope transitions as the action specifies

#### Scenario: An action may create an obligation on a seat
- **WHEN** a mode declares that an action of a given kind obliges a seat — another seat, or the acting seat itself
- **THEN** applying that action records an obligation against the named seat

#### Scenario: An action that changes no board creates no obligation
- **WHEN** a seat applies an action that produces no change in any board in its scope
- **THEN** no board slot transitions
- **THEN** no obligation is created

### Requirement: When an obligation resolves is configurable

The system SHALL resolve each obligation either immediately after the action
that creates it or only after every seat owing the relevant action and still
able to act has applied its action for the round, as configured for that
obligation.

Timing is an option of the match configuration, not a property of a mode: each
mode ships a default, and a match may override it.

An immediate obligation lands the moment it is created. A deferred obligation
is held until the round's relevant seats have all acted, because its effect
must be computed against the final state of every board it touches. A seat
whose scope contains no board it can act on is not counted: it can never act
again, and counting it would hold the round open forever.

#### Scenario: An immediate obligation lands at once
- **WHEN** a mode declares a created obligation as immediate
- **THEN** the obligation resolves as part of the action that created it
- **THEN** its effect is live before any other seat acts

#### Scenario: A deferred obligation is held until the round is complete
- **WHEN** a mode declares a created obligation as deferred and one seat has applied its action while another owing the same action has not
- **THEN** the obligation created by the first seat is not yet resolved
- **THEN** the affected board slot has not received the deferred effect

#### Scenario: Deferred obligations resolve together
- **WHEN** every seat owing the relevant action and able to act has applied its action for the round
- **THEN** all held obligations resolve
- **THEN** the deferred effects land on their target slots in the same round

#### Scenario: A seat that cannot act does not hold up the round
- **WHEN** a seat owing the relevant action has no board in its scope left to act on while other such seats still do
- **THEN** that seat is not counted toward the round's completion
- **THEN** the round completes without an action from that seat
- **THEN** the deferred obligations resolve for the seats that did act

#### Scenario: Timing is an option of the match
- **WHEN** a match overrides the timing configured for an obligation
- **THEN** the obligation resolves at the configured timing rather than the mode's default

### Requirement: Pending seats are reported

The system SHALL report the seats that currently hold an unresolved obligation.

#### Scenario: A seat with an open obligation is reported as pending
- **WHEN** a seat holds an unresolved obligation
- **THEN** that seat is reported among the pending seats

#### Scenario: A seat with no open obligation is not pending
- **WHEN** a seat holds no unresolved obligation
- **THEN** that seat is not reported among the pending seats

### Requirement: Match outcome is reported once play has concluded

The system SHALL report whether the match has concluded, and when it has, which
player won, using the scores derived from the boards and spawn credit.

A match concludes when no slot admits a further swipe.

#### Scenario: A match in progress has no outcome
- **WHEN** at least one slot admits a swipe
- **THEN** the match is reported as not concluded

#### Scenario: A concluded match reports a winner
- **WHEN** no slot admits a swipe
- **THEN** the match is reported as concluded
- **THEN** the outcome identifies the player with the highest derived score, or reports a draw
