use {
    crate::types::GraphLayout,
    petgraph::graph::{DiGraph, NodeIndex},
    std::collections::HashMap,
    visgraph::layout::hierarchical::{Orientation, hierarchical_layout},
};

/// Apply visgraph hierarchical layout to the graph, writing x/y into each node.
/// Positions are scaled to pixel coordinates (normalized * 1000).
pub fn apply_visgraph_layout(graph: &mut GraphLayout) {
    if graph.nodes.is_empty() {
        return;
    }

    let mut petgraph = DiGraph::<(), ()>::new();
    let mut index_map: HashMap<String, NodeIndex> = HashMap::new();

    for key in graph.nodes.keys() {
        let idx = petgraph.add_node(());
        index_map.insert(key.clone(), idx);
    }

    for edge in graph.edges.values() {
        if let (Some(&from_idx), Some(&to_idx)) =
            (index_map.get(&edge.from), index_map.get(&edge.to))
        {
            petgraph.add_edge(from_idx, to_idx, ());
        }
    }

    let binding = &petgraph;
    let pos_fn = hierarchical_layout(&binding, Orientation::TopToBottom);

    for (key, idx) in &index_map {
        let (x, y) = pos_fn(*idx);
        if let Some(node) = graph.nodes.get_mut(key) {
            node.x = Some(x * 1000.0);
            node.y = Some(y * 1000.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use {
        super::*,
        crate::types::{Node, WasmEdge},
        game_core::{Board, Edge},
    };

    fn make_board() -> Board {
        Board::with_dim(4, 4)
    }

    #[test]
    fn empty_graph_no_panic() {
        let mut graph = GraphLayout::new();
        apply_visgraph_layout(&mut graph);
        assert!(graph.nodes.is_empty());
    }

    #[test]
    fn single_node_gets_position() {
        let mut graph = GraphLayout::new();
        graph.nodes.insert(
            "board:1".to_string(),
            Node {
                board: make_board(),
                x: None,
                y: None,
            },
        );
        apply_visgraph_layout(&mut graph);
        let node = graph.nodes.get("board:1").unwrap();
        assert!(node.x.is_some());
        assert!(node.y.is_some());
    }

    #[test]
    fn positions_are_normalized() {
        let mut graph = GraphLayout::new();
        for i in 0..5 {
            graph.nodes.insert(
                format!("board:{}", i),
                Node {
                    board: make_board(),
                    x: None,
                    y: None,
                },
            );
        }
        graph.edges.insert(
            "edge:0".to_string(),
            WasmEdge {
                from: "board:0".to_string(),
                to: "board:1".to_string(),
                kind: Edge::Move(game_core::Direction::Right),
            },
        );
        graph.edges.insert(
            "edge:1".to_string(),
            WasmEdge {
                from: "board:1".to_string(),
                to: "board:2".to_string(),
                kind: Edge::Move(game_core::Direction::Down),
            },
        );
        apply_visgraph_layout(&mut graph);
        for node in graph.nodes.values() {
            let x = node.x.unwrap();
            let y = node.y.unwrap();
            assert!(x >= 0.0 && x <= 1000.0, "x out of range: {}", x);
            assert!(y >= 0.0 && y <= 1000.0, "y out of range: {}", y);
        }
    }
}
