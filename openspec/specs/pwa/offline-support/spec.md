## Purpose

Enable offline functionality through service worker caching, allowing users to access the 2048 game without an internet connection after initial load.

## Requirements

### Requirement: Service worker caches static assets
The system SHALL install a service worker that caches all static assets (HTML, CSS, JS, WASM files) during the install event.

#### Scenario: First visit loads and caches assets
- **WHEN** user visits the application for the first time
- **THEN** service worker installs and caches all static assets
- **AND** application is available for offline use

### Requirement: Offline access
The system SHALL serve cached assets when the network is unavailable.

#### Scenario: Accessing app offline
- **WHEN** user has previously visited the app AND is now offline
- **THEN** application loads from cache
- **AND** all static assets are served from service worker cache

### Requirement: WASM file caching
The system SHALL cache the WebAssembly binary file for offline gameplay.

#### Scenario: WASM loads offline
- **WHEN** user is offline AND has previously loaded the app
- **THEN** WASM module loads from cache
- **AND** game functionality works without network

### Requirement: Cache update strategy
The system SHALL use a cache-first strategy for static assets to minimize network requests.

#### Scenario: Returning visit uses cache
- **WHEN** user visits the app again
- **THEN** cached assets are served immediately
- **AND** background update check occurs if online
