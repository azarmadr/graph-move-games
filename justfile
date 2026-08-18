# Command runner for the game-2048 artifact.
# Replaces `pnpm --filter @workspace/game-2048 run <script>` with `just <cmd>`.

port := "26141"
base_path := "/"
export BASE_PATH := base_path
export PORT := port

# List available commands
default:
    @just --list

# Install the Rust 1.88.0 toolchain with the wasm32 target (one-time setup)
toolchain:
    pnpm --filter @workspace/game-2048 run rustup-init

# Install workspace dependencies
install:
    pnpm install

# Build the wasm engine into public/wasm-pkg/
build-wasm:
    pnpm --filter @workspace/game-2048 run build-wasm

# Run the wasm engine's Rust unit tests
test:
    cargo test --manifest-path artifacts/game-2048/wasm-game/Cargo.toml

# Run the Vite dev server (builds wasm first; PORT/BASE_PATH defaults match .replit)
dev:
    pnpm --filter @workspace/game-2048 run dev

# Typecheck the game-2048 app only
typecheck:
    pnpm --filter @workspace/game-2048 run typecheck

# Typecheck the full workspace (libs, scripts, artifacts)
check:
    pnpm run typecheck

# Production build: wasm engine, typecheck, then vite build
build: build-wasm typecheck
    PORT={{port}} pnpm --filter @workspace/game-2048 run build

# Preview the production build
serve:
    PORT={{port}} pnpm --filter @workspace/game-2048 run serve

# Remove build artifacts
clean:
    rm -rf artifacts/game-2048/dist artifacts/game-2048/public/wasm-pkg

tokei:
  tokei | tee .tokei.txt
  jj squash .tokei.txt -t l/ai
  jj op show -p
