## Why

The frontend is currently a standard Vite web app that requires an internet connection to load. Adding PWA support will enable offline functionality, allowing users to play the 2048 game without connectivity, improve loading performance through caching, and provide a native app-like experience on mobile devices.

## What Changes

- Add `vite-plugin-pwa` dependency
- Configure Vite PWA plugin with manifest, service worker, and caching strategies
- Generate a web app manifest with app metadata (name, icons, theme colors)
- Enable service worker for offline support and asset caching
- Add install prompt handling for "Add to Home Screen" functionality

## Capabilities

### New Capabilities

- `pwa/offline-support`: Service worker configuration for offline caching of static assets and WASM files
- `pwa/manifest`: Web app manifest generation with app metadata and icons

### Modified Capabilities

(none)

## Impact

- `package.json`: Add `vite-plugin-pwa` dev dependency
- `vite.config.ts`: Add PWA plugin configuration
- `public/`: Add PWA icons (or use generated ones)
- `index.html`: May need meta tags for PWA
- Build output will include service worker and manifest files
