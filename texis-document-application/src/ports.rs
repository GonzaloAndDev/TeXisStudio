//! Puertos requeridos por los casos de uso (§4.1, §16.1).
//!
//! Las implementaciones concretas viven en `texis-document-infra`. La aplicación
//! depende de estas interfaces, no de detalles de infraestructura.

use texis_document_domain::ir::DocumentIR;

/// Serializa un `DocumentIR` para depuración y CI (§5.1: "puede serializarse
/// para depuración y CI"). El formato concreto (JSON/YAML) lo decide el adaptador.
pub trait IrSerializer {
    fn serialize(&self, ir: &DocumentIR) -> Result<String, IrSerializeError>;
}

#[derive(Debug)]
pub struct IrSerializeError(pub String);

impl std::fmt::Display for IrSerializeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "fallo al serializar DocumentIR: {}", self.0)
    }
}

impl std::error::Error for IrSerializeError {}
