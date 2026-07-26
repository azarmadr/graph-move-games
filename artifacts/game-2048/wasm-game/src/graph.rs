use {
    crate::types::*,
    serde::{Deserialize, Serialize},
    std::collections::HashMap,
};

/// The global DAG store.
///
/// Nodes are keyed by their content-addressed board hash (NodeId), enforcing
/// deduplication: the same board state always resolves to the same node.
/// Edges are stored as a Vec because transitions are append-only.
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct GraphStore {
    nodes: HashMap<NodeId, Node>,
    edges: HashMap<EdgeId, Edge>,
}

impl GraphStore {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
        }
    }

    pub fn get_node_kv(&self, node_id: &NodeId) -> (NodeId, Node) {
        (*node_id, self.nodes.get(node_id).unwrap().clone())
    }

    /// Get an existing node for a board, or create one if it doesn't exist.
    /// Returns the node and a flag indicating whether it was newly created.
    pub fn get_or_create_node(&mut self, board: Board) -> (NodeId, bool) {
        let node_id = NodeId::from_board(&board);
        if self.nodes.contains_key(&node_id) {
            return (node_id, false);
        }
        let node = Node { board };
        self.nodes.insert(node_id, node);
        (node_id, true)
    }

    /// Insert an edge. With content-addressed edge IDs, identical transitions
    /// from different games converge to the same edge ID.
    pub fn insert_edge(&mut self, from: NodeId, to: NodeId, kind: EdgeKind) -> Edge {
        let edge_id = EdgeId::from_content(from, to, &kind);
        let edge = Edge { from, to, kind };
        // Avoid duplicate edges with the same ID.
        self.edges.insert(edge_id, edge.clone());
        edge
    }

    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    /// Replace the entire store with the given snapshot. Used during import.
    pub fn load_snapshot(&mut self, snapshot: GraphStore) {
        for (node_id, node) in snapshot.nodes {
            self.nodes.insert(node_id, node); // TODO: should node_id's be recalculated
        }
        for (_edge_id, edge) in snapshot.edges {
            self.insert_edge(edge.from, edge.to, edge.kind);
        }
    }
}
