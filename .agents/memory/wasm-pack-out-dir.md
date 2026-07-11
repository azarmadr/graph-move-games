---
name: wasm-pack out-dir resolution
description: wasm-pack build's --out-dir is relative to the crate path argument, not the invoking cwd
---

`wasm-pack build <crate-dir> --target web --out-dir <path>` resolves `<path>` relative to `<crate-dir>`, not the directory the command was run from.

**Why:** In this project the build script ran `wasm-pack build wasm-game --out-dir public/wasm-pkg` from `artifacts/game-2048/`, intending output at `artifacts/game-2048/public/wasm-pkg`. It actually wrote to `artifacts/game-2048/wasm-game/public/wasm-pkg`, one level too deep — silently breaking the frontend's `import("../public/wasm-pkg/...")` since that directory never existed at the expected location (build succeeded with no error, so it looked fine until runtime).

**How to apply:** When wiring a wasm-pack build script, use `--out-dir ../<path>` (one level up) if the crate is nested inside the frontend package one directory below where the consuming JS expects the output. Verify with `find . -iname wasm-pkg` after a build if a WASM import fails to resolve at runtime despite a "clean" build log.
