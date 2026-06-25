//! Recovery Center — backend (§2). Escanea un proyecto y **reporta** problemas
//! recuperables sin sobrescribir nunca el último estado bueno. La experiencia de
//! usuario (UI) consume este reporte para ofrecer acciones.

use crate::integrity::{IntegrityIssue, IntegrityManifest};
use crate::journal::{Journal, JournalEntry};
use crate::lock::{LockInfo, ProjectLock};
use crate::snapshot;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RecoveryReport {
    /// Operaciones interrumpidas (Begin sin Commit/Abort) — posible save/migración a medias.
    pub incomplete_operations: Vec<JournalEntry>,
    /// Temporales residuales (.tmp) o respaldos (.bak) de escrituras no finalizadas.
    pub leftover_temporaries: Vec<String>,
    /// Problemas de integridad respecto al manifiesto (si existe).
    pub integrity_issues: Vec<IntegrityIssue>,
    /// Número de snapshots disponibles para restaurar.
    pub snapshots_available: usize,
    /// Titular del lock, si el proyecto está bloqueado (informativo).
    pub lock_holder: Option<LockInfo>,
}

impl RecoveryReport {
    /// `true` si no hay nada que recuperar (el lock por sí solo no es un problema).
    pub fn healthy(&self) -> bool {
        self.incomplete_operations.is_empty()
            && self.leftover_temporaries.is_empty()
            && self.integrity_issues.is_empty()
    }
}

/// Escanea el proyecto y produce el reporte de recuperación.
pub fn scan(root: &Path) -> RecoveryReport {
    let incomplete_operations = Journal::open(root).incomplete();

    let mut leftover_temporaries = Vec::new();
    collect_leftovers(root, root, &mut leftover_temporaries);
    leftover_temporaries.sort();

    let integrity_issues = IntegrityManifest::load(root)
        .map(|m| m.verify(root))
        .unwrap_or_default();

    RecoveryReport {
        incomplete_operations,
        leftover_temporaries,
        integrity_issues,
        snapshots_available: snapshot::list(root).len(),
        lock_holder: ProjectLock::current(root),
    }
}

/// Recorre el proyecto buscando temporales/respaldos, sin entrar en el estado
/// interno (`.texisstudio/`).
fn collect_leftovers(root: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if name == ".texisstudio" {
                continue; // estado interno, no es residuo del usuario
            }
            collect_leftovers(root, &path, out);
        } else if name.contains(".tmp") || name.ends_with(".bak") {
            if let Ok(rel) = path.strip_prefix(root) {
                out.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_project_is_healthy() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("project.yaml"), "ok").unwrap();
        let report = scan(dir.path());
        assert!(report.healthy());
        assert_eq!(report.snapshots_available, 0);
    }

    #[test]
    fn detects_incomplete_op_leftover_and_integrity() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "v1").unwrap();

        // Operación interrumpida.
        let _seq = Journal::open(root).begin("save").unwrap();
        // Temporal residual de un save no finalizado.
        fs::write(root.join("project.yaml.bak"), "v0").unwrap();
        // Integridad: manifiesto que luego no cuadra.
        let m = IntegrityManifest::compute_for(root, &["project.yaml".into()]).unwrap();
        m.save(root).unwrap();
        fs::write(root.join("project.yaml"), "v2-corrupto").unwrap();

        let report = scan(root);
        assert!(!report.healthy());
        assert_eq!(report.incomplete_operations.len(), 1);
        assert!(report
            .leftover_temporaries
            .iter()
            .any(|p| p == "project.yaml.bak"));
        assert!(!report.integrity_issues.is_empty());
    }

    #[test]
    fn snapshots_are_counted_and_not_flagged_as_leftovers() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "v1").unwrap();
        snapshot::create(root, &["project.yaml".into()], None).unwrap();
        let report = scan(root);
        assert_eq!(report.snapshots_available, 1);
        // El contenido interno de snapshots no se reporta como residuo.
        assert!(report.leftover_temporaries.is_empty());
        assert!(report.healthy());
    }
}
