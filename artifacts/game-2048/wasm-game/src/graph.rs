use {
    crate::types::*,
    petgraph::{
        graph::{DiGraph, EdgeIndex, NodeIndex},
        visit::EdgeRef,
    },
    serde::{Deserialize, Serialize},
    std::collections::HashMap,
};

/// Canonical global DAG storage.
///
/// The graph owns boards and transition payloads. The two indexes are derived
/// lookup accelerators and are rebuilt after deserialization.
#[derive(Serialize, Deserialize, Debug)]
pub struct GraphStore {
    pub graph: DiGraph<Board, Edge>,
    #[serde(skip)]
    pub board_ids: HashMap<BoardId, NodeIndex>,
    #[serde(skip)]
    pub edge_ids: HashMap<EdgeId, EdgeIndex>,
}

impl GraphStore {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            board_ids: HashMap::new(),
            edge_ids: HashMap::new(),
        }
    }

    pub fn rebuild_indexes(&mut self) {
        self.board_ids.clear();
        self.edge_ids.clear();

        for node_index in self.graph.node_indices() {
            if let Some(board) = self.graph.node_weight(node_index) {
                self.board_ids
                    .insert(BoardId::from_board(board), node_index);
            }
        }

        for edge_ref in self.graph.edge_references() {
            let from = edge_ref.source();
            let to = edge_ref.target();
            let Some(from_board) = self.graph.node_weight(from) else {
                continue;
            };
            let Some(to_board) = self.graph.node_weight(to) else {
                continue;
            };
            let from_id = BoardId::from_board(from_board);
            let to_id = BoardId::from_board(to_board);
            let edge_id = EdgeId::from_content(from_id, to_id, edge_ref.weight());
            self.edge_ids.insert(edge_id, edge_ref.id());
        }
    }

    pub fn get_or_create_node(&mut self, board: Board) -> (BoardId, bool) {
        let board_id = BoardId::from_board(&board);
        if self.board_ids.contains_key(&board_id) {
            return (board_id, false);
        }

        let node_index = self.graph.add_node(board);
        self.board_ids.insert(board_id, node_index);
        (board_id, true)
    }

    pub fn get_node(&self, board_id: BoardId) -> Option<&Board> {
        self.board_ids
            .get(&board_id)
            .and_then(|index| self.graph.node_weight(*index))
    }

    pub fn node_data(&self, board_id: BoardId) -> Option<Board> {
        self.get_node(board_id).cloned()
    }

    pub fn insert_edge(&mut self, from: BoardId, to: BoardId, edge: Edge) -> (EdgeId, bool) {
        let edge_id = EdgeId::from_content(from, to, &edge);
        if self.edge_ids.contains_key(&edge_id) {
            return (edge_id, false);
        }

        let Some(&from_index) = self.board_ids.get(&from) else {
            return (edge_id, false);
        };
        let Some(&to_index) = self.board_ids.get(&to) else {
            return (edge_id, false);
        };

        let edge_index = self.graph.add_edge(from_index, to_index, edge);
        self.edge_ids.insert(edge_id, edge_index);
        (edge_id, true)
    }

    pub fn graph_data(&self) -> GraphData {
        let mut nodes = HashMap::new();
        for node_index in self.graph.node_indices() {
            if let Some(board) = self.graph.node_weight(node_index) {
                let board_id = BoardId::from_board(board);
                nodes.insert(board_id, board.clone());
            }
        }

        let mut edges = HashMap::new();
        for edge_ref in self.graph.edge_references() {
            let from_board = self.graph.node_weight(edge_ref.source());
            let to_board = self.graph.node_weight(edge_ref.target());
            let (Some(from_board), Some(to_board)) = (from_board, to_board) else {
                continue;
            };
            let from = BoardId::from_board(from_board);
            let to = BoardId::from_board(to_board);
            let edge_id = EdgeId::from_content(from, to, edge_ref.weight());
            edges.insert(
                edge_id,
                GraphEdge {
                    from,
                    to,
                    kind: edge_ref.weight().clone(),
                },
            );
        }

        GraphData { nodes, edges }
    }
}
