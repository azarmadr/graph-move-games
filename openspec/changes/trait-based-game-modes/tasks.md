## 1. Fix `valid_swipes` before anything depends on it

- [x] 1.1 Add a property test for `Board::valid_moves`: for every board and every direction, the direction is reported iff applying it produces different content, and no direction appears twice.
- [x] 1.2 Fix `Board::valid_moves` (`board/mod.rs` ~225, ~243): it currently never reports `Right` or `Down` and can emit duplicates. Also fixed `merge_line`'s swapped row/column length, which panicked on non-square boards, and replaced the broken line helpers with a correct in-place scan (no board clone, no per-line allocation) that detects slide-then-merge.
- [x] 1.3 Add the `is_terminated` equivalence test (`no swipes` ⟺ `terminated`) and confirm it passes before and after 1.2, so the fix is observed rather than assumed.

## 2. `Grid`, `MergeRule`, and `BoardGame` on `Board`

- [ ] 2.1 Extract `Grid<T>` from `Board`: positions, rows/cols, lines, emptiness, `slide`, and stable iteration. It must not know about tile rules or modes.
- [ ] 2.2 Define `MergeRule<T>` (`merge`, `score_delta`) and `Rule::{EqualTiles, Threes}`; implement `MergeRule<u32>` for `Rule`. For now `Threes` may be a stub.
- [ ] 2.3 Define `BoardGame`, `SpawnSpace`, `ActionError`, and `ScoreDelta::{Add, Set}` in `crates/core`.
- [ ] 2.4 Implement `BoardGame` for `Board { grid, rule }`: `id` (rule + content), `valid_swipes`, `spawn_space`, `apply`, `is_terminal`.
- [ ] 2.5 Split `Board::sample_spawn` into a board-side `apply(Place)` and an agent-side sample; the board takes no RNG.
- [ ] 2.6 Route `Engine::make_move` through the new pieces while keeping its fused external signature; no contract change yet.
- [ ] 2.7 Tests: `Grid` operations are rule-agnostic, `apply` is pure for identical inputs, `spawn_space` is stable and empty-only, `EqualTiles` swipe deltas are `Add(sum)`, and placement deltas are `Add(0)`.

## 3. Rename `Edge::Move` → `Edge::Swipe`

- [ ] 3.1 Rename the variant and JSON key; keep the serialized kind tag at `0` so edge hashing is unchanged.
- [ ] 3.2 Bump `Engine::version` and stage a version check that reads the version **before** the graph is deserialized, so pre-rename exports are rejected with a clear message.
- [ ] 3.3 Update the WASM payload, `src/utils/wasmBridge.ts`, and the graph edge legend/inspector labels (`Move` → `Swipe`).
- [ ] 3.4 Tests: `EdgeId` is unchanged for the same transition, and an old export is rejected by version rather than failing to parse.

## 4. Agent, seeded randomness, serialized state

- [ ] 4.1 Define `Agent`, `AgentKind`, `Difficulty`, and `RngState` (`seed`, `draws`).
- [ ] 4.2 Replace thread-local `rand::rng()` in the sampling path with an agent-owned `RngState` passed into the sampler.
- [ ] 4.3 Serialize agent state with the game; add an export/import round-trip test asserting the stream resumes at the same draw.
- [ ] 4.4 Carry agent state through `crates/merge-cli` so merged exports do not silently drop it.

## 5. `Game<M>`, `AnyGame`, seats, slots, obligations

