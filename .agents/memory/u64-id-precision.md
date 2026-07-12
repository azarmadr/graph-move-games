---
name: u64 ID precision over the WASM bridge
description: JavaScript numbers lose precision for large u64 IDs; serialize them as strings in the JSON contract
---

Rust IDs created as 64-bit hashes (e.g., FNV-1a) can exceed `Number.MAX_SAFE_INTEGER` (2^53 - 1 ≈ 9 × 10^15). When these IDs cross the WASM bridge as JSON numbers, the frontend parses them into JavaScript `number` values that are rounded. Sending the same rounded value back to Rust causes lookups to fail silently (e.g., "game not found").

**Why:** JSON numbers are parsed as IEEE-754 doubles in JavaScript. Integers above 2^53 are not guaranteed to round-trip exactly.

**How to apply:**
1. Serialize all u64 IDs as decimal strings on the Rust side using custom `Serialize`/`Deserialize` implementations.
2. Treat IDs as `string` in TypeScript interfaces and frontend comparisons.
3. Parse the string back to `u64` in Rust when deserializing requests.

This keeps the internal engine types as strong `u64` newtypes while ensuring the JS/JSON contract is lossless.
