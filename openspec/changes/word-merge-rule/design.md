## Context

See `proposal.md` — Why. This design assumes `trait-based-game-modes` has landed: a shared `Grid<T>`, a `MergeRule<T>` value on `Board`, `BoardGame::valid_swipes`, and `BoardId = hash(rule, content)`.

Two constraints from that change shape everything here:

- `Board` is concrete (`Grid<u32>` + `Rule`), not generic, because the graph stores boards by value and must hash, compare, and serialize them.
- `MergeRule<T>` is currently `Copy + Eq + Serialize`. A vocabulary is none of those.

The word rule is therefore the first rule whose behaviour depends on a resource outside the board, and the design has to say where that resource lives.

## Goals / Non-Goals

**Goals:**

- Word tiles as stable identifiers, with letters as one-letter words.
- A per-match vocabulary that is content-addressed and deterministically ordered.
- Concatenation in reading order, independent of swipe direction.
- O(total characters) merge-table construction, not O(N²).
- Swipe availability derived from the rule, not from tile equality.
- Vocabulary round-trips through export/import.

**Non-Goals:**

- No new game mode, seating, or turn structure. This change supplies a rule and a resource; `trait-based-game-modes` supplies the modes.
- No dictionary editor, network lookup, spell-checker, or language model.
- No scoring design. `score_delta` remains the rule's business; a mode may pick letter values, word length, or a rarity table.
- No vocabulary sharing across matches in this change. Two matches may use equal word lists, but each owns its instance; sharing by `VocabId` is a later optimisation.
- No migration of existing numeric saves beyond keeping them loadable.

## Decisions

### D1 — Tiles stay `u32`; the rule interprets them as word ids

`Grid<T>` requires `T: Copy + Eq`, and `Board` is concrete. Storing `String` in a cell would break both, and making `Board` generic would undo the DAG's concrete-value design.

Keep `Grid<u32>` and define that under `Rule::Words` the `u32` is a `WordId` index into the match vocabulary. The rule is the only code that may interpret it.

Alternatives considered:
- `Grid<String>` — rejected: not `Copy`, allocates per cell, hashes poorly.
- `enum Tile { Number(u32), Word(WordId) }` — rejected: changes every numeric rule and the graph payload for a benefit the rule boundary already provides.
- Generic `Board<T>` — rejected for the reason `trait-based-game-modes` gives: the graph needs one concrete serializable board type.

### D2 — Vocabulary identity is content-addressed and word ids are assigned by sorted order

```rust
pub struct VocabId(u64);   // Fnv1a over the canonical sorted word list
pub struct WordId(u32);    // index into that sorted list
```

The canonical form is the word list sorted lexicographically, then deduplicated. Assigning ids from that order makes the mapping independent of load order, so the same word list always produces the same `BoardId`s.

Alternative considered: hash each word's text into a 32-bit id. Rejected for this change because 32-bit collisions would need a collision check and a fallback; sorted indices are exact and cheap for a per-match list. Hashing becomes attractive only if vocabularies must be shared across matches.

### D3 — The rule owns an `Arc<Vocabulary>`; identity compares ids, not contents

```rust
pub struct Vocabulary {
    id: VocabId,
    words: Vec<String>,                          // WordId -> text
    merges: HashMap<(WordId, WordId), WordId>,   // (left, right) -> joined
}

pub enum Rule {
    EqualTiles,
    Threes,
    Words(Arc<Vocabulary>),
}
```

`merge` is a table lookup. `PartialEq` and `Hash` compare the variant and `VocabId`; `Serialize` writes the id. `Board` clone becomes an `Arc` clone.

This keeps `BoardGame::apply(&self, action)` unchanged. The alternative — `Rule::Words(VocabId)` plus a registry threaded through every `apply` — keeps `Rule` `Copy` but changes the board trait and every call site. The alternative where the rule stores the id and a global registry resolves it was rejected because hidden global state makes replay and import depend on ambient configuration.

Consequence: `MergeRule` loses its `Copy` bound and gains `Clone`. `Board` stays `Eq + Serialize` through manual impls on `Rule`.

### D4 — Merge operands are in reading order, not slide order

`Grid::slide` must call `merge(left, right)` where left is the smaller column (or row) index. Direction decides where the result lands and which pair is considered first; it never swaps operands.

Without this, swiping right on `[AN][T]` would ask `merge(T, AN)` and produce `TAN`. With equal tiles the distinction was invisible, which is why the existing code never had to state it.

`valid_swipes` must use the same convention: when scanning Right/Down in reverse, the pair is `(current, previous)` in reading order.

