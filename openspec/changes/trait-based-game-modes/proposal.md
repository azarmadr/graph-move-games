## Why

Every game mode today is welded into `Engine::make_move`, which fuses the swipe and the spawn into one atomic call on a single board. That makes two things structurally impossible: applying a spawn to a board *other* than the one being moved, and running several boards under one turn structure at all. Separately, `Board::sample_spawn` draws from thread-local `rand::rng()` — no seed, no state — so placement randomness lives nowhere in the game state: it cannot be owned by a bot, shared across boards, or saved.

The codebase is already shaped for this. `Edge::Move` and `Edge::Spawn` are distinct transition kinds, and `GraphStore` is a content-addressed DAG of boards and board actions. Only the orchestration layer fuses them. `game.rs:273` already documents the property this change promotes into a game mechanic: *"the deterministic merge step converges so the Move edge is shared. Spawn outcomes are intentionally random and may diverge."*

Introducing a board-level trait (`BoardGame`) and a game-level trait (`GameMode`) makes today's single-player 2048 a degenerate composition rather than a special case, and makes Survival Race a composition of the same parts.

## What Changes

- **New `BoardGame` trait** — one board, pure, RNG-free. Reports board facts (`valid_swipes`, `spawn_space`) rather than a single action enum, so a board never reports *which kind of action is due* (that is game-level knowledge).
- **Shared `Grid` + pluggable `MergeRule`** — `Grid<T>` owns every grid operation (positions, lines, slide, emptiness); `Board` delegates geometry to it and asks its `rule` how two tiles merge and how the board scores. `Rule::{EqualTiles, Threes}` are the two rules, so the same board plays 2048 or Threes and the two axes compose independently: `Single` + `Rule::Threes` is 2048 with Threes tiles, `Threes` + `Rule::EqualTiles` is Threes with 2048 tiles.
- **New `GameMode` trait** — seats, board slots, agents, and obligations, all exposed through the trait itself. Available choices are derived from the board trait (boards report what exists, obligations say what is due) — the mode reports the candidate set for the *next* choice, never an enumeration of complete moves, so simultaneous and multi-player resolution are expressible without combinatorial blow-up.
- **`Game<M>` wrapper over the mode** — identity and a command log (`Vec<Action>`) around the mode. `Engine` stores `HashMap<GameId, AnyGame>`, and the `AnyGame` enum is the only place a mode is matched on; each mode implements `GameMode` directly, so no mode method dispatches on its own kind.
- **Swipe and spawn are separate actions** — `Engine::make_move` applies a swipe, then drives every obligation that becomes due and can be resolved by an automated agent. A spawn is independently invocable. **BREAKING** for the WASM bridge contract.
- **Seeded, serializable randomness** — the seed lives with the bot, not the engine; the engine drives the bot and keeps its state in serialized game state, so a save restores with its agents intact. (Replayability is a non-goal: the command history is recorded, and that is enough if a replay is ever wanted.)
- **Agent abstraction** — a bot and a human fill a seat identically; one agent may hold seats on several boards and acts on each when due. RandomBot is today's `rand::rng()` behaviour, restated; difficulty defaults to the match and may be overridden per seat as a handicap.
- **N-way spawn fairness policy** — placement across an arbitrary set of board slots, with a fairness ladder (intersection → cluster → independent), a ledger that never skips a fillable slot, and divergence marking.
- **Spawn count scaling** — the number of tiles a spawn places is configurable per match: a fixed count, or a count scaled by the natural logarithm of empty cells (ceiling-rounded, never below one for a fillable slot), so a 5×5 does not go stale at one spawn per turn.
- **Survival Race mode** — N board slots, one swipe seat per player, and a single bot whose placement seat spans every slot (default), with per-slot bots sharing one seed as an in-game alternate. Players swipe their own boards; the shared bot places across all of them from a single decision, so the standings compare players rather than luck.
- **Crossfire mode** — N board slots where each player swipes their own board and fires one spawn at a single opponent's board chosen by a declared strategy (rotation by default), with placement chosen from the candidate set on the target. The counterattack is immediate: it lands without waiting for the other players to swipe.
- **Second tile rule: Threes** — `Rule::Threes` implements `MergeRule<u32>` with different merging (`1+2=3`, equal tiles ≥ 3) and rarity scoring. It ships with a `Threes` mode that supplies the deck-driven value source and opposite-edge placement, but the rule itself composes with every mode. `BoardId` includes the rule, so the DAG holds boards from both rules without collision.
- **Fix `Board::valid_moves`** — it never returns `Right` or `Down` and can emit duplicates (`board/mod.rs:225`, `board/mod.rs:243`). Latent today because the only consumer is `.is_empty()` for termination, which is correct by accident. `BoardGame::valid_swipes` becomes load-bearing the moment it exists.
- **Rename `Edge::Move` → `Edge::Swipe`** — "move" no longer names anything in the game model (a turn is an `Action`), while the edge carries a board-level swipe.

