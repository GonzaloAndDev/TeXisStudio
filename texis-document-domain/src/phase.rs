//! Fases canónicas del documento (§5.2).
//!
//! El orden global lo define el modelo, no LaTeX ni los perfiles. Los perfiles
//! configuran elementos *dentro* de las fases, pero no inventan fases.

use serde::{Deserialize, Serialize};

/// Fase canónica. El orden de declaración ES el orden documental global.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentPhase {
    Cover,
    Preliminaries,
    Indexes,
    MainMatter,
    Appendices,
    /// Materia final (p. ej. bibliografía). Los anexos NO son back matter (§7.6).
    BackMatter,
}

impl DocumentPhase {
    /// Todas las fases en orden documental canónico.
    pub const ORDER: [DocumentPhase; 6] = [
        DocumentPhase::Cover,
        DocumentPhase::Preliminaries,
        DocumentPhase::Indexes,
        DocumentPhase::MainMatter,
        DocumentPhase::Appendices,
        DocumentPhase::BackMatter,
    ];

    /// Posición ordinal en la secuencia canónica.
    pub fn ordinal(self) -> usize {
        Self::ORDER.iter().position(|p| *p == self).unwrap()
    }
}
