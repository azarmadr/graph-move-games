---
name: Rustup toolchain reset after Nix module change
description: Changing .replit modules can clear the installed Rust toolchain; reinstall before building WASM
---

When the `.replit` modules change (e.g., switching from `nodejs-20` to `nodejs-24`), the Nix environment may be refreshed, which can remove the previously installed `rustup` toolchain. Running `pnpm run build-wasm` then fails with `toolchain '1.88.0-x86_64-unknown-linux-gnu' is not installed`.

**Why:** Replit's Nix environment is tied to the configured modules. A module change can rebuild the environment from scratch, leaving only the rustup binary itself without any installed toolchains or targets.

**How to apply:** After any `.replit` module change that affects the runtime, run `rustup toolchain install 1.88.0 --target wasm32-unknown-unknown` before `pnpm run build-wasm`. If the build script fails with a missing toolchain error, reinstall rather than assuming the toolchain is still present.
