use {
    crate::types::{Board, Cell, SpawnConfig},
    rand::RngExt,
};

impl Board {
    /// Sample one spawn outcome for the given board.
    ///
    /// The randomness is generated inside Rust/WASM. The frontend does not provide
    /// a seed or random value. The empty position is selected uniformly, and tile
    /// values are selected according to the configured integer weights.
    pub fn sample_spawn(&self, config: &SpawnConfig) -> Result<Vec<Cell>, String> {
        let empties = self.empty_positions();
        if empties.is_empty() {
            return Ok(Vec::new());
        }

        let pos = random_item(&empties)?;
        let tile = weighted_tile(config)?;

        Ok(vec![Cell::new(pos.r, pos.c, tile)])
    }
}

fn random_item<T: Clone>(items: &[T]) -> Result<T, String> {
    if items.is_empty() {
        return Err("cannot choose a random item from an empty list".to_string());
    }

    let mut rng = rand::rng();
    Ok(items[rng.random_range(0..items.len())].clone())
}

fn weighted_tile(config: &SpawnConfig) -> Result<u32, String> {
    let weighted: Vec<(u32, u32)> = config
        .spawns
        .iter()
        .filter(|(_, weight)| **weight > 0)
        .map(|(tile, weight)| (*tile, *weight))
        .collect();

    let total_weight: u64 = weighted.iter().map(|(_, weight)| u64::from(*weight)).sum();
    if total_weight == 0 {
        return Err("spawn_config must contain at least one positive weight".to_string());
    }

    let mut rng = rand::rng();
    let mut pick = rng.random_range(0..total_weight);
    for (tile, weight) in weighted {
        let weight = u64::from(weight);
        if pick < weight {
            return Ok(tile);
        }
        pick -= weight;
    }

    Err("failed to sample a tile from spawn_config".to_string())
}

#[cfg(test)]
mod tests {
    use {
        super::*,
        crate::types::Pos,
        std::collections::{HashMap, HashSet},
    };

    #[test]
    fn samples_one_configured_tile_in_an_empty_cell() {
        let board = Board::with_tiles(3, 3, vec![Cell::new(1, 1, 8)]);
        let config = SpawnConfig {
            spawns: HashMap::from([(2, 9), (4, 1)]),
        };

        for _ in 0..64 {
            let result = board.sample_spawn(&config).unwrap();
            assert_eq!(result.len(), 1);
            assert!(board.empty_positions().contains(&result[0].pos));
            assert!(matches!(result[0].tile, 2 | 4));
        }
    }

    #[test]
    fn randomizes_empty_cell_selection() {
        let board = Board::with_tiles(3, 3, vec![Cell::new(1, 1, 8)]);
        let config = SpawnConfig {
            spawns: HashMap::from([(2, 1)]),
        };
        let positions: HashSet<Pos> = (0..128)
            .map(|_| board.sample_spawn(&config).unwrap()[0].pos)
            .collect();

        assert!(positions.len() > 1, "spawn position did not vary");
    }

    #[test]
    fn randomizes_weighted_tile_selection() {
        let board = Board::with_tiles(1, 2, vec![Cell::new(0, 0, 8)]);
        let config = SpawnConfig {
            spawns: HashMap::from([(2, 9), (4, 1)]),
        };
        let tiles: HashSet<u32> = (0..256)
            .map(|_| board.sample_spawn(&config).unwrap()[0].tile)
            .collect();

        assert_eq!(tiles, HashSet::from([2, 4]));
    }

    #[test]
    fn rejects_config_without_positive_weights() {
        let board = Board::with_tiles(1, 2, vec![Cell::new(0, 0, 8)]);
        let config = SpawnConfig {
            spawns: HashMap::from([(2, 0), (4, 0)]),
        };

        let error = board.sample_spawn(&config).unwrap_err();
        assert!(error.contains("positive weight"));
    }

    #[test]
    fn returns_no_spawn_when_board_is_full() {
        let board = Board::with_tiles(1, 1, vec![Cell::new(0, 0, 8)]);
        let config = SpawnConfig {
            spawns: HashMap::from([(2, 1)]),
        };

        assert!(board.sample_spawn(&config).unwrap().is_empty());
    }
}
