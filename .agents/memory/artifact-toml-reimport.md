---
name: Re-registering artifacts after GitHub import
description: What happens when a pnpm-workspace project with existing artifact.toml files is imported fresh with no workflows configured
---

When a pnpm-workspace project is imported from GitHub, `artifacts/*/.replit-artifact/artifact.toml` files can already exist on disk (from the original Replit project) but `listArtifacts()` returns empty and no workflows are configured — the artifact registration is Replit platform state, not just files on disk.

There's no direct "adopt existing artifact.toml" callback. However, calling `createArtifact()` for any new/unrelated artifact in the same workspace also scans and auto-registers *other* unregistered on-disk artifacts with valid `artifact.toml` files, creating their managed workflows too.

**How to apply:** If real artifacts (with source code) aren't showing up in `listArtifacts()` after a GitHub import, don't attempt a destructive backup/restore dance with `createArtifact` on the same slug (it fails with `ARTIFACT_DIR_EXISTS`). Instead, create one small throwaway-slug artifact anywhere in the workspace — this triggers registration of all pre-existing artifact.toml directories — then delete the throwaway artifact's directory and its workflow afterward.
