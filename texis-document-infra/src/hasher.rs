//! Hasher sha256 para el manifiesto de build reproducible.

use sha2::{Digest, Sha256};
use texis_document_application::ports::ContentHasher;

#[derive(Default)]
pub struct Sha256Hasher;

impl ContentHasher for Sha256Hasher {
    fn hash_hex(&self, bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        let digest = hasher.finalize();
        let mut out = String::with_capacity(digest.len() * 2);
        for b in digest {
            out.push_str(&format!("{b:02x}"));
        }
        out
    }

    fn algorithm(&self) -> &str {
        "sha256"
    }
}
