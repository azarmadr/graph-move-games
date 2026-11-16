use {
    super::{hash::Fnv1a, Edge},
    crate::{Board, Direction},
    serde::{Deserialize, Serialize},
};

macro_rules! strong_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub struct $name(pub u64);

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }
    };
}

strong_id!(BoardId);
strong_id!(EdgeId);
strong_id!(GameId);

macro_rules! id_string_serde {
    ($name:ident) => {
        impl Serialize for $name {
            fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                serializer.serialize_str(&self.0.to_string())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let s = String::deserialize(deserializer)?;
                s.parse::<u64>().map($name).map_err(|e| {
                    serde::de::Error::custom(format!("invalid {}: {}", stringify!($name), e))
                })
            }
        }
    };
}

id_string_serde!(BoardId);
id_string_serde!(EdgeId);
id_string_serde!(GameId);

/// Hashable canonical representation used for content-addressed IDs.
fn hash_board(board: &Board, hasher: &mut Fnv1a) {
    hasher.write_u8(board.tiles.rows() as u8);
    hasher.write_u8(board.tiles.cols() as u8);
    for (r, row) in board.tiles.iter_rows().enumerate() {
        for (c, &tile) in row.enumerate() {
            if tile == 0 {
                continue;
            }
            hasher.write_u8(r as u8);
            hasher.write_u8(c as u8);
            hasher.write_u32(tile);
        }
    }
}

impl BoardId {
    /// Content-addressed ID: hash of the board content only.
    /// All board states are globally deduplicated by this ID.
    pub fn from_board(board: &Board) -> Self {
        let mut h = Fnv1a::new();
        hash_board(board, &mut h);
        Self(h.finish())
    }
}

impl EdgeId {
    /// Content-addressed ID: hash of (from board ID, to board ID, edge payload).
    pub fn from_content(from: BoardId, to: BoardId, edge: &Edge) -> Self {
        let mut h = Fnv1a::new();
        h.write_u64(from.0);
        h.write_u64(to.0);
        match &edge {
            Edge::Move(direction) => {
                h.write_u8(0);
                h.write_u8(match direction {
                    Direction::Up => 0,
                    Direction::Down => 1,
                    Direction::Left => 2,
                    Direction::Right => 3,
                });
            }
            Edge::Spawn(cells) => {
                h.write_u8(1);
                for cell in cells {
                    h.write_u8(cell.pos.r);
                    h.write_u8(cell.pos.c);
                    h.write_u32(cell.tile);
                }
            }
        }
        Self(h.finish())
    }
}

impl GameId {
    /// Deterministic hash of a creation nonce. Exported alongside the games so
    /// new games after import never collide with imported ones.
    pub fn from_nonce(nonce: u64) -> Self {
        Self(super::hash::hash_u64(nonce))
    }
}
