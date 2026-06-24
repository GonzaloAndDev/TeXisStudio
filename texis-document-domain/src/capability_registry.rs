//! Registro y resolución de capacidades (§8.3, plan 2 "Capacidades").
//!
//! Calcula las capacidades **requeridas** por un `DocumentIR`, las contrasta con
//! las que un backend **declara**, y reporta lo no soportado como diagnósticos
//! (no se oculta ni se simula). Detecta además incompatibilidades conocidas y
//! propone degradaciones.

use crate::backend::BackendCapabilities;
use crate::ir::body_node::BodyNode;
use crate::ir::DocumentIR;
use texis_document_contracts::capabilities::{Capability, CapabilitySet};
use texis_document_contracts::diagnostics::{
    Diagnostic, DiagnosticStage, Diagnostics, Remediation,
};
use texis_document_contracts::ids::ModuleId;

/// Calcula las capacidades requeridas por el documento.
pub fn required_capabilities(ir: &DocumentIR) -> CapabilitySet {
    let mut caps = CapabilitySet::new();
    let add = |c: &str, caps: &mut CapabilitySet| caps.insert(Capability::new(c));

    add(&format!("engine.{}", ir.profile.engine), &mut caps);
    add("render.cover", &mut caps);
    if !ir.preliminaries.items.is_empty() {
        add("render.preliminaries", &mut caps);
    }
    if ir.indexes.lists.iter().any(|l| l.enabled) {
        add("render.indexes", &mut caps);
    }
    if !ir.body.sections.is_empty() {
        add("render.body", &mut caps);
    }
    if !ir.appendices.appendices.is_empty() {
        add("render.appendices", &mut caps);
    }
    if !ir.bibliography.style.is_empty() {
        add("render.bibliography.biblatex", &mut caps);
    }
    // Fuentes Unicode personalizadas requieren fontspec (xelatex/lualatex).
    if ir.profile.typography.main_font.is_some() {
        add("font.custom", &mut caps);
    }
    if ir
        .all_body_nodes()
        .iter()
        .any(|n| matches!(n, BodyNode::PluginContribution(_)))
    {
        add("render.plugin_artifact", &mut caps);
    }
    caps
}

/// Resultado de la resolución de capacidades.
#[derive(Debug, Clone)]
pub struct CapabilityResolution {
    pub required: CapabilitySet,
    pub satisfied: Vec<Capability>,
    pub missing: Vec<Capability>,
    pub diagnostics: Diagnostics,
    /// `true` si el backend puede cumplir fielmente todo lo requerido.
    pub fully_satisfiable: bool,
}

/// Resuelve las capacidades requeridas por el IR contra las del backend.
pub fn resolve(ir: &DocumentIR, backend: &BackendCapabilities) -> CapabilityResolution {
    let required = required_capabilities(ir);
    let available = &backend.capabilities;

    let mut satisfied = Vec::new();
    let mut missing = Vec::new();
    let mut diagnostics = Diagnostics::new();

    for cap in required.iter() {
        if available.contains(cap) {
            satisfied.push(cap.clone());
        } else {
            missing.push(cap.clone());
            diagnostics.push(
                Diagnostic::error(
                    "CAP-001",
                    ModuleId::Assembler,
                    DiagnosticStage::Planning,
                    "capability.unsupported",
                )
                .with_param("capability", cap.as_str())
                .with_param("backend", &backend.backend_id)
                .with_remediation(Remediation::new("capability.offer_alternative")),
            );
        }
    }

    // Incompatibilidad conocida: pdflatex no soporta fuentes Unicode personalizadas.
    if ir.profile.engine == "pdflatex" && ir.profile.typography.main_font.is_some() {
        diagnostics.push(
            Diagnostic::warning(
                "CAP-010",
                ModuleId::Assembler,
                DiagnosticStage::Planning,
                "capability.font_engine_incompatible",
            )
            .with_param("engine", "pdflatex")
            .with_remediation(Remediation::new("capability.switch_to_xelatex"))
            .with_remediation(Remediation::new("capability.use_default_font")),
        );
    }

    let fully_satisfiable = missing.is_empty();
    CapabilityResolution {
        required,
        satisfied,
        missing,
        diagnostics,
        fully_satisfiable,
    }
}
