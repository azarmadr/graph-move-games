## Why

The web components work but are written haphazardly — inline styles, duplicated rendering logic, innerHTML on every state change, no encapsulation. The result is fragile, hard to extend, and visually noisy code. This refactor brings architectural discipline so components are elegant, testable, and maintainable.

## What Changes

- **Shadow DOM adoption** — Each component encapsulates its DOM and styles. Global CSS pollution eliminated.
- **CSSStyleSheet API** — Styles defined as JS modules, not string templates or a single 484-line global stylesheet.
- **Modern DOM APIs** — Replace `innerHTML` assignments with `setHTMLUnsafe()` / `getHTML()` where template strings are needed; use `append()`, `prepend()`, `before()`, `after()` for element insertion.
- **Unified board rendering** — Extract the triplicated board-to-canvas logic (`GameBoard.drawBoard`, `GraphTab.drawThumbnail`, `canvasUtils.drawGrid`) into a single `drawBoard()` utility in `src/utils/canvasUtils.ts`.
- **Unified selection highlighting** — Extract duplicated selection highlight logic into `canvasUtils.ts`.
- **GameBoard inline styles → CSS classes** — Move ~100 lines of inline style attributes into proper CSS classes via Shadow DOM stylesheet.
- **Remove dead code** — Delete `ScoreDisplay` (registered but never rendered), `dagLayout.worker.ts` (unused), orphaned `console.trace()` calls, and hardcoded `"game-2048-persisted-v1"` string duplication in GameApp.
- **GraphTab type safety** — Replace `any` types with proper force-graph type interfaces.
- **GameApp decomposition** — Split the 398-line orchestrator into focused sub-modules (game state manager, keyboard handler, import/export manager).
- **Persistent tabs** — Keep `<game-board>` and `<graph-tab>` alive in the DOM across tab switches (toggle visibility instead of destroy/recreate). Prevents redundant layout computation and force-graph reinitialization when switching between play and graph tabs without making moves.

## Capabilities

### New Capabilities

None — this is a pure refactor with no behavioral changes.

### Modified Capabilities

None — existing specs describe component behavior which remains unchanged.

## Impact

- **Files modified**: All 5 components (`GameApp.ts`, `GameBoard.ts`, `GraphTab.ts`, `GraphControls.ts`, `ScoreDisplay.ts`), `index.css`, `main.ts`, `canvasUtils.ts`
- **Files deleted**: `ScoreDisplay.ts`, `dagLayout.worker.ts`
- **Files created**: Component-specific CSS modules (e.g., `GameBoard.css`, `GraphControls.css`), extracted sub-modules for GameApp decomposition, force-graph type definitions
- **Dependencies**: No new dependencies. `force-graph` types may need a local `.d.ts` if not already typed.
- **Risk**: Shadow DOM changes how external CSS applies to components — verify all existing styles still work. The refactor should be incremental (one component at a time) with tests passing after each step.
