## Task 1: Extract unified board rendering into `src/utils/canvasBoard.ts`

- [x] Create `src/utils/canvasBoard.ts` with `drawBoard`, `drawBoardBackground`, `drawSelectionHighlight`
- [x] Update `GameBoard.ts` to import from `canvasBoard.ts`, remove local `drawBoard()`
- [x] Update `GraphTab.ts` `ThumbnailCache.render()` and selection highlights to use shared utilities
- [x] Remove `src/utils/canvasUtils.ts` (dead code)

---

## Task 2: Add Shadow DOM + CSSStyleSheet to `GraphControls`

- [x] `attachShadow({ mode: 'open' })` in `connectedCallback`
- [x] Create CSSStyleSheet with all `.graph-controls-*` rules (renamed to short classes)
- [x] Replace `this.innerHTML` with `this.shadowRoot.innerHTML`
- [x] Replace `this.querySelector` with `this.shadowRoot.querySelector`
- [x] Move styles from `index.css` into the component's stylesheet

---

## Task 3: Add Shadow DOM + CSSStyleSheet to `GameBoard`

- [x] Create CSSStyleSheet with board-related styles
- [x] Move inline styles from template literals into CSS classes
- [x] Replace `this.innerHTML` with `this.shadowRoot.innerHTML`
- [x] Update all `this.querySelector` to `this.shadowRoot.querySelector`

---

## Task 4: Add Shadow DOM + CSSStyleSheet to `GraphTab`

- [x] Create CSSStyleSheet with graph-related styles
- [x] Move styles from `index.css` into the component stylesheet
- [x] Replace `this.innerHTML` with `this.shadowRoot.innerHTML`
- [x] Update query selectors to use shadow root

---

## Task 5: Add Shadow DOM + CSSStyleSheet to `GameApp`

- [x] Create CSSStyleSheet with app-level layout styles
- [x] Move relevant styles from `index.css` into the component stylesheet
- [x] Replace `this.innerHTML` with `this.shadowRoot.innerHTML`
- [x] Update query selectors to use shadow root

---

## Task 6: Reduce `index.css` to global primitives only

- [x] Strip to CSS reset, `:root` custom properties, body styles only
- [x] Delete all component-specific rules moved in tasks 2-5

---

## Task 7: Decompose `GameApp.ts` into sub-modules

Deferred — GameApp is functional at ~480 lines. Decomposition can be done as a follow-up.

---

## Task 8: Remove dead code

- [x] Delete `src/components/ScoreDisplay.ts`
- [x] Remove `ScoreDisplayElement` import and registration from `main.ts`
- [x] Delete `src/utils/dagLayout.worker.ts`
- [x] Remove all `console.trace()` calls from `GameApp.ts`
- [x] Remove unused `dlog` and `terminal` imports from `GameApp.ts`
- [x] Use `GameAppElement.STORAGE_KEY` constant for download handler

---

## Task 9: Add type definitions for force-graph in `GraphTab.ts`

- [x] Create `src/utils/forceGraphTypes.ts` with `ForceGraphNode` and `ForceGraphLink`
- [x] Replace all `any` annotations for nodes/links with proper types
- [x] Type `_forceGraph` as `ReturnType<typeof ForceGraph> | null`

---

## Task 10: Final cleanup and verification

- [x] No broken imports (ScoreDisplay, canvasUtils, dagLayout.worker all removed)
- [x] No unused imports (dlog, terminal removed from GameApp)
- [ ] Tests need runtime verification (vitest hanging system-wide — pre-existing issue with `virtual:terminal`)

---

## Task 11: Persistent tabs — stop destroying/recreating on tab switch

- [x] Replace conditional template with always-present `.tab-content` divs
- [x] Add `.tab-content { display: none }` / `.tab-content.active { display: block }` CSS
- [x] Update `linkChildElements()` to always link both children
- [x] Add reference-check guard in `GraphTab.set graphData()` to skip recomputation
