use std::collections::HashMap;

use crate::types::*;

/// The global DAG store. All nodes and edges live here.
///
/// IDs are content-addressed: inserting the same board+kind or the same
/// (from, to, edge_type) returns the same ID, which makes the graph naturally
/// shareable across games and stable across import/export cycles.
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

    /// Insert a node and return the stored node (with its content-addressed ID).
    pub fn insert_node(&mut self, board: Board, kind: NodeKind) -> Node {
        let node_id = NodeId::from_content(&board, &kind);
        let node = Node { node_id, board, kind };
        self.nodes.insert(node_id, node.clone());
        node
    }

    /// Insert an edge and return the stored edge (with its content-addressed ID).
    pub fn insert_edge(&mut self, from: NodeId, to: NodeId, edge_type: EdgeType) -> Edge {
        let edge_id = EdgeId::from_content(from, to, &edge_type);
        let edge = Edge { edge_id, from, to, edge_type };
        self.edges.insert(edge_id, edge.clone());
        edge
    }

    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    pub fn all_nodes(&self) -> Vec<Node> {
        self.nodes.values().cloned().collect()
    }

    pub fn all_edges(&self) -> Vec<Edge> {
        self.edges.values().cloned().collect()
    }

    pub fn snapshot(&self) -> GraphSnapshot {
        GraphSnapshot {
            nodes: self.all_nodes(),
            edges: self.all_edges(),
        }
    }

    /// Replace the entire store with the given snapshot. Used during import.
    /// Caller is responsible for ensuring the imported IDs are canonical;
    /// this just trusts the provided snapshot.
    pub fn load_snapshot(&mut self, snapshot: GraphSnapshot) {
        self.nodes.clear();
        self.edges.clear();
        for node in snapshot.nodes {
            self.nodes.insert(node.node_id, node);
        }
        for edge in snapshot.edges {
            self.edges.insert(edge.edge_id, edge);
        }
    }
}
