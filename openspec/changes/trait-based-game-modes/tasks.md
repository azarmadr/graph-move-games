## 1. Fix `valid_swipes` before anything depends on it

- [x] 1.1 Add a property test for `Board::valid_moves`: for every board and every direction, the direction is reported iff applying it produces different content, and no direction appears twice.
- [x] 1.2 Fix `Board::valid_moves` (`board/mod.rs` ~225, ~243): it never reported `Right` or `Down` and could emit duplicates. Also fixed `merge_line`'s swapped row/column length, which panicked on non-square boards, and replaced the broken line helpers with a correct in-place scan (no board clone, no per-line allocation) that detects slide-then-merge.
- [x] 1.3 Add the `is_terminated` equivalence test (`no swipes` ⟺ `terminated`) and confirm it passes before and after 1.2, so the fix is observed rather than assumed.

## 2. Grid, merge threshold, board trait, concrete board, graph IDs

- [ ] 2.1 Add a `grid` module: `Grid<T>` trait (rows, cols, get, set; provided positions, indexed iteration, empties, line, slide, is_empty, is_full) and `DenseGrid<T>` storing rows, cols, and `Vec<Option<T>>`. Remove the external `grid` dependency and update test helpers that use `grid::grid![...]`.
- [ ] 2.2 Define `MergeRule { split }` with `CLASSIC = 2`, `THREES = 3`, and `merge(a, b)`. Below the split, merge different tiles only when the sum is at most the split; at or above it, merge equal tiles only. Test splits 2, 3, and 4 plus no-double-merge in one swipe.
- [ ] 2.3 Define the board trait (`BoardGame`), `Action::{Swipe, Place}`, `SpawnSpace`, and `ActionError`. The trait has only `valid_swipes(merge)`, `spawn_space`, `apply(action, merge)`, and `is_terminal(merge)`; no `id`, no score, no RNG.
- [ ] 2.4 Replace `Board { tiles: Grid<u32> }` with concrete `Board { grid: DenseGrid<u32> }` and implement the board trait. Route slide/merge through `Grid::slide` and `MergeRule`, and make `apply` pure: a swipe returns the merged board, a placement sets exactly the given cells.
- [ ] 2.5 Split `Board::sample_spawn` into a board-side placement (`apply(Place(cells))`) and a caller-side sampler. The board draws from no random source. Keep the existing thread-local sampler alive temporarily behind the caller until group 4 replaces it with an agent-owned RNG.
- [ ] 2.6 Add `graph/ids.rs` with `BoardId`, `EdgeId`, and `GameId`; `BoardId` hashes the merge split plus board content. Add `BoardNode { merge, board }` and rewrite `GraphStore` as explicit `nodes: HashMap<BoardId, BoardNode>` and `edges: HashMap<EdgeId, GraphEdge>`, with no hidden petgraph index. Port `crates/wasm` and `crates/merge-cli` to the explicit maps.
- [ ] 2.7 Route the fused `Engine::make_move` through the new pieces while keeping its external signature and single-board contract. Record the merge threshold on each inserted node and stop storing or reporting a score on the board.
- [ ] 2.8 Tests: grid operations are rule-agnostic; `apply` is pure for identical inputs; `spawn_space` is stable and empty-only; swipe availability and termination agree under a threshold; a placement changes exactly the named cells; identical cells under different splits yield different `BoardId`s; the graph serializes and restores as explicit node/edge maps.

## 3. Rename `Edge::Move` → `Edge::Swipe`

- [ ] 3.1 Rename the variant and JSON key; keep the serialized kind tag at `0` so edge hashing is unchanged.
- [ ] 3.2 Bump `Engine::version` and stage a version check that reads the version **before** the graph is deserialized, so pre-rename exports are rejected with a clear message.
- [ ] 3.3 Update the WASM payload, `src/utils/wasmBridge.ts`, and the graph edge legend/inspector labels (`Move` → `Swipe`).
- [ ] 3.4 Tests: `EdgeId` is unchanged for the same transition, and an old export is rejected by version rather than failing to parse.

## 4. Agent, seeded randomness, serialized state

- [ ] 4.1 Define `Agent`, `AgentKind`, `Difficulty`, and `RngState` (`seed`, `draws`).
- [ ] 4.2 Replace the remaining thread-local `rand::rng()` in the sampling path with an agent-owned `RngState` passed into the sampler.
- [ ] 4.3 Serialize agent state with the game; add an export/import round-trip test asserting the stream resumes at the same draw.
- [ ] 4.4 Carry agent state through `crates/merge-cli` so merged exports do not silently drop it.

## 5. First-class `Game`, `Table`, config, spawn variant, Single mode

