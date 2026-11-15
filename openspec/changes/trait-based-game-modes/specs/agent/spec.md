## Purpose

Defines what fills a seat: an agent produces the actions for the seat it holds, and from the seat's perspective a human and a bot are indistinguishable. Any agent that requires randomness owns that randomness and exposes it as part of the match state, so that a saved match restores to a playable continuation with its agents intact.

## ADDED Requirements

### Requirement: Agents are interchangeable across seats

The system SHALL allow any agent to fill any seat, without the seat distinguishing a human-operated agent from an automated one.

#### Scenario: An automated agent fills a seat a human could fill
- **WHEN** an automated agent is bound to a seat
- **THEN** that seat accepts its actions through the same interface as a human-operated one
- **THEN** the seat imposes no additional constraint on the automated agent

#### Scenario: A human and an automated agent hold different seats in the same match
- **WHEN** one seat is filled by a human-operated agent and another by an automated one
- **THEN** the match proceeds without either seat being treated differently

### Requirement: An automated seat is driven without external input

The system SHALL resolve an obligation held by an automated agent as soon as it becomes due, without waiting for input from outside the match, and SHALL leave a human-held obligation pending instead.

The engine is the driver, and the agent's random state is part of the match state — driving it is the same operation as saving it.

#### Scenario: A bot's obligation resolves in the call that made it due
- **WHEN** an obligation becomes due on a seat held by an automated agent
- **THEN** the engine resolves it as part of that call
- **THEN** the caller receives a state in which the bot's action has landed

#### Scenario: A human's obligation is reported pending
- **WHEN** an obligation becomes due on a seat held by a human-operated agent
- **THEN** the engine reports that seat as pending
- **THEN** no action is taken on that seat's behalf

### Requirement: Randomness is owned by the agent, never by the board

The system SHALL require that any random source an agent depends upon is held by that agent. A board SHALL NOT hold or consult a random source.

#### Scenario: A board applies an action without consulting any random source
- **WHEN** an action is applied to a board
- **THEN** the resulting board is determined entirely by the board's prior content and the action

#### Scenario: An agent supplies the draw it needs
- **WHEN** an agent produces an action that requires a random choice
- **THEN** the choice is drawn from the agent's own random source

#### Scenario: The spawn variant draws values through the agent's random source
- **WHEN** a Classic spawn draws a tile value for a placement seat
- **THEN** the draw is taken from the random source of the agent filling that seat
- **THEN** the spawn variant holds no random source of its own

### Requirement: Agent state is part of exported match state

The system SHALL include the state of every agent filling a seat when the match state is exported, and SHALL restore it on import.

An agent's state includes any seed or random-source state sufficient to continue its sequence of draws.

#### Scenario: Export includes agent state
- **WHEN** a match state is exported
- **THEN** the exported state contains the state of every agent filling a seat

#### Scenario: Import restores agent state
- **WHEN** an exported match state is imported
- **THEN** each agent resumes from the state captured at export

#### Scenario: An agent with no random source exports no seed state
- **WHEN** an agent filling a seat requires no randomness
- **THEN** the exported state carries no random-source state for that agent

### Requirement: Difficulty defaults to the match and may be overridden per seat as a handicap

The system SHALL configure an agent's playing strength for the whole match by default, and SHALL allow a seat to be given a different strength as an explicit handicap.

A handicap is a deliberate asymmetry chosen by the players; absent one, every automated seat in a match is filled by an agent of the match's configured strength.

#### Scenario: Strength applies to every automated seat by default
- **WHEN** a match is configured with an agent playing strength and no seat overrides it
- **THEN** every automated seat in that match is filled by an agent of that strength

#### Scenario: A seat may be given a handicap
- **WHEN** a match is configured with a per-seat strength override for one seat
- **THEN** that seat's agent plays at the overridden strength
- **THEN** the override is recorded as part of the match configuration

#### Scenario: A handicap applies to human-held seats only through their agent
- **WHEN** a seat is held by a human-operated agent
- **THEN** a strength override on that seat has no effect until a bot fills it
