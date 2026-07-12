use crate::types::{Board, Cell, SpawnConfig, SpawnOption};

/// Sample a deterministic spawn outcome for the given board.
///
/// model.md: spawned_cells = sample_spawn(Bm, config.spawnConfig)
///
/// For now, spawns one tile of value 2 at the lexicographically first empty
/// cell. Probability weights are parsed but not yet used for randomness; the
/// first option's value is always spawned.
pub fn sample_spawn(board: &Board, config: &SpawnConfig) -> Vec<Cell> {
    let empties = board.empty_positions();
    if empties.is_empty() {
        return Vec::new();
    }

    let option = config
        .spawns
        .first()
        .cloned()
        .unwrap_or(SpawnOption {
            value: 2,
            probability: 1_000_000,
        });

    // Deterministic: always pick the first empty cell.
    let pos = empties[0];
    vec![Cell::new(pos.r, pos.c, option.value)]
}

/// List all possible spawn outcomes for a board. Useful for enumeration and
/// future probabilistic branching. Each outcome is a single tile placed on an
/// empty cell, using the first configured spawn value.
#[allow(dead_code)]
pub fn all_spawn_outcomes(board: &Board, config: &SpawnConfig) -> Vec<Vec<Cell>> {
    let empties = board.empty_positions();
    if empties.is_empty() {
        return vec![Vec::new()];
    }

    let option = config
        .spawns
        .first()
        .cloned()
        .unwrap_or(SpawnOption {
            value: 2,
            probability: 1_000_000,
        });

    empties
        .into_iter()
        .map(|pos| vec![Cell::new(pos.r, pos.c, option.value)])
        .collect()
}
