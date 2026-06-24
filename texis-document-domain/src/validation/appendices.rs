//! Validación del módulo de anexos (§7.6, Etapa G).
//!
//! Garantiza que no haya prefijos/labels duplicados entre anexos, ni anexos
//! vacíos, y recomienda labels para referenciarlos. Los anexos son una fase
//! canónica propia (nunca back matter): el orden lo garantiza el `PlanBuilder`.

use crate::ir::DocumentIR;
use std::collections::BTreeMap;
use texis_document_contracts::diagnostics::{
    Diagnostic, DiagnosticStage, Diagnostics, DocumentLocation,
};
use texis_document_contracts::ids::ModuleId;

pub fn validate(ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();
    let appendices = &ir.appendices.appendices;

    // APX-003: labels de anexo duplicados (prefijos/numeración rota).
    let mut label_owners: BTreeMap<&str, usize> = BTreeMap::new();
    for a in appendices {
        if let Some(l) = &a.label {
            *label_owners.entry(l.as_str()).or_default() += 1;
        }
    }
    for (label, count) in label_owners {
        if count > 1 {
            d.push(
                Diagnostic::error(
                    "APX-003",
                    ModuleId::Appendices,
                    DiagnosticStage::Validation,
                    "appendices.duplicate_label",
                )
                .with_param("label", label)
                .with_param("count", count.to_string()),
            );
        }
    }

    for a in appendices {
        let loc = || DocumentLocation::module(ModuleId::Appendices).with_path(a.id.as_str());

        // APX-001: anexo sin título.
        if a.title.as_ref().map(|t| t.trim().is_empty()).unwrap_or(true) {
            d.push(
                Diagnostic::warning(
                    "APX-001",
                    ModuleId::Appendices,
                    DiagnosticStage::Validation,
                    "appendices.title_missing",
                )
                .with_location(loc()),
            );
        }

        // APX-002: anexo vacío (sin nodos ni subsecciones).
        if a.nodes.is_empty() && a.children.is_empty() {
            d.push(
                Diagnostic::warning(
                    "APX-002",
                    ModuleId::Appendices,
                    DiagnosticStage::Validation,
                    "appendices.empty",
                )
                .with_location(loc()),
            );
        }

        // APX-004: anexo sin label (recomendado para referencias cruzadas).
        if a.label.as_ref().map(|l| l.trim().is_empty()).unwrap_or(true) {
            d.push(
                Diagnostic::warning(
                    "APX-004",
                    ModuleId::Appendices,
                    DiagnosticStage::Validation,
                    "appendices.label_recommended",
                )
                .with_location(loc()),
            );
        }
    }

    d
}
