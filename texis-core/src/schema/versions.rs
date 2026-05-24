// POLÍTICA de versiones de schema:
// - 0.x: schemas inestables durante desarrollo.
// - 1.0.0: schema congelado. Cambios breaking → versión Major + migrador.
//
// Los proyectos con schema 0.1.0 se migran automáticamente a 1.0.0 al cargar.

pub const CURRENT_SCHEMA_VERSION: &str = "1.0.0";

/// Versiones que se pueden cargar directamente (compatibles forward).
pub const SUPPORTED_SCHEMA_VERSIONS: &[&str] = &["1.0.0"];

/// Versiones que se pueden migrar a la versión actual.
pub const MIGRATABLE_SCHEMA_VERSIONS: &[&str] = &["0.1.0"];

/// Devuelve true si la versión es compatible (no requiere migración).
pub fn is_supported(version: &str) -> bool {
    SUPPORTED_SCHEMA_VERSIONS.contains(&version)
}

/// Devuelve true si la versión puede migrarse automáticamente.
pub fn is_migratable(version: &str) -> bool {
    MIGRATABLE_SCHEMA_VERSIONS.contains(&version)
}

/// Devuelve true si la versión es aceptable (compatible o migrable).
pub fn is_acceptable(version: &str) -> bool {
    is_supported(version) || is_migratable(version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_actual_soportada() {
        assert!(is_supported(CURRENT_SCHEMA_VERSION));
    }

    #[test]
    fn version_1_0_soportada() {
        assert!(is_supported("1.0.0"));
    }

    #[test]
    fn version_0_1_migrable() {
        assert!(is_migratable("0.1.0"));
        assert!(!is_supported("0.1.0")); // requiere migración
        assert!(is_acceptable("0.1.0")); // pero es aceptable
    }

    #[test]
    fn version_futura_no_soportada() {
        assert!(!is_supported("99.0.0"));
        assert!(!is_acceptable("99.0.0"));
    }

    #[test]
    fn version_vacia_no_soportada() {
        assert!(!is_supported(""));
        assert!(!is_acceptable(""));
    }
}
