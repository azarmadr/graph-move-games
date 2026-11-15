## Why

Every game mode today is welded into `Engine::make_move`, which fuses the swipe and the spawn into one atomic call on one board. That makes two things structurally impossible: applying a spawn to a board *other* than the one being moved, and running several boards under one turn structure at all. Separately, `Board::sample_spawn` draws from thread-local `rand::rng()` — no seed, no state — so placement randomness lives nowhere in the game state: it cannot be owned by a bot, shared across boards, or saved.

The codebase is already shaped for this. `Edge::Move` and `Edge::Spawn` are distinct transition kinds, and `GraphStore` is a content-addressed DAG of boards and board actions. Only the orchestration layer fuses them. `game.rs` already documents the property this change promotes into a game mechanic: *"the deterministic merge step converges so the Move edge is shared. Spawn outcomes are intentionally random and may diverge."*

The change keeps one board-level trait and makes the game above it a single first-class structure. Today's single-player 2048 becomes the degenerate composition at one slot, not a special case, and Survival Race becomes a composition of the same parts.

## What Changes

- **One board trait** — reports board facts (`valid_swipes`, `spawn_space`), applies a pure action, and reports termination. It holds no rule value, score, RNG, mode, seat, or identifier. A board never reports which kind of action is due; that is game-level knowledge.
- **`Grid<T>` stays a trait; `Board` is concrete** — the repository already uses grid implementations, so geometry is a trait with an in-repo `DenseGrid<T>`. The board is one concrete value (`DenseGrid<u32>`) that the graph can store, compare, hash, and serialize. There is no `Board<G>`.
- **Merge is a threshold, not a rule enum** — `MergeRule { split }` decides merging. Below the split, different tiles merge when their sum is at most the split; at or above it, equal tiles merge. `split = 2` is classic 2048, `split = 3` is Threes, and other splits are configuration rather than a new type.
- **Numeric tiles stay natural** — tiles are `u32`; empty cells are `None`. There is no `Tile` enum and no zero sentinel. A later word board is a different concrete board type implementing the same trait.
- **Spawn is a spawn-only variant** — `SpawnVariant` owns value source, position policy, count, and the score formula. It has no swipe callback and no `after_swipe`. The game owns the swipe trace and passes it as spawn context; a Threes spawn reads it to place on the opposite edge.
- **Score is derived, never stored** — the spawn variant computes the score from the board and the recorded spawn credit. Classic uses `Σ t·(log2 t − 1)` minus spawn credit; Threes uses the rarity sum `3^(k+1)` for `3·2^k`. There is no score field, no `ScoreDelta`, and no scoring enum.
- **`Game` and `Table` are first-class** — one concrete `Game` owns one first-class `Table` of slots, seats, obligations, and agents. There is no `GameMode` trait, no `Game<M>`, and no `AnyGame` enum. A mode is private wiring over `ModeState`.
- **Config and variant live on `Game`** — every mode receives the same `GameConfig` and `SpawnVariant`; only fairness policy and target cursors remain mode-specific.
- **Swipe and spawn are separate actions** — the engine applies a swipe, then drives every obligation that becomes due and can be resolved by an automated agent. A spawn is independently invocable. **BREAKING** for the WASM bridge contract.
- **Seeded, serializable randomness** — randomness lives with the agent that needs it and serializes with the game, so a save restores with its agents intact.
- **Agent abstraction** — a bot and a human fill a seat identically; one agent may hold seats on several boards and acts on each when due.
- **N-way spawn fairness policy** — placement across an arbitrary set of board slots, with a fairness ladder (intersection → cluster → independent), a ledger that never skips a fillable slot, and divergence marking.
- **Spawn count scaling** — a Classic spawn places a fixed count or a count scaled by the natural logarithm of empty cells (ceiling-rounded, never below one for a fillable slot). A Threes spawn places one card.
- **Survival Race mode** — N board slots, one swipe seat per player, and a single bot whose placement seat spans every slot (default), with per-slot same-seed bots as an in-game alternate.
- **Crossfire mode** — N board slots where each player swipes their own board and fires one spawn at a single opponent's board chosen by a declared strategy (rotation by default), with an immediate counterattack.
- **Threes is a variant, not a mode** — the threshold-3 merge plus the Threes spawn variant (deck, opposite-edge placement, rarity score). It composes with any mode; there is no separate Threes mode or Threes board type.
- **IDs and schema live in the graph** — `BoardId`, `EdgeId`, and `GameId` move into the graph module. `BoardId` hashes content **and** merge threshold; the node stores the threshold beside the board. `GraphStore` is explicit node and edge maps, so the serialized schema is the storage schema.
- **Fix `Board::valid_moves`** — it never returned `Right` or `Down` and could emit duplicates. `valid_swipes` is load-bearing the moment anything depends on it.
- **Rename `Edge::Move` → `Edge::Swipe`** — "move" no longer names anything in the game model (a turn is an `Action`), while the edge carries a board-level swipe.