## Capabilities

### New Capabilities

- `board-actions`: the `BoardGame` trait plus the shared `Grid` and `MergeRule` — board-fact reporting, pure action application, pluggable tile merging and scoring, and the invariant that a board holds no RNG.
- `game-mode`: the `GameMode` trait — seats, board slots, agents, obligations exposed on the trait, actions derived from the board trait, and turn resolution.
- `agent`: the agent abstraction — bots interchangeable with humans, agents holding seats on several boards, bot-owned seeds, serializable bot state, per-seat handicaps.
- `spawn-fairness`: N-way spawn placement policy, the fairness ladder, spawn count scaling, the no-skip ledger, and divergence marking.
- `survival-race`: N-player mode composed of one swipe seat per player and a single bot whose placement seat spans every board slot, with per-slot same-seed bots as an in-game alternate.
- `crossfire`: N-player mode composed of one swipe seat per player on their own slot and one placement seat per player firing at a target chosen by a declared strategy, with immediate counterattack.
- `threes-board`: the second tile rule — Threes merge rules, rarity scoring, deck-driven values, opposite-edge placement, its own single-player mode, and how the rule composes with any mode.

### Modified Capabilities

- `wasm-bridge`: `make_move` applies a swipe and drives every automated obligation that becomes due; a human spawn is an independently invocable entry point validated against the candidate set; the engine state that crosses the bridge now includes agent state.
- `graph-model`: `Edge::Move` renamed to `Edge::Swipe`; `GraphStore` constrained to board states and board actions only, with no visibility of game modes, seats, or slots.
- `graph-rendering`: edge kind names in the graph payload change (`Move` → `Swipe`); colors, arrow markers, and inspector labels keyed on the renamed kind.
- `instance-management`: game creation starts from empty boards and resolves an opening spawn as the game's first action, replacing the single pre-seeded starting tile.

## Impact

**Crates**

- `crates/core` — largest change. `Grid<T>` is extracted from `Board`; `MergeRule`/`Rule` are introduced and `Board` becomes `{ grid, rule }`. A `Threes` mode lands beside `Single`, `Race`, and `Crossfire`. `spawn.rs` splits into a board-side apply and an agent-side sample; `game.rs`'s `Engine::make_move` is decomposed and `Engine` is reduced toward a recorder. `types.rs` gains `Game<M>`, `AnyGame`, `Table`, `Slot`, `Seat`, `Agent`, `Obligation`, `Action`, `ActionKind`, `Candidates`, `ScoreDelta`, `TurnReport`, `SpawnCount`, `SpawnPolicy`, `Deck`, `EntryRule`, and the renamed `Edge::Swipe`.
- `crates/wasm` — `make_move` signature and return contract change; new entry point for applying a spawn; `createGameWithConfig` gains `mode` and `rule` fields; `export_graph`/`import_graph` payloads grow bot, deck, and mode state.
- `crates/tui`, `crates/merge-cli` — `tui`'s game loop calls `Engine::make_move` directly and needs porting to the new mode-facing API; `merge-cli` builds `GameInstance` field by field, so new per-game state (mode, agents, obligations, policy) must be carried through it or it will be silently dropped from merged exports.

**Frontend**

- `src/utils/wasmBridge.ts` — `make_move` contract and graph payload edge kinds.
- `src/components/GameApp.ts`, `GameBoard.ts` — input handling asks the active mode for the choices its seats may make next (derived from the board trait, one placement at a time); the graph inspector and edge legend key off `Swipe`.
- `src/__tests__/` — `game-app`, `game-board`, `canvas-utils` tests that drive moves through the old fused call.

**Backward compatibility**

- Exported engine JSON gains fields; old exports will not deserialize unless a migration or version bump accompanies the change. `Engine::version` exists and should be used.

**Out of scope**

- Difficulty levels beyond `RandomBot`.
- Networked or asynchronous multiplayer. Survival Race is local.
- Any change to `GraphStore`'s content-addressing scheme or hash inputs, apart from adding the tile rule to the address so two rules never collide.
- Tile rules beyond 2048 and Threes. The traits and `Grid` are designed so more can be added; chess, word games, and other rulesets are not in this change.
