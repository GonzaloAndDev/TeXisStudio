//! Rutas de estado de la plataforma dentro de un proyecto (`.texisstudio/`).

use std::path::{Path, PathBuf};

/// Directorio de estado interno del proyecto.
pub fn state_dir(project_root: &Path) -> PathBuf {
    project_root.join(".texisstudio")
}

/// Directorio de snapshots incrementales.
pub fn snapshots_dir(project_root: &Path) -> PathBuf {
    state_dir(project_root).join("snapshots")
}

/// Journal de operaciones estructurales.
pub fn journal_path(project_root: &Path) -> PathBuf {
    state_dir(project_root).join("journal.log")
}

/// Manifiesto de integridad (checksums de archivos del proyecto).
pub fn integrity_path(project_root: &Path) -> PathBuf {
    state_dir(project_root).join("integrity.json")
}