## Capabilities

### New Capabilities

- `board-actions`: the board trait, the `Grid<T>` contract with `DenseGrid<T>`, the merge threshold, pure action application, spawn space, and termination. A board is content and geometry only: no rule value, score, RNG, mode, or identifier.
- `game-mode`: the first-class `Game` and `Table` — slots, seats, obligations, agents, candidates derived from board reports, obligation timing, pending seats, and outcome. Config and spawn variant are shared by every mode.
- `agent`: the agent abstraction — bots interchangeable with humans, agents holding seats on several boards, agent-owned seeds, serializable agent state, per-seat handicaps.
- `spawn-fairness`: N-way placement policy over a seat's slot scope, the fairness ladder, spawn count rules, the no-skip ledger, and divergence marking.
- `survival-race`: N-player mode composed of one swipe seat per player and a single bot whose placement seat spans every board slot, with per-slot same-seed bots as an in-game alternate.
- `crossfire`: N-player mode composed of one swipe seat per player on their own slot and one placement seat per player firing at a target chosen by a declared strategy, with immediate counterattack.
- `threes-board`: the Threes spawn variant and threshold-3 merge — deck-driven values, opposite-edge placement, rarity scoring, and composition with any mode and any threshold. The artifact path is kept from the earlier draft; its content is now variant-based.

### Modified Capabilities

- `wasm-bridge`: creation takes a shared config plus a spawn-variant config; `make_move` applies a swipe and drives every automated obligation; `apply_spawn` is an independently invocable entry point validated against the variant's candidate set; `candidates` reports the next choice; returned scores are derived; exported state includes the deck, spawn credit, last swipe, and agent state.
- `graph-model`: `BoardId` includes the merge threshold; IDs live in the graph module; the graph node stores the threshold; `GraphStore` is explicit node and edge maps; the graph records boards and board actions only, never games, seats, slots, scores, or variants.
- `graph-rendering`: edge kind names in the graph payload change (`Move` → `Swipe`); colors, arrow markers, and inspector labels keyed on the renamed kind.
- `instance-management`: game creation takes a mode, merge threshold, and spawn variant, starts from empty boards, and resolves an opening spawn as the game's first action; termination and score are derived.

## Impact

**Crates**

- `crates/core` — largest change. A `grid` module holds the `Grid<T>` trait and `DenseGrid<T>`; `board` holds `MergeRule`, the concrete numeric board, and the board trait; `graph` holds IDs and the explicit node/edge store; `game` holds the first-class `Game`, `Table`, config, spawn variants, and private mode wiring; `engine.rs` joins a game to the graph. `spawn.rs` splits into a board-side placement and a variant-side sample. `types.rs` loses its IDs and its score field.
- `crates/wasm` — `make_move` signature and return contract change; new entry points for `candidates` and `apply_spawn`; `createGameWithConfig` takes the config/variant shape; `export_graph`/`import_graph` payloads grow deck, credit, last-swipe, and agent state.
- `crates/tui`, `crates/merge-cli` — the `tui` game loop must move to the game-facing verbs; `merge-cli` must carry config, variant, deck, agents, and obligations through merge/rebuild or silently drop them from merged exports.

**Frontend**

- `src/utils/wasmBridge.ts` — the `make_move` contract and the graph payload edge kinds.
- `src/components/GameApp.ts`, `GameBoard.ts` — input handling asks for the seat's candidates (one placement at a time); the graph inspector and edge legend key off `Swipe`.
- `src/__tests__/` — tests that drive moves through the old fused call.

**Backward compatibility**

- Exported engine JSON changes shape and gains fields. `Engine::version` is bumped and checked **before** the graph is deserialized, so old exports are rejected with a clear message rather than failing mid-parse.

**Out of scope**

- Difficulty levels beyond `RandomBot`.
- Networked or asynchronous multiplayer. Survival Race and Crossfire are local.
- Changing the content-addressing scheme beyond adding the merge threshold to the board address.
- A word tile or word board. The numeric board is `u32`; a word board is a later concrete type implementing the same board trait.
