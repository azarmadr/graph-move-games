---
name: Frontend graph persistence
description: How to persist the 2048 DAG graph across page reloads using localStorage
---

To keep the full DAG graph after a browser reload, persist the engine's `export_graph()` output together with the active `game_id`, and restore it on app mount via `import_graph()` followed by `get_state(active_game_id)`.

**Why:** `GameState` only contains the focused view for one active game, not the full graph. `ExportData` is the canonical snapshot that includes all nodes, edges, and game instances. Saving the active `game_id` separately lets the frontend restore the exact same focused game instead of guessing which imported game to display.

**How to apply:**
1. On every state change, call `export_graph()`, serialize the result plus `active_game_id`, and store it in `localStorage`.
2. On mount, load WASM first, then try to read the saved snapshot. If present, call `import_graph(snapshot)` and then `get_state(saved_active_game_id)` to rebuild the focused `GameState`.
3. If reading or importing fails, fall back to `create_game_with_config()` and start fresh.
4. Starting a new game or importing from clipboard naturally overwrites the saved snapshot via the same state-change save effect.
