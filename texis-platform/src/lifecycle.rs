//! Ciclo de vida transaccional de guardado (§1, §2). Compone el resto de la
//! plataforma en una operación de save **atómica con rollback**:
//!
//! ```text
//! journal.begin → snapshot del estado previo → escritura atómica de cada archivo
//!   → actualizar integridad → journal.commit → retención de snapshots
//! ```
//!
//! Si cualquier escritura falla, se **restaura el snapshot previo** y se registra
//! `abort`: nunca se deja el proyecto en un estado intermedio.

use crate::integrity::IntegrityManifest;
use crate::journal::Journal;
use crate::snapshot::{self, SnapshotMeta};
use std::io;
use std::path::Path;

/// Resultado de un guardado transaccional.
#[derive(Debug)]
pub struct SaveOutcome {
    /// Snapshot del estado previo (para rollback manual posterior si se desea).
    pub previous_snapshot: Option<SnapshotMeta>,
    /// Snapshots eliminados por retención.
    pub pruned: usize,
}

/// Guarda un conjunto de archivos de forma transaccional.
///
/// - `writes`: pares (ruta relativa, contenido) a escribir.
/// - `retention`: cuántos snapshots conservar (0 = no limitar aquí).
///
/// El llamador debería sostener un [`crate::lock::ProjectLock`] mientras dura la
/// operación.
pub fn transactional_save(
    root: &Path,
    writes: &[(String, Vec<u8>)],
    retention: usize,
) -> io::Result<SaveOutcome> {
    let journal = Journal::open(root);
    let seq = journal.begin("save")?;

    // Snapshot del estado previo de exactamente los archivos que se van a tocar.
    let touched: Vec<String> = writes.iter().map(|(p, _)| p.clone()).collect();
    let previous_snapshot = match snapshot::create(root, &touched, Some("pre-save")) {
        Ok(meta) => Some(meta),
        Err(e) => {
            let _ = journal.abort(seq, "save", &format!("snapshot previo falló: {e}"));
            return Err(e);
        }
    };

    // Escritura atómica de cada archivo; ante el primer fallo, rollback.
    for (rel, bytes) in writes {
        if let Err(e) = crate::atomic::atomic_write(&root.join(rel), bytes) {
            rollback(root, previous_snapshot.as_ref());
            let _ = journal.abort(seq, "save", &format!("escritura de {rel} falló: {e}"));
            return Err(e);
        }
    }

    // Actualizar el manifiesto de integridad de los archivos escritos.
    if let Ok(manifest) = IntegrityManifest::compute_for(root, &touched) {
        // Fusionar con el manifiesto existente para no perder otras entradas.
        let mut merged = IntegrityManifest::load(root).unwrap_or_default();
        merged.files.extend(manifest.files);
        let _ = merged.save(root);
    }

    journal.commit(seq, "save")?;

    let pruned = if retention > 0 {
        snapshot::prune(root, retention).unwrap_or(0)
    } else {
        0
    };

    Ok(SaveOutcome {
        previous_snapshot,
        pruned,
    })
}

fn rollback(root: &Path, snapshot: Option<&SnapshotMeta>) {
    if let Some(meta) = snapshot {
        let _ = snapshot::restore(root, &meta.id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn successful_save_writes_snapshots_and_commits() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "v1").unwrap();

        let outcome = transactional_save(
            root,
            &[("project.yaml".into(), b"v2".to_vec())],
            5,
        )
        .unwrap();

        assert_eq!(fs::read_to_string(root.join("project.yaml")).unwrap(), "v2");
        assert!(outcome.previous_snapshot.is_some());
        // Journal sin operaciones incompletas y con integridad registrada.
        assert!(Journal::open(root).incomplete().is_empty());
        assert!(IntegrityManifest::load(root).is_some());
    }

    #[test]
    fn failed_write_rolls_back_and_aborts() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "original").unwrap();
        // Un archivo cuyo "directorio padre" es en realidad un archivo → la
        // escritura atómica fallará al intentar create_dir_all.
        fs::write(root.join("blocker"), "soy un archivo").unwrap();

        let result = transactional_save(
            root,
            &[
                ("project.yaml".into(), b"nuevo".to_vec()),
                ("blocker/child.yaml".into(), b"x".to_vec()),
            ],
            5,
        );
        assert!(result.is_err());

        // project.yaml volvió a su contenido original (rollback).
        assert_eq!(
            fs::read_to_string(root.join("project.yaml")).unwrap(),
            "original"
        );
        // La operación quedó como abort (no incompleta).
        assert!(Journal::open(root).incomplete().is_empty());
        let entries = Journal::open(root).entries();
        assert!(entries
            .iter()
            .any(|e| e.status == crate::journal::OpStatus::Abort));
    }
}
