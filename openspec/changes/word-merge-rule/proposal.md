## Why

The trait-based game modes change makes the merge rule a pluggable value over numeric tiles (`Rule::EqualTiles`, `Rule::Threes`). A word-building variant needs tiles to be **words**, with merges validated by a **per-match vocabulary** that can grow as words are formed. That is a different kind of rule: it depends on external data and on match state, not on a fixed arithmetic identity. Capturing it now records what the board trait must support before the `MergeRule` interface is frozen.

This change is planned against `trait-based-game-modes`; it assumes that change's `Grid`, `MergeRule`, `BoardGame`, and `BoardId = hash(rule, content)` land first.

## What Changes

- Tiles become word identifiers, not strings: `WordId(u32)`, with letters as one-letter words. `Grid<T>` keeps its `T: Copy` bound.
- A merge is **reading-order concatenation**: `merge(left, right) = vocabulary.lookup(left.text ++ right.text)`. `A + N -> AN`, `AN + T -> ANT`, `ANT + E -> ANTE`. Direction decides placement and merge order, never operand order.
- Each match owns a **vocabulary**: a content-addressed, deterministically ordered word list (`VocabId`), so the same list always produces the same tile ids and the same `BoardId`s.
- The merge table is sparse and built by splitting every known word at every boundary, not an N×N table: `O(total characters)`.
- `valid_swipes` must ask the rule whether a pair merges; the equality scan used for 2048/Threes is wrong for words.
- `BoardId` includes the vocabulary identity (and its version if vocabulary growth gates future merges).
- Export/import carries the vocabulary, so a restored match can resolve its word ids.
- **Open, not decided here:** whether vocabulary growth only records discovered words or actually unlocks later merges; whether operands are any two words or word + single letter only; how the seed vocabulary is produced and whether players build it.

## Capabilities

### New Capabilities

- `word-tiles`: word identifiers, deterministic ordering, letters as tiles, the per-match vocabulary and its lifecycle.
- `word-merge`: the concatenation relation, the sparse merge table, reading-order operands, and rule-driven swipe availability.

### Modified Capabilities

- `graph-model`: `BoardId` must include the vocabulary identity, not only tile values.
- `instance-management`: export/import must carry the per-match vocabulary and reject or repair a graph whose vocabulary is missing.
- `wasm-bridge`: `create_game_with_config` must accept a per-match vocabulary (or a reference to one); `export_graph` and `import_graph` must carry and restore it.

## Impact

- `crates/core`: `Board` tile type, `MergeRule` bounds and identity, `Grid` slide operand order, `valid_swipes`, `BoardId`, graph store, export/import.
- `crates/wasm` and the frontend: creation config gains a vocabulary; export payload gains a vocabulary table.
- `crates/tui` and `crates/merge-cli`: any construction of a `Board` must supply a rule, and a word rule must supply a vocabulary.
- Depends on `trait-based-game-modes`; this change should not be applied before it.
- No dependency changes expected: the vocabulary is data, not a new crate.
