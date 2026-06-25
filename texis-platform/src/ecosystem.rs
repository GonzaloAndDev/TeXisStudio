//! Ecosistema: instalación **transaccional** de artefactos (perfiles, idiomas,
//! plugins) y **revocación** (§9). La verificación criptográfica de firma queda
//! para cuando existan claves; aquí se verifica por **hash de contenido** y se
//! activa de forma atómica con rollback. La revocación **advierte**, nunca borra
//! contenido del usuario.

use crate::integrity;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Digest determinista de un directorio: sha256 sobre (ruta relativa + sha256 del
/// archivo) de todos los archivos, en orden. Misma estructura ⇒ mismo digest.
pub fn dir_digest(dir: &Path) -> io::Result<String> {
    let mut rels = Vec::new();
    collect_files(dir, dir, &mut rels)?;
    rels.sort();
    let mut combined = String::new();
    for rel in rels {
        let bytes = fs::read(dir.join(&rel))?;
        combined.push_str(&rel);
        combined.push('\0');
        combined.push_str(&integrity::sha256_hex(&bytes));
        combined.push('\n');
    }
    Ok(integrity::sha256_hex(combined.as_bytes()))
}

fn collect_files(base: &Path, dir: &Path, out: &mut Vec<String>) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(base, &path, out)?;
        } else if let Ok(rel) = path.strip_prefix(base) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

/// Estado de revocación de un artefacto.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RevocationStatus {
    Vulnerable,
    Incompatible,
    Obsolete,
    Withdrawn,
    Replaced,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevocationEntry {
    pub status: RevocationStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// Lista de revocaciones. Clave: `id@version`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevocationList {
    pub entries: BTreeMap<String, RevocationEntry>,
}

impl RevocationList {
    fn key(id: &str, version: &str) -> String {
        format!("{id}@{version}")
    }

    pub fn mark(&mut self, id: &str, version: &str, status: RevocationStatus, note: Option<&str>) {
        self.entries.insert(
            Self::key(id, version),
            RevocationEntry {
                status,
                note: note.map(|s| s.to_string()),
            },
        );
    }

    pub fn status_of(&self, id: &str, version: &str) -> Option<&RevocationEntry> {
        self.entries.get(&Self::key(id, version))
    }

    pub fn save(&self, path: &Path) -> io::Result<()> {
        let json = serde_json::to_string_pretty(self).map_err(io::Error::other)?;
        crate::atomic::atomic_write_str(path, &json)
    }

    pub fn load(path: &Path) -> RevocationList {
        fs::read_to_string(path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    }
}

/// Error de instalación.
#[derive(Debug)]
pub enum InstallError {
    /// El digest del directorio preparado no coincide con el esperado.
    HashMismatch { expected: String, actual: String },
    Io(io::Error),
}

impl std::fmt::Display for InstallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InstallError::HashMismatch { expected, actual } => {
                write!(f, "hash no coincide: esperado {expected}, real {actual}")
            }
            InstallError::Io(e) => write!(f, "error de E/S: {e}"),
        }
    }
}

impl std::error::Error for InstallError {}

/// Instala un artefacto de forma transaccional:
/// verificar hash del `staged` → activar atómicamente en `target` → conservar la
/// versión anterior como rollback (restaurada si la activación falla).
pub fn install_dir(
    staged: &Path,
    target: &Path,
    expected_digest: &str,
) -> Result<(), InstallError> {
    let actual = dir_digest(staged).map_err(InstallError::Io)?;
    if actual != expected_digest {
        return Err(InstallError::HashMismatch {
            expected: expected_digest.to_string(),
            actual,
        });
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(InstallError::Io)?;
    }

    let backup: PathBuf = target.with_extension("previous");
    let had_previous = target.exists();
    if had_previous {
        let _ = fs::remove_dir_all(&backup);
        fs::rename(target, &backup).map_err(InstallError::Io)?;
    }

    match fs::rename(staged, target) {
        Ok(()) => {
            // Activación exitosa; se conserva `backup` como rollback disponible.
            Ok(())
        }
        Err(e) => {
            // Rollback: restaurar la versión anterior si la había.
            if had_previous {
                let _ = fs::rename(&backup, target);
            }
            Err(InstallError::Io(e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(p: &Path, s: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, s).unwrap();
    }

    #[test]
    fn dir_digest_is_deterministic_and_structural() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        write(&a.path().join("x/f.txt"), "hola");
        write(&b.path().join("x/f.txt"), "hola");
        assert_eq!(
            dir_digest(a.path()).unwrap(),
            dir_digest(b.path()).unwrap()
        );
        write(&b.path().join("x/f.txt"), "otro");
        assert_ne!(
            dir_digest(a.path()).unwrap(),
            dir_digest(b.path()).unwrap()
        );
    }

    #[test]
    fn install_verifies_hash_and_activates() {
        let root = tempfile::tempdir().unwrap();
        let staged = root.path().join("staged");
        let target = root.path().join("packs/es");
        write(&staged.join("ui.json"), "{}");
        let digest = dir_digest(&staged).unwrap();

        install_dir(&staged, &target, &digest).unwrap();
        assert!(target.join("ui.json").is_file());
        assert!(!staged.exists()); // movido atómicamente
    }

    #[test]
    fn install_rejects_wrong_hash() {
        let root = tempfile::tempdir().unwrap();
        let staged = root.path().join("staged");
        write(&staged.join("ui.json"), "{}");
        let err = install_dir(&staged, &root.path().join("t"), "deadbeef").unwrap_err();
        assert!(matches!(err, InstallError::HashMismatch { .. }));
    }

    #[test]
    fn install_keeps_previous_as_rollback() {
        let root = tempfile::tempdir().unwrap();
        let target = root.path().join("packs/es");
        write(&target.join("ui.json"), "v1");

        let staged = root.path().join("staged");
        write(&staged.join("ui.json"), "v2");
        let digest = dir_digest(&staged).unwrap();
        install_dir(&staged, &target, &digest).unwrap();

        assert_eq!(fs::read_to_string(target.join("ui.json")).unwrap(), "v2");
        // La versión anterior se conserva para rollback.
        let prev = target.with_extension("previous");
        assert_eq!(fs::read_to_string(prev.join("ui.json")).unwrap(), "v1");
    }

    #[test]
    fn revocation_marks_and_persists() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("revocations.json");
        let mut list = RevocationList::default();
        list.mark("plugin.x", "1.0.0", RevocationStatus::Vulnerable, Some("CVE-x"));
        list.save(&path).unwrap();

        let loaded = RevocationList::load(&path);
        let entry = loaded.status_of("plugin.x", "1.0.0").unwrap();
        assert_eq!(entry.status, RevocationStatus::Vulnerable);
        assert_eq!(entry.note.as_deref(), Some("CVE-x"));
        assert!(loaded.status_of("plugin.x", "2.0.0").is_none());
    }
}
