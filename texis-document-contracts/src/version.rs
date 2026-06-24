//! Versionado independiente de contratos (§16.3).
//!
//! Cada contrato (schema de proyecto, perfil, pack, contribución de plugin,
//! DocumentIR, build manifest) se versiona por separado. Un cambio incompatible
//! exige migrador y fixture de compatibilidad.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Versión semántica mínima (mayor.menor). El parche no afecta compatibilidad
/// de contrato, por lo que no se modela aquí.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct ContractVersion {
    pub major: u16,
    pub minor: u16,
}

impl ContractVersion {
    pub const fn new(major: u16, minor: u16) -> Self {
        Self { major, minor }
    }

    /// Dos versiones son compatibles si comparten major.
    pub fn is_compatible_with(&self, other: &ContractVersion) -> bool {
        self.major == other.major
    }
}

impl fmt::Display for ContractVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}", self.major, self.minor)
    }
}

/// Versión del esquema del `DocumentIR`. Tipo distinto para no confundirlo con
/// otras versiones de contrato.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct DocumentSchemaVersion(pub ContractVersion);

impl DocumentSchemaVersion {
    /// Versión actual del DocumentIR producido por este núcleo.
    pub const CURRENT: DocumentSchemaVersion = DocumentSchemaVersion(ContractVersion::new(0, 1));
}

impl Default for DocumentSchemaVersion {
    fn default() -> Self {
        Self::CURRENT
    }
}

impl fmt::Display for DocumentSchemaVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