- [ ] 5.1 Define `Game`, `Table`, `Slot`, `Seat`, `SeatId`, `BoardSlot`, `PlayerId`, `Obligation`, `ActionKind`, `Candidates`, `TurnReport`, and private `ModeState`.
- [ ] 5.2 Define `CreateGame`, `GameConfig`, `ModeConfig`, `VariantConfig`, `SpawnCount`, and `Difficulty`; resolve the merge threshold from an explicit value or the variant's default.
- [ ] 5.3 Define `SpawnVariant::{Classic, Threes}` with `ClassicSpawn`, `SpawnContext`, and `SwipeTrace`; expose `candidates`, `count`, `values(rng)`, `spawn_credit`, `score`, and `default_merge`. Keep the trait spawn-only: no swipe method and no `after_swipe`.
- [ ] 5.4 Implement `Single` as the scope-1 mode wiring. Creation inserts an empty board and resolves an opening spawn as the first action; no seeded tile.
- [ ] 5.5 Implement obligation resolution with the `Immediate | EndOfRound` option, the round gate, and exclusion of seats whose scope has no live slot.
- [ ] 5.6 Make `Engine` store `Game`, expose `swipe`, `place`, and `candidates`, append each action to `history`, and record `TurnReport` transitions into the graph. `Game` owns the last swipe trace and passes it to the variant at spawn time.
- [ ] 5.7 Tests: single-player equals the composition at one slot; history round-trips; candidates derive from `valid_swipes`/`spawn_space`; `last_swipe` survives export/import; score is derived and never stored.

## 6. Threes spawn variant and threshold-3 merge

- [ ] 6.1 Test the threshold-3 merge through `MergeRule::merge`: `1+2=3`, `3+3=6`, `6+6=12`, no `1+1`, no `2+2`, and no double merge in one swipe.
- [ ] 6.2 Define `ThreesSpawn`, `Deck`, and deck shuffling from the creation seed; the deck and cursor serialize with the game.
- [ ] 6.3 Restrict post-swipe Threes candidates to empty cells on the edge opposite the swipe direction, in the lines the swipe changed. An opening spawn has no trace and admits every empty cell.
- [ ] 6.4 Implement Threes rarity scoring: `0` for tiles below 3, `3^(k+1)` for `3·2^k`. The variant computes it from the board; nothing stores it.
- [ ] 6.5 Ensure the Threes variant composes with any mode and any threshold; exports/imports preserve deck order and cursor.
- [ ] 6.6 Tests: every merge case, deck order survives export/import, edge restriction, rarity totals, and the Classic/Threes cross combinations under Single and a multiplayer mode.

## 7. `SpawnPolicy`, fairness ladder, spawn count

- [ ] 7.1 Define `SpawnPolicy`, `Shortfall`, and `Divergence`.
- [ ] 7.2 Implement the fairness ladder over **fillable** slots only (intersection → cluster → independent), starting from the variant's candidate sets.
- [ ] 7.3 Implement the no-skip ledger: a fillable slot always receives a placement; an unfillable slot is excluded and rejoins when fillable.
- [ ] 7.4 Implement Classic count rules: fixed, and `ceil(ln(empties))`, clamped to the slot's empties and never below one for a fillable slot. A Threes spawn always places one card.
- [ ] 7.5 Tests: the ladder partitions the scope, no fillable slot is skipped, and counts are monotonic in empties.

## 8. Survival Race

- [ ] 8.1 Implement `Race`: N slots, one swipe seat per player on their own slot, one shared placement seat spanning every slot.
- [ ] 8.2 Default the spawn obligation to `EndOfRound`; enforce the round gate and let terminated slots leave both the spawn scope and the gate.
- [ ] 8.3 Implement the per-slot same-seed bot alternate; record divergence rather than absorbing it.
- [ ] 8.4 Tests: N = 1 matches `Single`, identical placement across slots under the shared seat, and divergence is marked under the alternate.

## 9. Crossfire

- [ ] 9.1 Implement `Crossfire`: N slots, one swipe seat per player, one placement seat per player targeting a single opponent.
- [ ] 9.2 Implement the target strategy with rotation as the default; leave first-come-first-served as a documented alternate.
- [ ] 9.3 Default the counterattack to `Immediate`; open the match with every player's placement seat pending, resolved in seat order against the rotation's first target.
- [ ] 9.4 Tests: rotation covers every other slot once per cycle, terminated slots are skipped, the mode requires N ≥ 2, and Threes spawning reads the target board's last swipe.

## 10. WASM bridge and frontend

- [ ] 10.1 Add the `candidates` query so the UI asks for the next choice rather than enumerating moves.
- [ ] 10.2 Make `makeMove` apply the swipe and then drive every automated obligation that becomes due; leave human-held obligations pending.
- [ ] 10.3 Validate a human `applySpawn` against the candidate set; reject positions outside it, reject spawns on a full board, and do not advance the deck on rejection.
- [ ] 10.4 Change `createGameWithConfig` to take `{config, variant}`, with `mode`, `merge`, and variant defaults for single-player Classic.
- [ ] 10.5 Frontend: render the pending seat explicitly, drive input from `candidates`, and key the edge legend/inspector on `Swipe`.
- [ ] 10.6 Tests: bridge contract for valid/invalid swipes and spawns, pending-state rendering, a Threes game created through the bridge, and a derived score in the returned state.

## 11. Port the consumers

- [ ] 11.1 Port `crates/tui`'s game loop from the fused `Engine::make_move` to the game-facing `swipe`/`place`/`candidates` API.
- [ ] 11.2 Update `crates/merge-cli` to carry config, variant, agents, obligations, deck, credit, and last swipe through merge/rebuild.
- [ ] 11.3 Verify no per-game state is dropped from merged exports.

## 12. Verification

- [ ] 12.1 `cargo test --workspace` passes.
- [ ] 12.2 `pnpm test` passes for the frontend tests touched by the bridge change.
- [ ] 12.3 Export → import → continue produces the same next state for a 2048 game, a Threes game, a Race, and a Crossfire.
- [ ] 12.4 `openspec validate "trait-based-game-modes" --no-interactive --strict` passes.
