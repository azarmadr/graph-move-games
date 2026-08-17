## Context

This design document describes the technical architecture of the 2048 + DAG Graph Visualizer application. The project consists of a Rust/WASM game engine and a TypeScript/React frontend. The engine maintains a canonical global DAG (Directed Acyclic Graph) of all board states, where each unique board is content-addressed via FNV-1a hashing. Moves and spawns create edges between board nodes. The frontend visualizes the graph alongside the playing board.

Key constraints and existing decisions:
- **JSON over WASM bridge**: All data serializes/deserializes via JSON using serde/serde_json/serde-wasm-bindgen. Both sides can debug by logging JSON; schema changes are explicit.
- **Content-addressed IDs**: BoardId and EdgeId are deterministic hashes (FNV-1a) of board/content, enabling global deduplication. Import/export consistency depends on stable hashing across Rust versions.
- **Sparse board representation**: Only non-empty cells are stored; dense grid is built on-demand for rendering. Empty cells don't affect state equality.
- **Canvas over DOM**: 100+ nodes/edges would choke DOM performance; canvas provides pixel-level control, deterministic rendering, and memory efficiency.
- **Single-player, no persistence**: Game state lost on page reload; localStorage autosave enables restore of exported graph + active game.

Architectural references: proposal.md for motivation/why, specs/**/*.md for behavior contracts.

## Goals / Non-Goals

**Goals:**
- Document the existing technical architecture for maintainability and onboarding
- Formalize the 13-phase roadmap with current status
- Specify the Rust/WASM engine interface (Engine struct, public API functions)
- Specify the TypeScript/React frontend components and their responsibilities
- Define the WASM boundary contract (JSON serialization formats)
- Document the DAG storage model (petgraph DiGraph, content-addressed IDs)
- Specify the graph rendering pipeline (dagre layout, Canvas SVG rendering)
- Capture input handling (keyboard, touch, button controls)
- Enable future phases (zoom/pan, filters, multiplayer) without breaking existing functionality

**Non-Goals (explicitly out of scope for this documentation change):**
- Multiplayer/networking code or server architecture
- Persistence layer beyond localStorage autosave
- Advanced graph features (zoom, pan, filtering by game ID)
- Node inspection tooltips or click-to-expand
- Performance optimization beyond existing dagre layout
- Accessibility improvements (beyond existing responsive design)
- DOM-based rendering or HTML graph visualization
- API server implementation or database integration
- Rust version upgrades or dependency migrations

## Decisions

### Why Canvas Over DOM
- Graph complexity: 100+ nodes/edges would choke DOM render performance
- Pixel-level control: Graph layout, mini boards, edge curves require absolute positioning
- Consistent rendering: Canvas is deterministic across browsers
- Memory efficiency: Single canvas vs. 100+ HTML elements

### Why Sparse Board Representation
- Graph efficiency: Only store non-empty cells; saves memory
- Deterministic hashing: Empty cells don't affect state equality (critical for content-addressed IDs)
- Rebuild on-demand: JS side can construct dense grid for rendering from sparse data

### Why JSON Over Alternative Bridge Formats
- Debugging: Both sides can log JSON; easy to inspect at boundary
- Versioning: Schema changes are explicit and traceable
- Type safety: TypeScript types on JS side, Rust types on WASM side; serde bridges them
- Future: API server can consume same JSON for persistence/multiplayer later

### Why FNV-1a Hashing for Content-Addressed IDs
- Stable output across Rust versions and platforms (important for import/export consistency)
- Deterministic: same board content always produces same BoardId
- Global deduplication: identical boards share the same node in the DAG

### Why dagre for Graph Layout
- Hierarchical (rankdir: TB) layout fits the "predecessors above, successors below" pattern
- Reasonable node/edge spacing (nodesep: 48, ranksep: 92) for 100+ node graphs
- Mature library with TypeScript types (@dagrejs/dagre)
- Works with multigraph (parallel edges between same nodes)

### Why RefCell<Engine> for WASM State
- Single-threaded WASM context; RefCell provides interior mutability without GC overhead
- Thread_local! engine instance per WASM module
- Safe to call init() multiple times (resets engine state)

### Why localStorage Autosave
- Enables restore of game state and graph on page reload
- No backend dependency for phase 2
- Serializes the full Engine state (graph + all games) via exportGraph()

## Risks / Trade-offs

- **[Risk]: WASM rebuild on toolchain upgrade** - serde serialization may produce different JSON output across Rust versions, breaking import/export. Mitigation: pin Rust toolchain (1.88.0) and avoid upgrading without revising spec compatibility.
- **[Risk]: Graph size unbounded** - DAG can grow indefinitely as players make moves; memory usage increases. Mitigation: Phase 10 will address viewport/region rendering; currently acceptable for single-user local gameplay.
- **[Risk]: Touch threshold false positives/negatives** - 24px swipe threshold may miss small taps or register scrolling as swipe. Mitigation: vertical swipe preferred over horizontal by comparing absDy vs absDx.
- **[Risk]: Random spawn outcomes divergence** - Different random seeds across import/export or between runs may cause graph structure to differ. Mitigation: deterministic board hashing ensures structure consistency; spawn randomness is intentional and accepted.
- **[Trade-off]: Canvas redraw performance** - Full canvas redraw on every move may become costly with extreme graph sizes. Mitigation: current FPS target is 60; Phase 12 will optimize DAG query speed and selective redraws.

## Open Questions

- Should the API server (currently scaffolded but not integrated) be connected to the WASM engine for multiplayer persistence in a future phase? This would require defining sync protocols between the local DAG and remote state.
- What is the maximum practical graph size before performance degrades? Empirical testing needed during Phase 12.
- Should edge labels display full transition details (e.g., "Move Up + Spawn 2") or abbreviated forms? Design currently shows "up", "down", "left", "right", "spawn" - may need localization.
- Is the 3×3 starting board configuration intentional, or should the default be 4×4? Currently the default config is 3x3 per GameConfig::default(), but the UI provides 3×3/4×4/5×5 selectors.