// Lógica para gestionar qué archivos en build/ son Auto vs Manual.
// FileState se define en model.rs; aquí va la lógica de negocio.

use super::model::{FileState, ProjectModel};

impl ProjectModel {
    /// Devuelve el estado de un archivo .tex en build/.
    /// Si no está en file_states, asume Auto.
    pub fn file_state(&self, rel_path: &str) -> &FileState {
        self.file_states.get(rel_path).unwrap_or(&FileState::Auto)
    }

    /// True si la app puede sobreescribir el archivo (estado Auto).
    pub fn is_auto(&self, rel_path: &str) -> bool {
        self.file_state(rel_path) == &FileState::Auto
    }
}
