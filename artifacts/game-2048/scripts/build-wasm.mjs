import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const wasmDir = path.resolve(packageDir, "../public/wasm-pkg");
const wasmEntry = path.join(wasmDir, "game_2048_wasm.js");

function run(command, args) {
  return spawnSync(command, args, {
    cwd: path.resolve(packageDir, ".."),
    stdio: "inherit",
    env: process.env,
  });
}

const rustupBuild = run("rustup", [
  "run",
  "1.88.0",
  "wasm-pack",
  "build",
  "wasm-game",
  "--target",
  "web",
  "--out-dir",
  "../public/wasm-pkg",
]);

if (rustupBuild.status === 0) process.exit(0);

if (existsSync(wasmEntry)) {
  console.warn(
    "\nWASM rebuild unavailable; using the existing generated bundle so the web preview can start.\n",
  );
  process.exit(0);
}

console.error(
  "\nWASM build failed and no generated bundle is available. Install Rust 1.88 with the wasm32 target, then restart the workflow.\n",
);
process.exit(rustupBuild.status ?? 1);