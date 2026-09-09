use {
    game_core::{BoardId, Engine, GameId, GameInstance},
    petgraph::visit::EdgeRef,
    std::{collections::HashMap, env, fs, process},
};

/// Strip the `exportData` wrapper if present, returning the raw Engine JSON.
fn unwrap_export_data(json: &str) -> String {
    let v: serde_json::Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return json.to_string(),
    };
    if let Some(ed) = v.get("exportData") {
        ed.to_string()
    } else {
        json.to_string()
    }
}

fn load_engine(path: &str) -> Engine {
    let raw = fs::read_to_string(path).unwrap_or_else(|e| {
        eprintln!("error: cannot read {path}: {e}");
        process::exit(1);
    });
    let json = unwrap_export_data(&raw);
    serde_json::from_str(&json).unwrap_or_else(|e| {
        eprintln!("error: cannot parse {path}: {e}");
        process::exit(1);
    })
}

fn merge(engines: &[Engine]) -> Engine {
    // 1. Collect all boards, keyed by content-addressed BoardId for dedup.
    let mut merged_boards: Vec<game_core::Board> = Vec::new();
    let mut board_id_to_idx: HashMap<BoardId, usize> = HashMap::new();

    for engine in engines {
        let gs = engine.get_graph_store();
        for node_idx in gs.graph.node_indices() {
            if let Some(board) = gs.graph.node_weight(node_idx) {
                let id = BoardId::from_board(board);
                if !board_id_to_idx.contains_key(&id) {
                    let idx = merged_boards.len();
                    board_id_to_idx.insert(id, idx);
                    merged_boards.push(board.clone());
                }
            }
        }
    }

    // 2. Build the merged graph: add all boards as nodes, then remap and add edges.
    let mut graph = game_core::graph::GraphStore::new();

    for board in &merged_boards {
        graph.get_or_create_node(board.clone());
    }

    // Remap and insert edges. Edges reference BoardId (content hash), which maps
    // to a merged index. Use insert_edge with the remapped BoardIds.
    for engine in engines {
        let gs = engine.get_graph_store();
        for edge_ref in gs.graph.edge_references() {
            let from_board = gs.graph.node_weight(edge_ref.source());
            let to_board = gs.graph.node_weight(edge_ref.target());
            let (Some(from_board), Some(to_board)) = (from_board, to_board) else {
                continue;
            };

            let from_id = BoardId::from_board(from_board);
            let to_id = BoardId::from_board(to_board);

            graph.insert_edge(
                BoardId::from_board(&merged_boards[board_id_to_idx[&from_id]]),
                BoardId::from_board(&merged_boards[board_id_to_idx[&to_id]]),
                edge_ref.weight().clone(),
            );
        }
    }

    // 3. Merge games. Dedup by (source, current, score). Remap board IDs.
    let mut merged_games: HashMap<GameId, GameInstance> = HashMap::new();
    let mut seen_game_keys: std::collections::HashSet<(u64, u64, u64)> =
        std::collections::HashSet::new();
    let mut next_nonce: u64 = 0;

    for engine in engines {
        for game in engine.all_game_states() {
            let new_source = board_id_to_idx
                .get(&game.game.source_board_id)
                .map(|&i| BoardId::from_board(&merged_boards[i]))
                .unwrap_or(game.game.source_board_id);

            let new_current = board_id_to_idx
                .get(&game.game.current_board_id)
                .map(|&i| BoardId::from_board(&merged_boards[i]))
                .unwrap_or(game.game.current_board_id);

            let dedup_key = (new_source.0, new_current.0, game.game.score);
            if seen_game_keys.contains(&dedup_key) {
                continue;
            }
            seen_game_keys.insert(dedup_key);

            let game_id = GameId::from_nonce(next_nonce);
            next_nonce += 1;

            merged_games.insert(
                game_id,
                GameInstance {
                    id: game_id,
                    source_board_id: new_source,
                    current_board_id: new_current,
                    score: game.game.score,
                    is_terminated: game.game.is_terminated,
                    config: game.game.config.clone(),
                },
            );
        }

        // Ensure nonce stays ahead of any we've seen.
        let engine_nonce = engine.get_next_game_nonce();
        if engine_nonce >= next_nonce {
            next_nonce = engine_nonce + 1;
        }
    }

    let mut merged = Engine::new();
    *merged.get_graph_store_mut() = graph;
    merged.set_games(merged_games);
    merged.set_next_game_nonce(next_nonce);
    merged
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("usage: merge-cli <output.json> <input1.json> [input2.json] ...");
        eprintln!("       merge-cli --stdout <input1.json> [input2.json] ...");
        process::exit(1);
    }

    let stdout = args[0] == "--stdout";
    let (out_path, input_paths) = if stdout {
        (None, &args[1..])
    } else {
        (Some(&args[0]), &args[1..])
    };

    if input_paths.is_empty() {
        eprintln!("error: no input files");
        process::exit(1);
    }

    let engines: Vec<Engine> = input_paths.iter().map(|p| load_engine(p)).collect();
    let merged = merge(&engines);

    let merged_json = serde_json::to_string(&merged).expect("serialize");
    let output = serde_json::json!({
        "exportData": serde_json::from_str::<serde_json::Value>(&merged_json).unwrap(),
        "activeGameId": merged.all_game_states().first().map(|s| s.game.id.0.to_string()).unwrap_or_default(),
    });
    let result = serde_json::to_string(&output).expect("serialize");

    if stdout {
        println!("{result}");
    } else {
        let path = out_path.unwrap();
        fs::write(path, &result).unwrap_or_else(|e| {
            eprintln!("error: cannot write {path}: {e}");
            process::exit(1);
        });
        let stats = format!(
            "merged {} files → {} boards, {} games",
            engines.len(),
            merged.get_graph_store().graph.node_count(),
            merged.all_game_states().len(),
        );
        eprintln!("{stats}");
    }
}
