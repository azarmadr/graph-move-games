use {
    game_core::{Board, Edge},
    serde::{Deserialize, Serialize},
    std::collections::HashMap,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub board: Board,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmEdge {
    pub from: String,
    pub to: String,
    pub kind: Edge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphLayout {
    pub nodes: HashMap<String, Node>,
    pub edges: HashMap<String, WasmEdge>,
}

impl GraphLayout {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
        }
    }
}
