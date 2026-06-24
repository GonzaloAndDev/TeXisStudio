//! Validación profesional de bibliografía (§7.5, Etapa F).
//!
//! No basta con que compile: se comprueban citas sin resolver, duplicados,
//! campos obligatorios por tipo, compatibilidad estilo/backend y estilo
//! soportado. Usa el `LabelRegistry` para las citas reales del cuerpo.

use crate::bib_styles;
use crate::ir::DocumentIR;
use crate::labels::LabelRegistry;
use std::collections::BTreeSet;
use texis_document_contracts::diagnostics::{Diagnostic, DiagnosticStage, Diagnostics};
use texis_document_contracts::ids::ModuleId;

pub fn validate(ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();
    let bib = &ir.bibliography;

    if bib.style.is_empty() {
        return d; // sin bibliografía configurada; nada que validar aquí.
    }

    // BIB-005: estilo soportado.
    let spec = bib_styles::lookup(&bib.style);
    if spec.is_none() {
        d.push(
            Diagnostic::warning(
                "BIB-005",
                ModuleId::Bibliography,
                DiagnosticStage::Validation,
                "bibliography.style_unsupported",
            )
            .with_param("style", &bib.style),
        );
    }

    // BIB-004: compatibilidad estilo/backend.
    if let (Some(spec), Some(backend)) = (spec, bib.backend) {
        if !spec.backends.contains(&backend) {
            d.push(
                Diagnostic::error(
                    "BIB-004",
                    ModuleId::Bibliography,
                    DiagnosticStage::Validation,
                    "bibliography.style_backend_incompatible",
                )
                .with_param("style", &bib.style)
                .with_param("backend", format!("{backend:?}").to_lowercase())
                .with_param("expected", format!("{:?}", spec.backends[0]).to_lowercase()),
            );
        }
    }

    // BIB-002: claves duplicadas.
    let mut seen = BTreeSet::new();
    for e in &bib.entries {
        if !seen.insert(e.key.as_str()) {
            d.push(
                Diagnostic::error(
                    "BIB-002",
                    ModuleId::Bibliography,
                    DiagnosticStage::Validation,
                    "bibliography.duplicate_key",
                )
                .with_param("key", &e.key),
            );
        }
    }

    // BIB-003: campos obligatorios por tipo.
    for e in &bib.entries {
        for req in bib_styles::required_fields(&e.entry_type) {
            if e.field(req).map(|v| v.trim().is_empty()).unwrap_or(true) {
                d.push(
                    Diagnostic::warning(
                        "BIB-003",
                        ModuleId::Bibliography,
                        DiagnosticStage::Validation,
                        "bibliography.missing_required_field",
                    )
                    .with_param("key", &e.key)
                    .with_param("type", &e.entry_type)
                    .with_param("field", *req),
                );
            }
        }
    }

    // BIB-001: toda cita del cuerpo debe tener una entrada bibliográfica. Se
    // comprueba SIEMPRE (también con entries vacío): una cita sin entrada es un
    // error bloqueante, nunca se resuelve inventando una fuente.
    let keys: BTreeSet<&str> = bib.entries.iter().map(|e| e.key.as_str()).collect();
    let reg = LabelRegistry::build(ir);
    let mut reported = BTreeSet::new();
    for (cite, owner) in &reg.citations {
        if !keys.contains(cite.as_str()) && reported.insert(cite.clone()) {
            d.push(
                Diagnostic::error(
                    "BIB-001",
                    ModuleId::Bibliography,
                    DiagnosticStage::Validation,
                    "bibliography.unresolved_citation",
                )
                .with_param("key", cite)
                .with_param("node", owner),
            );
        }
    }

    d
}
