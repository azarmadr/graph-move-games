mod layout;
mod prune;
mod types;

use {
    game_core::*,
    std::{cell::RefCell, ops::Deref},
    types::{GraphLayout, Node, WasmEdge},
    wasm_bindgen::prelude::*,
};

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::new(Engine::new());
}

fn build_graph_layout(engine: &Engine) -> GraphLayout {
    let graph_data = engine.get_graph();
    let mut layout = GraphLayout::new();

    for (board_id, board) in &graph_data.nodes {
        layout.nodes.insert(
            format!("board:{}", board_id.0),
            Node {
                board: board.clone(),
                x: None,
                y: None,
            },
        );
    }

    for (edge_id, graph_edge) in &graph_data.edges {
        layout.edges.insert(
            format!("edge:{}", edge_id.0),
            WasmEdge {
                from: format!("board:{}", graph_edge.from.0),
                to: format!("board:{}", graph_edge.to.0),
                kind: graph_edge.kind.clone(),
            },
        );
    }

    layout
}

#[wasm_bindgen]
pub fn version() -> String {
    "2048-wasm v0.5.0".to_string()
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
    create_game_with_config(
        serde_json::to_string(&GameConfig::default())
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))?,
    )
}

/// Create a new game instance with custom dimensions.
/// Config JSON: `{ rows: u8, cols: u8, spawn_config?: { spawns: [{ value: u32, probability: u64 }] } }`
#[wasm_bindgen]
pub fn create_game_with_config(config_json: String) -> Result<String, JsValue> {
    let config: GameConfig = serde_json::from_str(&config_json)
        .map_err(|err| JsValue::from_str(&format!("GameConfig parse error: {}", err)))?;

    ENGINE.with(|e| {
        let mut engine = e.borrow_mut();
        let state = engine
            .create_game(&config)
            .map_err(|err| JsValue::from_str(&err))?;
        serde_json::to_string(&state)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Make a move: game_id as u64 string, direction as "Up"|"Down"|"Left"|"Right".
/// Returns the new game state as JSON string.
#[wasm_bindgen]
pub fn make_move(game_id_str: String, direction: String) -> Result<String, JsValue> {
    let game_id: GameId = game_id_str
        .parse::<u64>()
        .map(GameId)
        .map_err(|_| JsValue::from_str("invalid game_id"))?;

    let direction = match direction.as_str() {
        "Up" => Direction::Up,
        "Down" => Direction::Down,
        "Left" => Direction::Left,
        "Right" => Direction::Right,
        _ => return Err(JsValue::from_str("invalid direction")),
    };

    ENGINE.with(|e| {
        let mut engine = e.borrow_mut();
        let state = engine
            .make_move(game_id, direction)
            .map_err(|err| JsValue::from_str(&err))?;
        serde_json::to_string(&state)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Get the graph as JSON string (for the visualization tab).
/// prune_edges: if true, removes bidirectional edges
/// layout_mode: "dagre" | "fg-dag" | "visgraph" — if "visgraph", positions are computed in WASM
#[wasm_bindgen]
pub fn get_graph(prune_edges: bool, layout_mode: String) -> Result<String, JsValue> {
    ENGINE.with(|e| {
        let engine = e.borrow();
        let mut graph = build_graph_layout(&engine);

        if prune_edges {
            prune::prune_reverse_edges(&mut graph);
        }

        if layout_mode == "visgraph" {
            layout::apply_visgraph_layout(&mut graph);
        }

        serde_json::to_string(&graph)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Get current state for a game_id (no move). game_id as u64 string.
#[wasm_bindgen]
pub fn get_state(game_id_str: String) -> Result<String, JsValue> {
    let game_id: GameId = game_id_str
        .parse::<u64>()
        .map(GameId)
        .map_err(|_| JsValue::from_str("invalid game_id"))?;

    ENGINE.with(|e| {
        let engine = e.borrow();
        let state = engine
            .get_state(game_id)
            .map_err(|err| JsValue::from_str(&err))?;
        serde_json::to_string(&state)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Export the entire graph + all games as a JSON string.
#[wasm_bindgen]
pub fn export_graph() -> Result<String, JsValue> {
    ENGINE.with(|e| {
        let engine = e.borrow();
        serde_json::to_string(&engine.deref())
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

/// Import a previously exported graph. Replaces the current engine state.
/// Returns an import result JSON with `success` and `games`.
#[wasm_bindgen]
pub fn import_graph(json: String) -> Result<String, JsValue> {
    let data: Engine = serde_json::from_str(&json)
        .map_err(|err| JsValue::from_str(&format!("parse error: {}", err)))?;

    ENGINE.with(|e| {
        let mut engine = e.borrow_mut();
        let result = engine.import(data);
        serde_json::to_string(&result)
            .map_err(|err| JsValue::from_str(&format!("serialize error: {}", err)))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_graph_layout_empty_engine() {
        let engine = Engine::new();
        let layout = build_graph_layout(&engine);
        assert!(layout.nodes.is_empty());
        assert!(layout.edges.is_empty());
    }

    #[test]
    fn build_graph_layout_after_create_game() {
        let mut engine = Engine::new();
        engine.create_game(&GameConfig::default()).unwrap();
        let layout = build_graph_layout(&engine);
        assert!(!layout.nodes.is_empty());
    }
}
