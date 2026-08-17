## 1. Project Structure & Setup (Phase 1)

- [x] 1.1 Verify pnpm workspace configuration and package.json scripts
- [x] 1.2 Confirm Rust toolchain: rustup toolchain install 1.88.0 --target wasm32-unknown-unknown
- [x] 1.3 Verify wasm-pack version and build pipeline (wasm-pack build)
- [x] 1.4 Set up environment variables: PORT and BASE_PATH for Vite dev server

## 2. Data Model & Engine (Phase 2)

- [x] 2.1 Implement Board struct with content-addressed BoardId (FNV-1a hashing)
- [x] 2.2 Implement Edge struct with EdgeKind (Move/Direction or Spawn/cells)
- [x] 2.3 Implement GraphStore using petgraph DiGraph with content-addressed deduplication
- [x] 2.4 Implement Fnv1a hash utility with write_u8, write_u32, write_u64, finish
- [x] 2.5 Implement GameInstance, GameState, GameConfig, SpawnConfig types with serde

## 3. Move Logic (Phase 3)

- [x] 3.1 Implement resolve_move in Rust: slide + merge 2048 rules per direction
- [x] 3.2 Implement valid_moves check: detect any direction that changes the board
- [x] 3.3 Implement has_any_valid_move_helper: termination detection
- [x] 3.4 Test merge rules: no double-merge, correct score accumulation
- [x] 3.5 Test invalid moves: no board change, no edge/node creation

## 4. Spawning (Phase 4)

- [x] 4.1 Implement sample_spawn: select random empty position uniformly
- [x] 4.2 Implement weighted_tile: select tile value (2 or 4) based on configured probabilities
- [x] 4.3 Test spawn position randomization across multiple outcomes
- [x] 4.4 Test weighted tile selection (2 with 9:1 ratio against 4)
- [x] 4.5 Test spawn when board is full: return empty Vec

## 5. WASM Bridge (Phase 7)

- [x] 5.1 Implement loadWasm: import wasm-pkg, call .default(), cache module
- [x] 5.2 Implement createGameWithConfig: serialize config, call Rust, parse GameState
- [x] 5.3 Implement makeMove: parse game_id u64, parse direction, call Rust, parse GameState
- [x] 5.4 Implement getState: parse game_id u64, call Rust, parse GameState
- [x] 5.5 Implement getGraph: call Rust, parse GraphData (nodes + edges)
- [x] 5.6 Implement exportGraph: serialize Engine struct, return JSON string
- [x] 5.7 Implement importGraph: deserialize Engine JSON, replace state, rebuild indexes

## 6. Board Rendering (Phase 8)

- [x] 6.1 Implement drawBoard: canvas rendering with sparse tile layout
- [x] 6.2 Implement TILE_COLORS mapping: background/foreground per tile value
- [x] 6.3 Implement dynamic font sizing: 28px (0-7), 24px (128-512), 20px (1024+)
- [x] 6.4 Implement rounded rectangle drawing with 8px board border, 4px tile border
- [x] 6.5 Implement score display in UI
- [x] 6.6 Implement keyboard event handlers (Arrow keys, WASD)
- [x] 6.7 Implement touch event handlers (touchstart, touchmove, touchend with 24px threshold)
- [x] 6.8 Implement board size selector (3×3, 4×4, 5×5 buttons)

## 7. Graph Rendering - dagre Layout (Phase 9)

- [x] 7.1 Implement makeDagLayout: configure dagre with rankdir "TB", nodesep 48, ranksep 92
- [x] 7.2 Set node dimensions: NODE_SIZE = 104px for all boards
- [x] 7.3 Set edge color-coding: cyan (#4cc9f0) for Move, pink (#f72585) for Spawn
- [x] 7.4 Implement edge arrow markers: graph-arrow-move (cyan) and graph-arrow-spawn (pink)
- [x] 7.5 Implement boardThumbnail: render 44×44 mini board with TILE_COLORS
- [x] 7.6 Implement node positioning: map dagre layout positions to CSS left/top styles
- [x] 7.7 Implement SVG edge paths with stroke color and arrow markers

## 8. Graph Interactivity (Phase 11)

- [x] 8.1 Implement hover cards: show board summary on mouseenter, remove on mouseleave
- [x] 8.2 Implement node selection: click/focus board to select, display in inspector aside
- [x] 8.3 Implement edge selection: click edge to select, display edge label in inspector
- [x] 8.4 Implement focus/blur event handling on graph board cards
- [x] 8.5 Implement keyboard navigation for graph tab (arrow keys, Enter/Space to select)

## 9. Instance Management (Phase 6)

- [x] 9.1 Implement createGameWithConfig: generate GameId, create initial board, store game
- [x] 9.2 Implement game state persistence: localStorage autosave via exportGraph + importGraph
- [x] 9.3 Implement game state restore from localStorage on connectedCallback
- [x] 9.4 Implement termination detection: check valid moves, disable UI when terminated
- [x] 9.5 Implement score tracking across moves
- [x] 9.6 Implement board size switching (3×3/4×4/5×5 starts new game)

## 10. Performance & Optimization (Phase 12)

- [ ] 10.1 Profile graph redraw FPS with increasing node/edge counts
- [ ] 10.2 Implement selective redraw: only update changed portions of the graph
- [ ] 10.3 Optimize DAG queries: reduce node/edge traversal for large graphs
- [ ] 10.4 Test bundle size: WASM .wasm file < 500KB target

## 11. Polish & Mobile (Phase 13)

- [x] 11.1 Implement responsive design: grid layout switches from 2-col to 1-col under 760px
- [x] 11.2 Hide arrow buttons on narrow screens (< 480px) via CSS media query
- [x] 11.3 Verify touch-action: manipulation on body to prevent scrolling
- [ ] 11.4 Test accessibility: color contrast, focus outlines, aria labels on interactive elements
- [ ] 11.5 Final integration: ensure all phases work together without regressions