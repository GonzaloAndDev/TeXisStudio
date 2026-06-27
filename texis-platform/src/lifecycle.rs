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
    transactional_save_with(root, writes, retention, || Ok(()))
}

/// Como [`transactional_save`], pero ejecuta `after_write` **dentro** de la
/// transacción, tras escribir los archivos y antes del commit.
///
/// Sirve para incluir efectos derivados que deben ser consistentes con la
/// escritura (p. ej. regenerar `build/` a partir del modelo recién guardado): si
/// `after_write` falla, se hace **rollback** de los archivos al estado previo y
/// la operación se marca como `abort`, de modo que nunca queda el YAML nuevo con
/// artefactos derivados viejos.
///
/// El llamador debe sostener el [`crate::lock::ProjectLock`] durante toda la
/// llamada (incluido `after_write`).
pub fn transactional_save_with<F>(
    root: &Path,
    writes: &[(String, Vec<u8>)],
    retention: usize,
    after_write: F,
) -> io::Result<SaveOutcome>
where
    F: FnOnce() -> io::Result<()>,
{
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

    // Efecto derivado dentro de la transacción (p. ej. regenerar build/).
    if let Err(e) = after_write() {
        rollback(root, previous_snapshot.as_ref());
        let _ = journal.abort(seq, "save", &format!("post-escritura falló: {e}"));
        return Err(e);
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

/// Resultado de una restauración transaccional.
#[derive(Debug)]
pub struct RestoreOutcome {
    /// Cuántos archivos se restauraron desde el snapshot.
    pub restored: usize,
    /// Snapshot del estado anterior a la restauración (para deshacerla).
    pub pre_restore_snapshot: Option<SnapshotMeta>,
    /// Snapshots eliminados por retención.
    pub pruned: usize,
}

/// Restaura un snapshot de forma **transaccional y reversible**:
///
/// ```text
/// journal.begin → snapshot del estado ACTUAL (pre-restore) → restaurar archivos
///   del snapshot → recalcular integridad → journal.commit → retención
/// ```
///
/// A diferencia de [`snapshot::restore`], esto:
/// - crea un snapshot del estado actual antes de sobrescribir (el trabajo más
///   reciente no se pierde: queda como un snapshot "pre-restore" restaurable);
/// - recalcula el manifiesto de integridad, de modo que `verify_integrity` no
///   reporta el proyecto como modificado justo después de una restauración;
/// - ante fallo, hace rollback al estado pre-restore y marca `abort`.
///
/// El llamador debe sostener el [`crate::lock::ProjectLock`].
pub fn transactional_restore(
    root: &Path,
    snapshot_id: &str,
    retention: usize,
) -> io::Result<RestoreOutcome> {
    let journal = Journal::open(root);
    let seq = journal.begin("restore")?;

    // Qué archivos tocará la restauración: los registrados en el snapshot destino.
    let target = match snapshot::load(root, snapshot_id) {
        Ok(meta) => meta,
        Err(e) => {
            let _ = journal.abort(seq, "restore", &format!("snapshot inexistente: {e}"));
            return Err(e);
        }
    };
    let touched = target.files.clone();

    // Snapshot del estado ACTUAL antes de sobrescribir (deshacer la restauración).
    let pre_restore_snapshot = match snapshot::create(root, &touched, Some("pre-restore")) {
        Ok(meta) => Some(meta),
        Err(e) => {
            let _ = journal.abort(seq, "restore", &format!("snapshot pre-restore falló: {e}"));
            return Err(e);
        }
    };

    // Restaurar; ante fallo, volver al estado pre-restore.
    let restored = match snapshot::restore(root, snapshot_id) {
        Ok(n) => n,
        Err(e) => {
            rollback(root, pre_restore_snapshot.as_ref());
            let _ = journal.abort(seq, "restore", &format!("restauración falló: {e}"));
            return Err(e);
        }
    };

    // Recalcular integridad de los archivos restaurados (estado bueno conocido).
    if let Ok(manifest) = IntegrityManifest::compute_for(root, &touched) {
        let mut merged = IntegrityManifest::load(root).unwrap_or_default();
        merged.files.extend(manifest.files);
        let _ = merged.save(root);
    }

    journal.commit(seq, "restore")?;

    let pruned = if retention > 0 {
        snapshot::prune(root, retention).unwrap_or(0)
    } else {
        0
    };

    Ok(RestoreOutcome {
        restored,
        pre_restore_snapshot,
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

    #[test]
    fn after_write_failure_rolls_back_yaml() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "v1").unwrap();

        // El YAML se escribe bien, pero la regeneración derivada falla → el YAML
        // debe volver a v1 para no quedar inconsistente con build/ viejo.
        let result = transactional_save_with(
            root,
            &[("project.yaml".into(), b"v2".to_vec())],
            5,
            || Err(io::Error::other("regeneración de build falló")),
        );
        assert!(result.is_err());
        assert_eq!(fs::read_to_string(root.join("project.yaml")).unwrap(), "v1");
        assert!(Journal::open(root).incomplete().is_empty());
        assert!(Journal::open(root)
            .entries()
            .iter()
            .any(|e| e.status == crate::journal::OpStatus::Abort));
    }

    #[test]
    fn transactional_restore_preserves_current_state_and_integrity() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "v1").unwrap();

        // Guardar v1 transaccionalmente crea un snapshot "pre-save" de v1.
        let save = transactional_save(root, &[("project.yaml".into(), b"v2".to_vec())], 10).unwrap();
        let v1_snap = save.previous_snapshot.unwrap();
        assert_eq!(fs::read_to_string(root.join("project.yaml")).unwrap(), "v2");

        // Restaurar v1 sobre v2: v2 no debe perderse (queda como pre-restore).
        let outcome = transactional_restore(root, &v1_snap.id, 10).unwrap();
        assert_eq!(outcome.restored, 1);
        assert_eq!(fs::read_to_string(root.join("project.yaml")).unwrap(), "v1");

        // El estado v2 quedó capturado en el snapshot pre-restore (no se perdió).
        let pre = outcome.pre_restore_snapshot.unwrap();
        let recovered = snapshot::load(root, &pre.id).unwrap();
        assert!(recovered.files.contains(&"project.yaml".to_string()));

        // Integridad recalculada: verify no reporta el proyecto como modificado.
        let manifest = IntegrityManifest::load(root).expect("manifiesto tras restore");
        assert!(manifest.verify(root).is_empty());

        // El journal cerró la operación de restore.
        assert!(Journal::open(root).incomplete().is_empty());
    }
}
