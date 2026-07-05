use wasm_bindgen::prelude::*;

/// Returns the WASM module version string.
/// Phase 1 placeholder — proves the build pipeline works.
#[wasm_bindgen]
pub fn version() -> String {
    "2048-wasm v0.1.0".to_string()
}
