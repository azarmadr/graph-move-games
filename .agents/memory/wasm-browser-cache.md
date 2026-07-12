---
name: Stale WASM output directory and browser cache
description: After structural changes to the WASM JSON contract, verify the real output directory and restart the workflow
---

After changing the Rust/WASM data model (new structs, renamed fields, etc.), the frontend can still appear to receive the old JSON if the generated `public/wasm-pkg/` files are stale or written to the wrong directory.

**Why:** `wasm-pack build wasm-game --out-dir public/wasm-pkg` resolves the output path relative to the crate directory (`wasm-game/`), not the invoking directory. Without the `../`, the output lands in `wasm-game/public/wasm-pkg/` while Vite serves from `artifacts/game-2048/public/wasm-pkg/`. The browser then loads the old files with no build-time error.

**How to apply:**
1. Keep `build-wasm` as `wasm-pack build wasm-game --target web --out-dir ../public/wasm-pkg` in `package.json`.
2. After model changes, verify with `grep -o '2048-wasm v[^"]*' public/wasm-pkg/game_2048_wasm.js` or by inspecting the served JSON in the browser console.
3. If the wrong files are present, delete `wasm-game/public/` and `public/wasm-pkg/`, rebuild, and restart the workflow so Vite serves the new files.
