// POLÍTICA:
// - Durante 0.x: schemas inestables, pueden cambiar sin migradores.
// - Antes de Release 1.0: schema 1.0.0 se congela definitivamente.
// - Desde 1.0.0: cambios breaking = versión Major + migrador.

pub const CURRENT_SCHEMA_VERSION: &str = "0.1.0";

pub const SUPPORTED_SCHEMA_VERSIONS: &[&str] = &["0.1.0"];

pub fn is_supported(version: &str) -> bool {
    SUPPORTED_SCHEMA_VERSIONS.contains(&version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_actual_soportada() {
        assert!(is_supported(CURRENT_SCHEMA_VERSION));
    }

    #[test]
    fn version_futura_no_soportada() {
        assert!(!is_supported("99.0.0"));
    }

    #[test]
    fn version_vacia_no_soportada() {
        assert!(!is_supported(""));
    }

    #[test]
    fn version_1_no_soportada_todavia() {
        assert!(!is_supported("1.0.0"));
    }
}
