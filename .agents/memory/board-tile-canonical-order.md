---
name: Board tile canonical order
description: Board equality and node IDs depend on tile order; tiles must be stored canonically.
---

`Board` stores live tiles in a `Vec<Cell>` and derives `PartialEq`. Its `hash_content` is used to derive node IDs. If two semantically identical boards store tiles in different orders, they compare unequal and produce different node IDs, which breaks graph deduplication and game-over detection.

**Rule:** All `Board` instances must keep their `tiles` vector in a canonical order (row-major, sorted by `(row, col)`).

**Why:** `resolve_move` builds new tiles row-by-row for horizontal moves and column-by-column for vertical moves. Without canonical ordering, a full board with no possible merges compares unequal across directions and appears to have valid moves, so the game never terminates.

**How to apply:** Use `Board::with_tiles` (which sorts tiles) or `Board::set` (which sorts) instead of direct `Board { dim, tiles }` construction with an unsorted vector. If a helper builds a tile list manually, pass it through `with_tiles` to canonicalize before hashing or comparing.