- [ ] 5.1 Define `Game<M>`, `AnyGame`, `Table<B>`, `Slot<B>`, `Seat`, `Obligation`, `SeatId`, `BoardSlot`, `PlayerId`, `Action`, `ActionKind`, `Candidates`, `Resolution`.
- [ ] 5.2 Define the `GameMode` trait: associated `Board: BoardGame`, `seats`, `obligations`, `board`, `candidates`, `play(Action)`, `outcome`.
- [ ] 5.3 Implement `Single` as the scope-1 composition; creation inserts empty boards and resolves an opening spawn (no seeded tile).
- [ ] 5.4 Implement obligation resolution with the `Immediate | EndOfRound` option, the round gate, and exclusion of seats whose scope has no live slot.
- [ ] 5.5 Make `Engine` store `AnyGame`; expose the `swipe` and `place` verbs, append each action to `history: Vec<Action>`, and record `TurnReport<B>` transitions into the graph.
- [ ] 5.6 Tests: the D13 falsification (single-player = the composition at N = 1), history round-trip, and `candidates` deriving from `valid_swipes`/`spawn_space`.

## 6. Threes tile rule and mode

- [ ] 6.1 Implement `Rule::Threes` with the merge table (`1+2=3`, equal tiles ≥ 3, no double merge in one swipe) and unit-test it through `MergeRule::merge`.
- [ ] 6.2 Implement Threes rarity scoring as `ScoreDelta::Set`; color tiles contribute nothing.
- [ ] 6.3 Define `Deck`, `ThreesConfig`, and `EntryRule`; restrict post-swipe candidates to the opposite-edge cells of the lines the swipe changed.
- [ ] 6.4 Implement the `Threes` mode and its `GameMode` impl; open with a card drawn from the deck.
- [ ] 6.5 Include the rule in `BoardId`; store boards from both rules in one graph without collision.
- [ ] 6.6 Tests: every merge case, deck order survives export/import, edge restriction, and same cells under different rules produce different ids.
- [ ] 6.7 Test the two cross combinations: `Single` + `Rule::Threes` and `Threes` + `Rule::EqualTiles`.

## 7. `SpawnPolicy`, fairness ladder, spawn count

- [ ] 7.1 Define `SpawnPolicy`, `Shortfall`, `Divergence`, and `SpawnCount::{Fixed(u8), ByEmpties}`.
- [ ] 7.2 Implement the fairness ladder over **fillable** slots only (intersection → cluster → independent).
- [ ] 7.3 Implement the no-skip ledger: a fillable slot always receives a placement; an unfillable slot is excluded and rejoins when fillable.
- [ ] 7.4 Implement count rules: fixed, and `ceil(ln(empties))`, clamped to the slot's empties and never below one for a fillable slot.
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
- [ ] 9.4 Tests: rotation covers every other slot once per cycle, terminated slots are skipped, and the mode requires N ≥ 2.

## 10. WASM bridge and frontend

- [ ] 10.1 Add the `candidates` query so the UI asks for the next choice rather than enumerating moves.
- [ ] 10.2 Make `makeMove` apply the swipe and then drive every automated obligation that becomes due; leave human-held obligations pending.
- [ ] 10.3 Validate `applySpawn` against the candidate set; reject positions outside it and reject spawns on a full board.
- [ ] 10.4 Add `mode` and `rule` fields to `createGameWithConfig` (defaults `"single"` and `"equal-tiles"`; accept `"threes"` for either).
- [ ] 10.5 Frontend: render the pending seat explicitly, drive input from `candidates`, and key the edge legend/inspector on `Swipe`.
- [ ] 10.6 Tests: bridge contract for valid/invalid swipes and spawns, pending-state rendering, and a Threes game created through the bridge.

## 11. Port the consumers

- [ ] 11.1 Port `crates/tui`'s game loop from the fused `Engine::make_move` to the mode-facing `swipe`/`place`/`candidates` API.
- [ ] 11.2 Update `crates/merge-cli` to carry mode, agents, obligations, deck, and policy through merge/rebuild.
- [ ] 11.3 Verify no per-game state is dropped from merged exports.

## 12. Verification

- [ ] 12.1 `cargo test --workspace` passes.
- [ ] 12.2 `pnpm test` passes for the frontend tests touched by the bridge change.
- [ ] 12.3 Export → import → continue produces the same next state for a 2048 game, a Threes game, a Race, and a Crossfire.
- [ ] 12.4 `openspec validate "trait-based-game-modes" --no-interactive --strict` passes.
