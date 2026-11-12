## 1. Vocabulary

- [ ] 1.1 Add `WordId`, `VocabId`, and `Vocabulary`: load a word list, sort and deduplicate it into canonical order, assign `WordId`s by position, and compute `VocabId` from the canonical list. Test that loading the same words in a different order produces identical ids and identity.
- [ ] 1.2 Build the sparse merge table by splitting every word at every boundary and keeping splits whose halves are both words. Test `A + N -> AN`, `AN + T -> ANT`, `ANT + E -> ANTE`, a missing concatenation, and `A + A` with and without `AA`.
- [ ] 1.3 Record words formed by merges in the vocabulary without changing validity (design D7). Test that replaying the same action history reconstructs the same word set and ids.

## 2. Rule integration

- [ ] 2.1 Add `Rule::Words(Arc<Vocabulary>)`. Change `MergeRule`'s bound from `Copy` to `Clone`, and implement `Eq`, `Hash`, and `Serialize` for `Rule` so a word rule compares and hashes by `VocabId`, not by vocabulary contents.
- [ ] 2.2 Make `Grid::slide` pass operands in reading order: `merge(left, right)` by column/row index, independent of swipe direction. Test that swiping right on `[AN][T]` produces `ANT`, not `TAN`, and that numeric rules are unchanged.
- [ ] 2.3 Make `BoardGame::valid_swipes` ask the rule whether a pair merges instead of comparing tiles for equality. Test a board with `AN` and `T` and no equal neighbours, and a board with `A` and `A` when `AA` is absent.

## 3. Identity and graph

- [ ] 3.1 Include the rule identity, and therefore `VocabId`, in `BoardId`. Test that identical tile ids under different vocabularies produce different ids, and that identical content under the same vocabulary produces the same id.
- [ ] 3.2 Add `vocabularies: HashMap<VocabId, Vocabulary>` to the graph store, keyed by identity so equal word lists are stored once.

## 4. Persistence

- [ ] 4.1 Export each vocabulary once, keyed by `VocabId`, and serialize `Rule::Words` as its id. Bump the export version; verify old numeric exports still load.
- [ ] 4.2 Implement two-phase import: restore vocabularies first, then resolve `Rule::Words(id)` into `Arc<Vocabulary>`, then replace the engine state. Test that a missing vocabulary aborts the import and leaves the previous state usable.
- [ ] 4.3 Extend the WASM creation config to accept a per-match word list and pass it through; return a clear error when a word rule is created without one.

## 5. Regression and verification

- [ ] 5.1 Run the numeric-rule suites (`EqualTiles`, `Threes`) unchanged and confirm the `Copy`-to-`Clone` bound and the reading-order slide did not alter their behaviour.
- [ ] 5.2 Add a property test for word boards: reported swipes are exactly the directions that change the board, no duplicates, and `valid_swipes().is_empty()` matches termination.
- [ ] 5.3 Construct a word board through each entry point (`tui`, `merge-cli`, WASM) and confirm it resolves words, merges, and exports/imports without a numeric rule.
