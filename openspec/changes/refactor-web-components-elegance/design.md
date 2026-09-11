## Architecture Overview

Refactor 5 web components from ad-hoc innerHTML patterns to disciplined Shadow DOM + CSSStyleSheet architecture. Each component becomes self-contained with encapsulated styles, proper types, and zero duplicated rendering logic.

```
┌─────────────────────────────────────────────────────────────┐
│                    REFACTORED ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  src/utils/canvasBoard.ts          (NEW - shared)    │   │
│  │  ─────────────────────────────────────────────────── │   │
│  │  drawBoard(ctx, board, opts)       ← canonical impl │   │
│  │  drawSelectionHighlight(ctx, ...)  ← canonical impl │   │
│  │  buildGrid(board)                  ← re-export       │   │
│  └──────────────────────────────────────────────────────┘   │
│           ▲                   ▲                ▲             │
│           │                   │                │             │
│  ┌────────┴──────┐  ┌────────┴──────┐  ┌─────┴──────────┐  │
│  │  GameBoard    │  │  GraphTab     │  │  canvasUtils   │  │
│  │  Shadow DOM   │  │  (uses shared)│  │  (removed)     │  │
│  │  CSSStyleSheet│  │               │  └────────────────┘  │
│  └───────────────┘  └───────────────┘                      │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │  GameApp      │  │  GraphControls│  │  ScoreDisplay  │  │
│  │  Shadow DOM   │  │  Shadow DOM   │  │  DELETED       │  │
│  │  decomposed   │  │  CSSStyleSheet│  └────────────────┘  │
│  └───────────────┘  └───────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Design Decisions

### 1. Shadow DOM for all components

Every component gets a shadow root. This gives us:
- Style encapsulation — no global CSS leaks
- DOM encapsulation — `querySelector` scoped to shadow
- Clean separation — each component owns its presentation

```typescript
// Pattern for every component
connectedCallback() {
  this.attachShadow({ mode: 'open' });
  this.render();
}

private render() {
  this.shadowRoot!.innerHTML = '';  // clear
  // ... build DOM
}
```

**Trade-off**: Light DOM is simpler but causes global style pollution. Shadow DOM is worth the minor complexity for encapsulation.

### 2. CSSStyleSheet per component

Instead of one 484-line `index.css`, each component defines its own stylesheet:

```typescript
const sheet = new CSSStyleSheet();
sheet.replaceSync(`/* css */ .board { ... }`);

connectedCallback() {
  this.attachShadow({ mode: 'open' });
  this.shadowRoot.adoptedStyleSheets = [sheet];
}
```

The global `index.css` is reduced to:
- CSS reset (`*`, `body`)
- Layout primitives (`.app-nav`, `.graph-container`)
- Shared theme variables (`:root` custom properties)

### 3. Unified board rendering — single source of truth

Three implementations of "draw a 2048 grid on canvas" collapse into one:

```
BEFORE:                              AFTER:
┌──────────────┐                    ┌──────────────────────────┐
│ GameBoard    │ drawBoard()        │ src/utils/canvasBoard.ts │
│ GraphTab     │ drawThumbnail()    │ ──────────────────────── │
│ canvasUtils  │ drawGrid()         │ drawBoard(ctx, board,    │
│              │                    │   { x, y, cellSize, gap, │
│ 3 copies     │                    │   fontSize, radius })    │
└──────────────┘                    └──────────────────────────┘
```

The utility accepts options for different contexts (full-size board vs. thumbnail vs. zoom-transition). `GameBoard` and `GraphTab` import from this single module.

### 4. Selection highlight extracted

The 5-line highlight block (`isSelected ? "#4cc9f0" : isCurrent ? "#f72585" : ...`) appears 4 times. One function:

```typescript
function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  state: { selected: boolean; current: boolean; source: boolean }
): void
```

### 5. Persistent tabs — stop destroying and recreating on every switch

Currently `GameApp.render()` uses `this.innerHTML = ...` which destroys the entire DOM including `<graph-tab>`. Switching play→graph→play→graph recomputes dagre layout, reinitializes force-graph, and rebuilds the thumbnail cache every time — all wasteful if no moves were made.

**Fix**: Always render both tabs in the DOM, toggle visibility via CSS:

```typescript
// GameApp.render() — always present, one visible
<div class="tab-content ${tab === 'play' ? 'active' : ''}">
  <game-board></game-board>