### D5 — Build a sparse merge table by splitting words

For every word in the vocabulary, split it at every boundary and keep the split when both halves are words:

```
"ANT" -> ("A","NT") no, ("AN","T") yes -> ANT
```

That is O(total characters) and yields exactly the ordered pairs that can merge. A full N×N table is rejected (wasteful for a global list); a runtime trie is rejected (more code, no benefit over a hash map for a per-match list).

The table is built once when the vocabulary is created or imported. Adding a word costs O(length) new entries.

### D6 — Swipe availability is rule-driven

`BoardGame::valid_swipes` must ask `rule.merge(previous, current)` rather than `previous == current`. The equality scan is correct only for `EqualTiles`; under a word rule, `A` next to `A` does not merge unless `AA` is a word, and `AN` next to `T` does merge even though the tiles differ.

This is the concrete reason `trait-based-game-modes` moves `valid_moves` behind the board trait. The word rule is the first rule that proves the move was necessary.

### D7 — Vocabulary growth is record-only in this change

Formed words are recorded in the vocabulary for scoring, discovery, and export, but **validity comes from the seed vocabulary**. Growth does not unlock a merge that was not already valid.

This keeps `apply` context-free, `BoardId` a pure function of (rule, content), and replay a pure function of the action history.

Alternative considered: growing validity, where forming `ANT` makes a later `ANTE` merge legal. That turns the vocabulary into match state: `apply` needs the current vocabulary as context, `BoardId` needs a growth version, and every mode threads the vocabulary through. It is a coherent game, but it is a larger change and is deferred. If it is chosen later, it should be its own change.

### D8 — Export stores vocabularies once, keyed by identity; import is two-phase

`GraphStore` gains `vocabularies: HashMap<VocabId, Vocabulary>`. `Rule::Words` serializes as its `VocabId`. Import deserializes the vocabulary table first, then resolves `Rule::Words(id)` into `Arc<Vocabulary>`, then replaces the engine state.

A missing vocabulary aborts the import; resolving word ids against a different vocabulary would silently rewrite history.

Alternative considered: serializing the full vocabulary inside every board. Rejected: duplicates it per node and makes exports grow with the graph.

### D9 — Any two words may merge, not only word + letter

The split table naturally accepts `AN + TE -> ANTE` when `TE` is a word. Restricting operands to word + single letter would be an extra rule with no architectural benefit; a mode that wants shorter chains can restrict which words spawn.

## Risks / Trade-offs

- **Vocabulary size grows the reachable state space** → keep the per-match list curated; the merge table is sparse, so lookup cost does not grow with N².
- **`Rule` is no longer `Copy`** → `Clone` is an `Arc` bump; `Board` clone stays cheap. Every `Rule` value must be cloned, not copied.
- **Word ids depend on canonical ordering** → sort and deduplicate at load; never assign ids from insertion order.
- **Two in-flight changes both modify `graph-model`** → land `trait-based-game-modes` first; this delta assumes its rule-in-hash requirement.
- **Record-only growth may surprise players** who expect a newly formed word to unlock a longer one → make the model visible in the UI or revisit D7 as a separate change.
- **Scoring is unspecified** → leave it to the mode/rule; do not bake a scoring scheme into the vocabulary.
- **Deserialization needs the vocabulary before boards** → enforce two-phase load; a single-pass serde derive cannot resolve `Arc<Vocabulary>`.

## Migration Plan

1. Land `trait-based-game-modes` first; this change assumes its `Grid`, `MergeRule`, `BoardGame`, and rule-aware `BoardId`.
2. Add `Vocabulary`, `VocabId`, `WordId`, and `Rule::Words` alongside the existing rules; numeric rules keep their current behaviour.
3. Change `MergeRule`'s bound from `Copy` to `Clone` and update `Rule`'s manual `Eq`/`Hash`/`Serialize`.
4. Make `Grid::slide` pass operands in reading order; numeric rules are unaffected because their merge is commutative.
5. Route `valid_swipes` through the rule.
6. Add the vocabulary table to export/import and bump the export version. Old exports without a vocabulary still load because they contain no word rule.
7. Rollback: word matches are additive; removing `Rule::Words` leaves numeric matches and their graphs untouched.

## Open Questions

- Where the seed vocabulary comes from (built-in list, file, or player-authored) is a configuration decision and does not change the board contract.
- Whether a mode should cap operand length (for example, only letters extend words) is a mode rule, not a merge-rule rule.
- Scoring for words (letter values, word length, or rarity) is deliberately left to the mode and can be decided during implementation.
