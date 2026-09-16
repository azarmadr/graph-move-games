/**
 * Pluggable logging adapter.
 *
 * Dev: re-exports `vite-plugin-terminal` which sends logs to the Node
 * terminal. Run the dev server with output teed to a file:
 *
 *   pnpm dev 2>&1 | tee .data/dev.log
 *
 * Tests: vitest aliases this file to __mocks__/virtual-terminal.ts (no-op).
 */
// @ts-expect-error — provided by vite-plugin-terminal at dev/build time
export { terminal } from "virtual:terminal";