</div>
<div class="tab-content ${tab === 'graph' ? 'active' : ''}">
  <graph-tab></graph-tab>
</div>
```

```css
.tab-content { display: none; }
.tab-content.active { display: block; }
```

**GraphTab smarter re-init**: The `graphData` setter should check whether data actually changed before recomputing layout. Use a reference check or content hash:

```typescript
set graphData(value: GraphData | null) {
  if (value === this._graphData) return; // same reference, skip
  // ... existing logic
}
```

This means:
- First visit to graph tab: full pipeline runs (layout → force-graph → thumbnails)
- Switch away and back without moves: **zero work** — tab stays alive, just hidden
- Make moves and switch back: `graphData` reference changes, pipeline reruns (correct)

### 6. GameApp decomposition

The 398-line orchestrator splits into focused modules:

```
src/
├── components/
│   ├── GameApp.ts          # Shell: lifecycle, render, child linking
│   └── GameApp/
│       ├── gameState.ts    # State management, autosave, restore
│       ├── keyboard.ts     # Keyboard handler (arrow map, WASD)
│       └── importExport.ts # Download/upload JSON logic
```

Each sub-module exports pure functions or small classes. `GameApp.ts` composes them.

### 7. Dead code removal

| What | Why |
|------|-----|
| `ScoreDisplay.ts` | Registered but never placed in any template. Remove file + registration. |
| `dagLayout.worker.ts` | Worker exists but layout runs on main thread via rAF. Remove file. |
| `console.trace()` calls | Production noise. Remove all 5 calls in `GameApp.ts`. |
| `"game-2048-persisted-v1"` duplication | Use `GameAppElement.STORAGE_KEY` constant everywhere. |

### 8. GraphTab type safety

Replace `any` with proper interfaces for force-graph nodes/links:

```typescript
interface ForceGraphNode {
  id: string;
  boardId: string;
  board: Board;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
}

interface ForceGraphLink {
  id: string;
  edgeId: string;
  edge: Edge;
  source: string;
  target: string;
}
```

## CSS Architecture

### Global styles (index.css reduced to ~80 lines)

```css
:root {
  --color-board-bg: #bbada0;
  --color-text-primary: #776e65;
  --color-text-secondary: #9b8f82;
  --color-accent-cyan: #4cc9f0;
  --color-accent-pink: #f72585;
  --color-bg: #faf8ef;
  --color-surface: #f9f6f2;
  --color-surface-dark: rgba(42, 42, 69, 0.92);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--color-bg); font-family: "Clear Sans", ... }
```

### Component styles (per-component CSSStyleSheet)

Each component's CSS uses `@scope` for natural namespacing:

```css
@scope (.board) {
  .header { display: flex; justify-content: space-between; }
  .score { background: var(--color-board-bg); ... }
  .canvas { border-radius: 8px; touch-action: none; }
}
```

## File Changes Summary

| Action | File | Lines (approx) |
|--------|------|-----------------|
| Create | `src/utils/canvasBoard.ts` | ~80 |
| Create | `src/components/GameApp/gameState.ts` | ~60 |
| Create | `src/components/GameApp/keyboard.ts` | ~30 |
| Create | `src/components/GameApp/importExport.ts` | ~50 |
| Modify | `src/components/GameApp.ts` | 398 → ~150 |
| Modify | `src/components/GameBoard.ts` | 247 → ~120 |
| Modify | `src/components/GraphTab.ts` | 801 → ~650 |
| Modify | `src/components/GraphControls.ts` | 165 → ~140 |
| Modify | `src/index.css` | 484 → ~80 |
| Modify | `src/main.ts` | 35 → ~30 |
| Delete | `src/components/ScoreDisplay.ts` | -54 |
| Delete | `src/utils/canvasUtils.ts` | -56 |
| Delete | `src/utils/dagLayout.worker.ts` | -11 |
| Modify | Tests | Update imports |
