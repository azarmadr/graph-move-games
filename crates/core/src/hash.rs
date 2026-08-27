//! Deterministic 64-bit FNV-1a hashing for content-addressed IDs.
//!
//! We use FNV-1a instead of std::hash::DefaultHasher because its output is stable
//! across Rust versions and platforms, which is important for import/export
//! consistency.

#[derive(Debug, Clone, Copy)]
pub struct Fnv1a(u64);

impl Fnv1a {
    const OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const PRIME: u64 = 0x100000001b3;

    pub fn new() -> Self {
        Self(Self::OFFSET_BASIS)
    }

    pub fn write(&mut self, bytes: &[u8]) -> &mut Self {
        for &b in bytes {
            self.0 ^= b as u64;
            self.0 = self.0.wrapping_mul(Self::PRIME);
        }
        self
    }

    pub fn write_u8(&mut self, v: u8) -> &mut Self {
        self.write(&[v])
    }

    pub fn write_u32(&mut self, v: u32) -> &mut Self {
        self.write(&v.to_le_bytes())
    }

    pub fn write_u64(&mut self, v: u64) -> &mut Self {
        self.write(&v.to_le_bytes())
    }

    pub fn finish(self) -> u64 {
        self.0
    }
}

pub fn hash_u64(value: u64) -> u64 {
    let mut h = Fnv1a::new();
    h.write_u64(value);
    h.finish()
}
