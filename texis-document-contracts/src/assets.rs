//! Referencias a assets (logos, escudos, imágenes, PDFs externos).
//!
//! Invariante (§5.1): el IR no contiene rutas absolutas. Toda ruta es relativa
//! a la raíz del proyecto. Los assets externos llevan provenance y licencia
//! (§7.1, §15).

use crate::ids::AssetId;
use serde::{Deserialize, Serialize};

/// Rol semántico del asset dentro del documento.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetRole {
    InstitutionLogo,
    InstitutionSeal,
    Figure,
    ExternalPdf,
    Other,
}

/// Referencia a un asset. La existencia y el hash se verifican en infraestructura;
/// el dominio solo declara la intención y las restricciones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetRef {
    pub id: AssetId,
    pub role: AssetRole,
    /// Ruta SIEMPRE relativa a la raíz del proyecto. Nunca absoluta.
    pub relative_path: String,
    /// Hash de contenido (sha256 hex) cuando se conoce. Lo rellena infraestructura.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
    /// Origen declarado del asset (institucional, usuario, externo con URL/licencia).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Licencia declarada para assets externos.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
}

impl AssetRef {
    pub fn new(id: AssetId, role: AssetRole, relative_path: impl Into<String>) -> Self {
        Self {
            id,
            role,
            relative_path: relative_path.into(),
            content_hash: None,
            source: None,
            license: None,
        }
    }

    /// `true` si la ruta es relativa (invariante del IR).
    pub fn path_is_relative(&self) -> bool {
        !is_absolute_path(&self.relative_path)
    }
}

/// Heurística independiente de plataforma: detecta rutas absolutas Unix (`/...`)
/// y Windows (`C:\...`, `\\server`). El dominio no usa `std::path`.
pub fn is_absolute_path(path: &str) -> bool {
    let p = path.trim();
    if p.starts_with('/') || p.starts_with('\\') {
        return true;
    }
    // Unidad de Windows: una letra seguida de ':' y separador.
    let bytes = p.as_bytes();
    if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        return bytes[2] == b'/' || bytes[2] == b'\\';
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_absolute_paths() {
        assert!(is_absolute_path("/Users/x/logo.png"));
        assert!(is_absolute_path("C:\\imgs\\logo.png"));
        assert!(is_absolute_path("\\\\server\\share"));
        assert!(!is_absolute_path("assets/logo.png"));
        assert!(!is_absolute_path("./logo.png"));
    }
}
