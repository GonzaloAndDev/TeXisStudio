//! Validación por módulo del `DocumentIR` (§6.1).
//!
//! Cada módulo aporta reglas puras que emiten diagnósticos estructurados con
//! códigos estables. `validate_document` agrega todas las validaciones más las
//! invariantes del IR. Los validadores por etapa se añaden conforme avanza el
//! programa (C: cover; D: preliminares/índices; E: cuerpo; F: bibliografía;
//! G: anexos).

pub mod appendices;
pub mod bibliography;
pub mod body;
pub mod cover;
pub mod indexes;
pub mod preliminaries;

use crate::ir::DocumentIR;
use texis_document_contracts::diagnostics::Diagnostics;

/// Ejecuta todas las validaciones de dominio sobre un IR resuelto.
pub fn validate_document(ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();
    d.extend(ir.check_invariants());
    d.extend(cover::validate(&ir.cover));
    d.extend(preliminaries::validate(ir));
    d.extend(indexes::validate(ir));
    d.extend(body::validate(ir));
    d.extend(bibliography::validate(ir));
    d.extend(appendices::validate(ir));
    d
}
