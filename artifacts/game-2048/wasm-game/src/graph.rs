use std::collections::HashMap;

use crate::types::*;

/// The global DAG store.
///
/// Nodes are keyed by their content-addressed board hash (NodeId), enforcing
/// deduplication: the same board state always resolves to the same node.
/// Edges are stored as a Vec because transitions are append-only.
pub struct GraphStore {
    nodes: HashMap<NodeId, Node>,
    edges: Vec<Edge>,
}

impl GraphStore {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: Vec::new(),
        }
    }

    /// Get an existing node for a board, or create one if it doesn't exist.
    /// Returns the node and a flag indicating whether it was newly created.
    pub fn get_or_create_node(&mut self, board: Board) -> (Node, bool) {
        let node_id = NodeId::from_board(&board);
        if let Some(existing) = self.nodes.get(&node_id) {
            return (existing.clone(), false);
        }
        let node = Node { node_id, board };
        self.nodes.insert(node_id, node.clone());
        (node, true)
    }

    /// Insert an edge. With content-addressed edge IDs, identical transitions
    /// from different games converge to the same edge ID.
    pub fn insert_edge(&mut self, from: NodeId, to: NodeId, kind: EdgeKind) -> Edge {
        let edge_id = EdgeId::from_content(from, to, &kind);
        let edge = Edge { edge_id, from, to, kind };
        // Avoid duplicate edges with the same ID.
        if self.edges.iter().find(|e| e.edge_id == edge_id).is_none() {
            self.edges.push(edge.clone());
        }
        edge
    }

    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    pub fn all_nodes(&self) -> Vec<Node> {
        self.nodes.values().cloned().collect()
    }

    pub fn all_edges(&self) -> Vec<Edge> {
        self.edges.clone()
    }

    pub fn snapshot(&self) -> GraphSnapshot {
        GraphSnapshot {
            nodes: self.all_nodes(),
            edges: self.all_edges(),
        }
    }

    /// Replace the entire store with the given snapshot. Used during import.
    pub fn load_snapshot(&mut self, snapshot: GraphSnapshot) {
        self.nodes.clear();
        self.edges.clear();
        for node in snapshot.nodes {
            self.nodes.insert(node.node_id, node);
        }
        for edge in snapshot.edges {
            self.insert_edge(edge.from, edge.to, edge.kind);
        }
    }
}
