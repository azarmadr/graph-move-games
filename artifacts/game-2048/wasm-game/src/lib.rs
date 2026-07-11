use wasm_bindgen::prelude::*;

mod game;
mod graph;
mod move_logic;
mod spawn;
mod types;

use game::Engine;
use types::*;

use std::cell::RefCell;

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::new(Engine::new());
}

#[wasm_bindgen]
pub fn version() -> String {
    "2048-wasm v0.3.0".to_string()
}

/// Initialize the engine. Safe to call multiple times.
#[wasm_bindgen]
pub fn init() {
    ENGINE.with(|e| {
        *e.borrow_mut() = Engine::new();
    });
}

/// Create a new game instance with default 4x4 board. Returns full state as JSON string.
#[wasm_bindgen]
pub fn create_game() -> Result<String, JsValue> {
    create_game_with_config("{\"rows\":4,\"cols\":4}".to_string())
}

/// Create a new game instance with custom dimensions.
/// Config JSON: `{ rows: u8, cols: u8 }`
#[wasm_bindgen]
pub fn create_game_with_config(config_json: String) -> Result<String, JsValue> {
    let config: GameConfig = serde_json::from_str(&config_json)
        .map_err(|err| JsValue::from_str(&format!("parse error: {}", err)))?;

    ENGINE.with(|e| {
        let mut engine = e.borrow_mut();
        let state = engine.create_game(&config);
        serde_json::to_string(&state)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Make a move: `{ game_id, direction }` as JSON string.
/// Returns full state + delta as JSON string.
#[wasm_bindgen]
pub fn make_move(req_json: String) -> Result<String, JsValue> {
    let req: MoveRequest = serde_json::from_str(&req_json)
        .map_err(|err| JsValue::from_str(&format!("parse error: {}", err)))?;

    ENGINE.with(|e| {
        let mut engine = e.borrow_mut();
        let response = engine.make_move(req);
        serde_json::to_string(&response)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Get current state for a game_id (no move). game_id as u64 string.
#[wasm_bindgen]
pub fn get_state(game_id_str: String) -> Result<String, JsValue> {
    let game_id: u64 = game_id_str
        .parse()
        .map_err(|_| JsValue::from_str("invalid game_id"))?;

    ENGINE.with(|e| {
        let engine = e.borrow();
        let state = engine.get_state(game_id);
        serde_json::to_string(&state)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}
