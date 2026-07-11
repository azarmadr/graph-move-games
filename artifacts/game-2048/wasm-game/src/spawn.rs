use crate::types::{Board, Cell, Pos, SpawnPayload};

/// Configuration for spawn enumeration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpawnConfig {
    pub spawn_count: u8,      // tiles to spawn per step (default 1)
    pub max_outcomes: usize, // cap (default 32)
}

impl Default for SpawnConfig {
    fn default() -> Self {
        Self {
            spawn_count: 1,
            max_outcomes: 32,
        }
    }
}

/// Enumerate all distinct spawn outcomes for a given board.
/// Each outcome is a set of cells placed on empty positions.
/// Outcomes are deduplicated by exact multiset of (pos, tile).
/// Capped by max_outcomes; sorted deterministically.
pub fn enumerate_spawn_outcomes(board: &Board, config: &SpawnConfig) -> Vec<SpawnPayload> {
    let empties = board.empty_positions();
    if empties.is_empty() {
        return vec![SpawnPayload { cells: vec![] }];
    }

    if config.spawn_count == 1 {
        // Single-tile spawn: one outcome per empty cell
        let mut outcomes: Vec<SpawnPayload> = empties
            .iter()
            .map(|pos| SpawnPayload {
                cells: vec![Cell::new(pos.r, pos.c, 2)], // default value 2
            })
            .collect();

        // Stable deterministic sort by (r, c)
        outcomes.sort_by(|a, b| {
            let a_key = a.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            let b_key = b.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            a_key.cmp(&b_key)
        });

        // Deduplicate
        outcomes.dedup_by(|a, b| {
            let a_key = a.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            let b_key = b.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            a_key == b_key
        });

        if outcomes.len() > config.max_outcomes {
            outcomes.truncate(config.max_outcomes);
        }
        outcomes
    } else {
        // Multi-tile spawn: generate combinations
        let mut outcomes: Vec<SpawnPayload> = Vec::new();
        generate_combinations(
            &empties,
            config.spawn_count as usize,
            &mut Vec::new(),
            &mut outcomes,
        );

        // Deduplicate by exact multiset
        outcomes.sort_by(|a, b| {
            let a_key = a.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            let b_key = b.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            a_key.cmp(&b_key)
        });
        outcomes.dedup_by(|a, b| {
            let a_key = a.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            let b_key = b.cells.iter().map(|c| (c.pos.r, c.pos.c, c.tile)).collect::<Vec<_>>();
            a_key == b_key
        });

        if outcomes.len() > config.max_outcomes {
            outcomes.truncate(config.max_outcomes);
        }
        outcomes
    }
}

fn generate_combinations(
    empties: &[Pos],
    k: usize,
    current: &mut Vec<Cell>,
    outcomes: &mut Vec<SpawnPayload>,
) {
    if current.len() == k {
        outcomes.push(SpawnPayload {
            cells: current.clone(),
        });
        return;
    }
    if empties.is_empty() {
        return;
    }

    for i in 0..empties.len() {
        let pos = empties[i];
        current.push(Cell::new(pos.r, pos.c, 2));
        generate_combinations(&empties[i + 1..], k, current, outcomes);
        current.pop();
    }
}
