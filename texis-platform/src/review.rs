//! Revisión local sin nube (§12 del programa de excelencia). Comparación de
//! versiones (proyecto actual vs. snapshot) y paquetes de revisión para asesores,
//! todo basado en archivos. No hay backend ni colaboración en tiempo real.

use crate::{integrity, paths, snapshot};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::io;
use std::path::Path;

/// Tipo de cambio de un archivo entre dos versiones.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeKind {
    Added,
    Removed,
    Modified,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub kind: ChangeKind,
}

/// Recolecta rutas relativas de archivos bajo `root`, ignorando el estado
/// interno de la plataforma (`.texisstudio/`).
fn current_files(root: &Path) -> Vec<String> {
    let mut out = Vec::new();
    collect(root, root, &mut out);
    out.sort();
    out
}

fn collect(base: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            if entry.file_name() == ".texisstudio" {
                continue;
            }
            collect(base, &path, out);
        } else if let Ok(rel) = path.strip_prefix(base) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
}

fn hash_file(path: &Path) -> Option<String> {
    fs::read(path).ok().map(|b| integrity::sha256_hex(&b))
}

/// Compara el estado actual del proyecto contra un snapshot. Devuelve los cambios
/// (archivos añadidos, eliminados o modificados) ordenados por ruta.
pub fn compare_with_snapshot(root: &Path, snapshot_id: &str) -> io::Result<Vec<FileChange>> {
    let snap_base = paths::snapshots_dir(root).join(snapshot_id).join("files");
    let manifest = paths::snapshots_dir(root)
        .join(snapshot_id)
        .join("manifest.json");
    let content = fs::read_to_string(&manifest)?;
    let meta: snapshot::SnapshotMeta = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    let snapshot_files: BTreeSet<String> = meta.files.iter().cloned().collect();
    let current_files: BTreeSet<String> = current_files(root).into_iter().collect();

    let mut changes = Vec::new();
    let all: BTreeSet<&String> = snapshot_files.union(&current_files).collect();
    for rel in all {
        let in_snapshot = snapshot_files.contains(rel);
        let in_current = current_files.contains(rel);
        match (in_snapshot, in_current) {
            (true, false) => changes.push(FileChange {
                path: rel.clone(),
                kind: ChangeKind::Removed,
            }),
            (false, true) => changes.push(FileChange {
                path: rel.clone(),
                kind: ChangeKind::Added,
            }),
            (true, true) => {
                let old = hash_file(&snap_base.join(rel));
                let new = hash_file(&root.join(rel));
                if old != new {
                    changes.push(FileChange {
                        path: rel.clone(),
                        kind: ChangeKind::Modified,
                    });
                }
            }
            (false, false) => {}
        }
    }
    changes.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(changes)
}

/// Metadatos de un paquete de revisión para asesor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewPackage {
    /// Snapshot que captura el estado enviado a revisión.
    pub snapshot_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub files: Vec<String>,
}

/// Crea un paquete de revisión: un snapshot etiquetado del estado actual más
/// metadatos (autor/nota) que el asesor puede inspeccionar y comparar.
pub fn build_review_package(
    root: &Path,
    files: &[String],
    author: Option<&str>,
    note: Option<&str>,
) -> io::Result<ReviewPackage> {
    let snap = snapshot::create(root, files, Some("review"))?;
    let pkg = ReviewPackage {
        snapshot_id: snap.id.clone(),
        author: author.map(|s| s.to_string()),
        note: note.map(|s| s.to_string()),
        files: snap.files,
    };
    let path = paths::snapshots_dir(root)
        .join(&snap.id)
        .join("review.json");
    let json = serde_json::to_string_pretty(&pkg).map_err(io::Error::other)?;
    crate::atomic::atomic_write_str(&path, &json)?;
    Ok(pkg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_detects_add_remove_modify() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.txt"), "uno").unwrap();
        fs::write(root.join("b.txt"), "dos").unwrap();

        let snap = snapshot::create(root, &["a.txt".into(), "b.txt".into()], None).unwrap();

        // Modificar a, borrar b, añadir c.
        fs::write(root.join("a.txt"), "uno-cambiado").unwrap();
        fs::remove_file(root.join("b.txt")).unwrap();
        fs::write(root.join("c.txt"), "tres").unwrap();

        let changes = compare_with_snapshot(root, &snap.id).unwrap();
        assert!(changes.contains(&FileChange {
            path: "a.txt".into(),
            kind: ChangeKind::Modified
        }));
        assert!(changes.contains(&FileChange {
            path: "b.txt".into(),
            kind: ChangeKind::Removed
        }));
        assert!(changes.contains(&FileChange {
            path: "c.txt".into(),
            kind: ChangeKind::Added
        }));
        // c.txt es nuevo y no estaba en el snapshot.
        assert_eq!(changes.len(), 3);
    }

    #[test]
    fn review_package_captures_state_with_metadata() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "contenido").unwrap();

        let pkg = build_review_package(
            root,
            &["project.yaml".into()],
            Some("Ada"),
            Some("Capítulo 1 listo para revisión"),
        )
        .unwrap();

        assert_eq!(pkg.author.as_deref(), Some("Ada"));
        assert_eq!(pkg.files, vec!["project.yaml".to_string()]);
        // El snapshot del paquete existe y se puede comparar más tarde.
        assert!(compare_with_snapshot(root, &pkg.snapshot_id).unwrap().is_empty());
    }
}
