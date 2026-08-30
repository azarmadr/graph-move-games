## Context

The frontend is a Vite-based web application serving a 2048 game with Rust/WASM backend. Currently requires internet connectivity. The app uses custom web components and force-graph for visualization.

## Goals / Non-Goals

**Goals:**
- Enable offline access to the 2048 game
- Generate a proper web app manifest for installability
- Cache static assets and WASM files via service worker
- Minimal configuration overhead using vite-plugin-pwa

**Non-Goals:**
- Push notifications
- Background sync
- Complex caching strategies (network-first, stale-while-revalidate)
- Custom service worker logic (use Vite PWA defaults)

## Decisions

### Use vite-plugin-pwa
**Choice**: vite-plugin-pwa over manual service worker implementation  
**Rationale**: Provides zero-config PWA support for Vite, handles manifest generation, service worker registration, and build-time optimization. Well-maintained and widely adopted.

### Cache-first strategy for static assets
**Choice**: Cache-first with background updates  
**Rationale**: Static assets (JS, CSS, WASM) are versioned and immutable per build. Cache-first minimizes latency and ensures offline functionality. Background updates check for new versions.

### Generate icons programmatically
**Choice**: Use vite-plugin-pwa's built-in icon generation  
**Rationale**: Avoids manual icon creation. Plugin generates maskable icons from a single source image or placeholder.

### Scope WASM caching
**Choice**: Cache WASM file alongside static assets  
**Rationale**: WASM is essential for game functionality. Caching ensures offline play works.

## Risks / Trade-offs

**[Risk] Stale cache** → Mitigation: Vite PWA uses content hashing for cache invalidation. Users get new versions automatically on next visit when online.

**[Risk] Cache storage limits** → Mitigation: Static assets are small (~500KB). Well within browser storage limits.

**[Trade-off] No custom service worker** → Accepts less control over caching in exchange for simpler maintenance and standard behavior.

## Open Questions

(none)
