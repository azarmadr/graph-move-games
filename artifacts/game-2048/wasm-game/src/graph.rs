use std::collections::HashMap;

use crate::types::*;

/// The global DAG store. All nodes and edges live here.
pub struct GraphStore {
    nodes: HashMap<NodeId, Node>,
    edges: HashMap<EdgeId, Edge>,
    next_node_id: NodeId,
    next_edge_id: EdgeId,
}

impl GraphStore {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
            next_node_id: 1,
            next_edge_id: 1,
        }
    }

    /// Allocate a fresh monotonically increasing node ID.
    pub fn alloc_node_id(&mut self) -> NodeId {
        let id = self.next_node_id;
        self.next_node_id += 1;
        id
    }

    /// Allocate a fresh monotonically increasing edge ID.
    pub fn alloc_edge_id(&mut self) -> EdgeId {
        let id = self.next_edge_id;
        self.next_edge_id += 1;
        id
    }

    pub fn insert_node(&mut self, node: Node) {
        self.nodes.insert(node.node_id, node);
    }

    pub fn insert_edge(&mut self, edge: Edge) {
        self.edges.insert(edge.edge_id, edge);
    }

    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    pub fn get_node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(&id)
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
}
