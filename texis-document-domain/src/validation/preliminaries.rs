//! Validación del módulo de preliminares (§7.2, Etapa D).
//!
//! Sin perfil 2.x todavía (Etapa H decide obligatoriedad institucional), estas
//! reglas son recomendaciones de buenas prácticas: resumen, palabras clave,
//! elementos vacíos y duplicados.

use crate::ir::modules::{PreliminariesDocument, PreliminaryKind};
use crate::ir::DocumentIR;
use texis_document_contracts::diagnostics::{Diagnostic, DiagnosticStage, Diagnostics};
use texis_document_contracts::ids::ModuleId;

pub fn validate(ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();
    let prelim: &PreliminariesDocument = &ir.preliminaries;

    let has_abstract = prelim
        .items
        .iter()
        .any(|i| i.kind == PreliminaryKind::Abstract);
    if !has_abstract {
        d.push(Diagnostic::warning(
            "PRELIM-001",
            ModuleId::Preliminaries,
            DiagnosticStage::Validation,
            "preliminaries.abstract_missing",
        ));
    }

    if ir.metadata.keywords.is_empty() {
        d.push(Diagnostic::warning(
            "PRELIM-002",
            ModuleId::Preliminaries,
            DiagnosticStage::Validation,
            "preliminaries.keywords_missing",
        ));
    }

    // Elementos preliminares sin contenido (salvo los generados/marcador).
    for item in &prelim.items {
        let generated = matches!(
            item.kind,
            PreliminaryKind::Glossary | PreliminaryKind::Nomenclature
        );
        if item.nodes.is_empty() && !generated {
            d.push(
                Diagnostic::warning(
                    "PRELIM-003",
                    ModuleId::Preliminaries,
                    DiagnosticStage::Validation,
                    "preliminaries.item_empty",
                )
                .with_param("section", item.id.as_str())
                .with_param("kind", format!("{:?}", item.kind)),
            );
        }
    }

    // Duplicados de tipos únicos (dos resúmenes, dos dedicatorias).
    for unique in [
        PreliminaryKind::Abstract,
        PreliminaryKind::Dedication,
        PreliminaryKind::OriginalityStatement,
    ] {
        let count = prelim.items.iter().filter(|i| i.kind == unique).count();
        if count > 1 {
            d.push(
                Diagnostic::warning(
                    "PRELIM-004",
                    ModuleId::Preliminaries,
                    DiagnosticStage::Validation,
                    "preliminaries.duplicate_kind",
                )
                .with_param("kind", format!("{unique:?}"))
                .with_param("count", count.to_string()),
            );
        }
    }

    d
}
