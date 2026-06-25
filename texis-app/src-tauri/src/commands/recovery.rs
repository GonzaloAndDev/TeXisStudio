//! Comandos del Recovery Center y protección de datos (Programa Industrial §2).
//!
//! Exponen la plataforma `texis-platform` a la app: escaneo de recuperación,
//! snapshots e integridad. Ninguno sobrescribe el último estado bueno sin que la
//! UI lo solicite explícitamente (`restore_snapshot`).

use std::path::Path;

use texis_platform::recovery::RecoveryReport;
use texis_platform::snapshot::{self, SnapshotMeta};
use texis_platform::{scan_recovery, IntegrityIssue, IntegrityManifest};

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

/// Restaura un snapshot de plataforma por id. Devuelve cuántos archivos se
/// restauraron.
#[tauri::command]
pub fn recovery_restore_snapshot(
    project_dir: String,
    snapshot_id: String,
) -> Result<usize, String> {
    snapshot::restore(Path::new(&project_dir), &snapshot_id).map_err(|e| e.to_string())
}

/// Verifica la integridad del proyecto contra su manifiesto (si existe).
#[tauri::command]
pub fn verify_integrity(project_dir: String) -> Vec<IntegrityIssue> {
    let root = Path::new(&project_dir);
    IntegrityManifest::load(root)
        .map(|m| m.verify(root))
        .unwrap_or_default()
}
