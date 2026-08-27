# Command runner for the 2048 game project.

port := "26141"
base_path := "/"
export BASE_PATH := base_path
export PORT := port

# List available commands
default:
    @just --list

# Install the Rust 1.88.0 toolchain with the wasm32 target (one-time setup)
toolchain:
    pnpm run rustup-init

# Install workspace dependencies
install:
    pnpm install

# Build the wasm engine into public/wasm-pkg/
build-wasm:
    pnpm run build-wasm

# Run the Rust unit tests
test:
    cargo test -p game-core

# Run the Vite dev server (builds wasm first; PORT/BASE_PATH defaults match .replit)
dev:
    pnpm run dev

# Typecheck the frontend
typecheck:
    pnpm run typecheck

# Typecheck the full workspace
check:
    pnpm run typecheck

# Production build: wasm engine, typecheck, then vite build
build: build-wasm typecheck
    PORT={{port}} pnpm run build

# Preview the production build
serve:
    PORT={{port}} pnpm run serve

# Remove build artifacts
clean:
    rm -rf dist public/wasm-pkg

tokei:
  tokei | tee .tokei.txt
  jj squash .tokei.txt -t l/ai
  jj op show -p
