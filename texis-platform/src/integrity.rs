//! Integridad de archivos del proyecto (§2): checksums sha256 para detectar
//! corrupción o modificación externa.

use crate::paths;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::Path;

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for b in digest {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

/// Manifiesto de integridad: ruta relativa → checksum sha256.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct IntegrityManifest {
    pub files: BTreeMap<String, String>,
}

/// Tipo de problema de integridad detectado.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntegrityIssueKind {
    Missing,
    Modified,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IntegrityIssue {
    pub path: String,
    pub kind: IntegrityIssueKind,
}

impl IntegrityManifest {
    /// Calcula el manifiesto para un conjunto de rutas relativas a `root`.
    pub fn compute_for(root: &Path, rel_paths: &[String]) -> io::Result<IntegrityManifest> {
        let mut files = BTreeMap::new();
        for rel in rel_paths {
            let abs = root.join(rel);
            let bytes = fs::read(&abs)?;
            files.insert(rel.clone(), sha256_hex(&bytes));
        }
        Ok(IntegrityManifest { files })
    }

    pub fn save(&self, root: &Path) -> io::Result<()> {
        let json = serde_json::to_string_pretty(self)
            .map_err(io::Error::other)?;
        crate::atomic::atomic_write_str(&paths::integrity_path(root), &json)
    }

    pub fn load(root: &Path) -> Option<IntegrityManifest> {
        let content = fs::read_to_string(paths::integrity_path(root)).ok()?;
        serde_json::from_str(&content).ok()
    }

    /// Verifica el estado actual contra el manifiesto: archivos ausentes o
    /// modificados respecto a su checksum registrado.
    pub fn verify(&self, root: &Path) -> Vec<IntegrityIssue> {
        let mut issues = Vec::new();
        for (rel, expected) in &self.files {
            match fs::read(root.join(rel)) {
                Ok(bytes) => {
                    if &sha256_hex(&bytes) != expected {
                        issues.push(IntegrityIssue {
                            path: rel.clone(),
                            kind: IntegrityIssueKind::Modified,
                        });
                    }
                }
                Err(_) => issues.push(IntegrityIssue {
                    path: rel.clone(),
                    kind: IntegrityIssueKind::Missing,
                }),
            }
        }
        issues
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_modification_and_missing() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.txt"), "uno").unwrap();
        fs::write(root.join("b.txt"), "dos").unwrap();
        let manifest =
            IntegrityManifest::compute_for(root, &["a.txt".into(), "b.txt".into()]).unwrap();
        assert!(manifest.verify(root).is_empty());

        fs::write(root.join("a.txt"), "uno-modificado").unwrap();
        fs::remove_file(root.join("b.txt")).unwrap();
        let issues = manifest.verify(root);
        assert_eq!(issues.len(), 2);
        assert!(issues
            .iter()
            .any(|i| i.path == "a.txt" && i.kind == IntegrityIssueKind::Modified));
        assert!(issues
            .iter()
            .any(|i| i.path == "b.txt" && i.kind == IntegrityIssueKind::Missing));
    }

    #[test]
    fn save_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.txt"), "x").unwrap();
        let m = IntegrityManifest::compute_for(root, &["a.txt".into()]).unwrap();
        m.save(root).unwrap();
        assert_eq!(IntegrityManifest::load(root), Some(m));
    }
}
