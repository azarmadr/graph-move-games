/**
 * Thin wrapper around `vite-plugin-terminal`.
 *
 * Dev / preview: re-exports the real `virtual:terminal` module provided by
 * the Vite plugin so that logs appear in the in-browser terminal overlay.
 *
 * Tests / SSR: vitest aliases this file to `src/__mocks__/virtual-terminal.ts`
 * which provides a silent no-op.
 */
// @ts-expect-error — provided by vite-plugin-terminal at dev/build time
export { terminal } from "virtual:terminal";
