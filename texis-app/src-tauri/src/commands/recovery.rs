//! Comandos del Recovery Center y protección de datos (Programa Industrial §2).
//!
//! Exponen la plataforma `texis-platform` a la app: escaneo de recuperación,
//! snapshots e integridad. Ninguno sobrescribe el último estado bueno sin que la
//! UI lo solicite explícitamente (`restore_snapshot`).

use std::path::Path;

use texis_platform::recovery::RecoveryReport;
use texis_platform::snapshot::{self, SnapshotMeta};
use texis_platform::{
    scan_recovery, transactional_restore, IntegrityIssue, IntegrityManifest, LockError, ProjectLock,
};

/// Cuántos snapshots conservar tras una restauración (igual que en el guardado).
const RESTORE_SNAPSHOT_RETENTION: usize = 20;

/// Escanea un proyecto y devuelve el reporte de recuperación.
#[tauri::command]
pub fn recovery_scan(project_dir: String) -> RecoveryReport {
    scan_recovery(Path::new(&project_dir))
}

/// Lista los snapshots de plataforma (incrementales, con integridad), del más
/// reciente al más antiguo. Distinto del sistema simple de `project.rs`.
#[tauri::command]
pub fn recovery_list_snapshots(project_dir: String) -> Vec<SnapshotMeta> {
    snapshot::list(Path::new(&project_dir))
}

/// Restaura un snapshot de plataforma por id de forma **transaccional**: toma el
/// lock del proyecto, hace un snapshot del estado actual antes de sobrescribir
/// (para no perder el trabajo más reciente), restaura, recalcula integridad y
/// registra la operación en el journal. Devuelve cuántos archivos se restauraron.
#[tauri::command]
pub fn recovery_restore_snapshot(
    project_dir: String,
    snapshot_id: String,
) -> Result<usize, String> {
    let root = Path::new(&project_dir);

    // El lock se libera automáticamente al salir del scope (Drop).
    let _lock = ProjectLock::acquire(root).map_err(|e| match e {
        LockError::Held(info) => format!(
            "El proyecto está en uso por otra ventana o proceso (pid {} en {}). \
             Ciérrala antes de restaurar.",
            info.pid, info.host
        ),
        other => format!("No se pudo bloquear el proyecto: {other}"),
    })?;

    let outcome = transactional_restore(root, &snapshot_id, RESTORE_SNAPSHOT_RETENTION)
        .map_err(|e| format!("Restauración transaccional falló: {e}"))?;
    Ok(outcome.restored)
}

/// Verifica la integridad del proyecto contra su manifiesto (si existe).
#[tauri::command]
pub fn verify_integrity(project_dir: String) -> Vec<IntegrityIssue> {
    let root = Path::new(&project_dir);
    IntegrityManifest::load(root)
        .map(|m| m.verify(root))
        .unwrap_or_default()
}
