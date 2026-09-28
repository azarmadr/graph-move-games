use crate::types::GraphLayout;

/// Remove bidirectional edges. For every pair (A, B) where both A→B and B→A exist,
/// the B→A edge is removed (keeps the one with the lower key).
pub fn prune_reverse_edges(graph: &mut GraphLayout) {
    let mut to_remove: Vec<String> = Vec::new();
    let mut processed: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (key_a, edge_a) in &graph.edges {
        if processed.contains(key_a) {
            continue;
        }
        for (key_b, edge_b) in &graph.edges {
            if key_a == key_b || processed.contains(key_b) {
                continue;
            }
            if edge_a.from == edge_b.to && edge_a.to == edge_b.from {
                // Remove the one with the higher key (keep the lower one)
                if key_a < key_b {
                    to_remove.push(key_b.clone());
                } else {
                    to_remove.push(key_a.clone());
                }
            }
        }
        processed.insert(key_a.clone());
    }

    for key in &to_remove {
        graph.edges.remove(key);
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

    fn make_node() -> Node {
        Node {
            board: make_board(),
            x: None,
            y: None,
        }
    }

    #[test]
    fn prune_removes_bidirectional() {
        let mut graph = GraphLayout::new();
        graph.nodes.insert("board:1".to_string(), make_node());
        graph.nodes.insert("board:2".to_string(), make_node());
        graph.edges.insert(
            "edge:0".to_string(),
            WasmEdge {
                from: "board:1".to_string(),
                to: "board:2".to_string(),
                kind: Edge::Move(game_core::Direction::Right),
            },
        );
        graph.edges.insert(
            "edge:1".to_string(),
            WasmEdge {
                from: "board:2".to_string(),
                to: "board:1".to_string(),
                kind: Edge::Move(game_core::Direction::Left),
            },
        );

        prune_reverse_edges(&mut graph);
        assert_eq!(graph.edges.len(), 1);
        assert!(graph.edges.contains_key("edge:0"));
        assert!(!graph.edges.contains_key("edge:1"));
    }

    #[test]
    fn prune_keeps_unidirectional() {
        let mut graph = GraphLayout::new();
        graph.nodes.insert("board:1".to_string(), make_node());
        graph.nodes.insert("board:2".to_string(), make_node());
        graph.nodes.insert("board:3".to_string(), make_node());
        graph.edges.insert(
            "edge:0".to_string(),
            WasmEdge {
                from: "board:1".to_string(),
                to: "board:2".to_string(),
                kind: Edge::Move(game_core::Direction::Right),
            },
        );
        graph.edges.insert(
            "edge:1".to_string(),
            WasmEdge {
                from: "board:2".to_string(),
                to: "board:3".to_string(),
                kind: Edge::Move(game_core::Direction::Down),
            },
        );

        prune_reverse_edges(&mut graph);
        assert_eq!(graph.edges.len(), 2);
    }

    #[test]
    fn prune_preserves_longer_cycles() {
        let mut graph = GraphLayout::new();
        graph.nodes.insert("board:1".to_string(), make_node());
        graph.nodes.insert("board:2".to_string(), make_node());
        graph.nodes.insert("board:3".to_string(), make_node());
        graph.edges.insert(
            "edge:0".to_string(),
            WasmEdge {
                from: "board:1".to_string(),
                to: "board:2".to_string(),
                kind: Edge::Move(game_core::Direction::Right),
            },
        );
        graph.edges.insert(
            "edge:1".to_string(),
            WasmEdge {
                from: "board:2".to_string(),
                to: "board:3".to_string(),
                kind: Edge::Move(game_core::Direction::Down),
            },
        );
        graph.edges.insert(
            "edge:2".to_string(),
            WasmEdge {
                from: "board:3".to_string(),
                to: "board:1".to_string(),
                kind: Edge::Move(game_core::Direction::Up),
            },
        );

        prune_reverse_edges(&mut graph);
        assert_eq!(graph.edges.len(), 3);
    }
}
