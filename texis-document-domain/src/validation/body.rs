//! Validación del cuerpo y de las contribuciones de plugins (§7.4, Etapa E).
//!
//! Usa el `LabelRegistry` centralizado para detectar labels duplicados y
//! referencias rotas, y aplica reglas de seguridad sobre LaTeX crudo y plugins.

use crate::ir::body_node::BodyNode;
use crate::ir::DocumentIR;
use crate::labels::LabelRegistry;
use texis_document_contracts::diagnostics::{
    Diagnostic, DiagnosticStage, Diagnostics, DocumentLocation,
};
use texis_document_contracts::ids::ModuleId;

/// Devuelve el primer constructo prohibido encontrado en un artefacto LaTeX
/// producido por un plugin. Es deliberadamente conservador sin rechazar texto
/// inocuo que contenga puntos consecutivos.
pub fn plugin_artifact_violation(latex: &str) -> Option<&'static str> {
    let normalized = latex.to_ascii_lowercase();
    for (needle, label) in [
        ("\\write18", "write18"),
        ("\\openout", "openout"),
        ("\\catcode", "catcode"),
        ("\\documentclass", "documentclass"),
        ("\\begin{document}", "document_environment"),
        ("\\end{document}", "document_environment"),
        ("\\usepackage", "usepackage"),
    ] {
        if normalized.contains(needle) {
            return Some(label);
        }
    }

    for command in ["\\input", "\\include", "\\includegraphics"] {
        let mut remainder = normalized.as_str();
        while let Some(start) = remainder.find(command) {
            let mut arg = remainder[start + command.len()..].trim_start();
            if command == "\\includegraphics" && arg.starts_with('[') {
                let Some(end_options) = arg.find(']') else {
                    break;
                };
                arg = arg[end_options + 1..].trim_start();
            }
            let Some(arg) = arg.strip_prefix('{') else {
                remainder = &remainder[start + command.len()..];
                continue;
            };
            let Some(end) = arg.find('}') else {
                break;
            };
            let path = arg[..end].trim().replace('\\', "/");
            let absolute = path.starts_with('/')
                || path.starts_with("~/")
                || path.as_bytes().get(1) == Some(&b':');
            let traversal = path.split('/').any(|part| part == "..");
            if absolute || traversal {
                return Some("unsafe_path");
            }
            remainder = &arg[end + 1..];
        }
    }
    None
}

pub fn validate(ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();
    let reg = LabelRegistry::build(ir);

    // BODY-001: labels duplicados (bloqueante; rompen referencias).
    for (label, origins) in reg.duplicates() {
        d.push(
            Diagnostic::error(
                "BODY-001",
                ModuleId::Body,
                DiagnosticStage::Validation,
                "body.duplicate_label",
            )
            .with_param("label", label)
            .with_param("count", origins.len().to_string()),
        );
    }

    // BODY-002: referencias cruzadas a labels inexistentes.
    for (target, owner) in reg.dangling_references() {
        d.push(
            Diagnostic::error(
                "BODY-002",
                ModuleId::Body,
                DiagnosticStage::Validation,
                "body.dangling_reference",
            )
            .with_param("target", target)
            .with_location(DocumentLocation::module(ModuleId::Body).with_path(owner.clone())),
        );
    }

    // Reglas por nodo.
    for node in ir.all_body_nodes() {
        match node {
            BodyNode::TrustedRawLatex(r) if !r.user_confirmed => {
                // BODY-010: LaTeX crudo sin confirmación explícita (§15 seguridad).
                d.push(
                    Diagnostic::warning(
                        "BODY-010",
                        ModuleId::Body,
                        DiagnosticStage::Validation,
                        "body.raw_latex_unconfirmed",
                    )
                    .with_param("node", r.id.as_str()),
                );
            }
            BodyNode::Figure(f) if f.caption.text.trim().is_empty() => {
                d.push(
                    Diagnostic::warning(
                        "BODY-011",
                        ModuleId::Body,
                        DiagnosticStage::Validation,
                        "body.figure_caption_empty",
                    )
                    .with_param("node", f.id.as_str()),
                );
            }
            BodyNode::PluginContribution(p) => {
                // PLUGIN-001: artefacto vacío.
                if p.artifact_latex.trim().is_empty() {
                    d.push(
                        Diagnostic::error(
                            "PLUGIN-001",
                            ModuleId::Body,
                            DiagnosticStage::Validation,
                            "plugin.artifact_empty",
                        )
                        .with_param("plugin", &p.plugin_id),
                    );
                }
                // PLUGIN-002: sin fuente editable ⇒ no hay round-trip.
                if p.editable_source.trim().is_empty() {
                    d.push(
                        Diagnostic::warning(
                            "PLUGIN-002",
                            ModuleId::Body,
                            DiagnosticStage::Validation,
                            "plugin.no_editable_source",
                        )
                        .with_param("plugin", &p.plugin_id),
                    );
                }
                // PLUGIN-003: el artefacto declara \usepackage (debe declararse
                // como requisito, no inyectar paquetes directamente, §9.3).
                // Bloqueante: no se permite que un plugin toque el preámbulo.
                if p.artifact_latex
                    .to_ascii_lowercase()
                    .contains("\\usepackage")
                {
                    d.push(
                        Diagnostic::error(
                            "PLUGIN-003",
                            ModuleId::Body,
                            DiagnosticStage::Validation,
                            "plugin.artifact_injects_packages",
                        )
                        .with_param("plugin", &p.plugin_id),
                    );
                }
                // PLUGIN-004: constructos peligrosos (shell-escape, escritura de
                // archivos, inclusión de rutas, traversal). Frontera de seguridad
                // (§15): no se inserta LaTeX de plugin sin sanear.
                if let Some(bad) = plugin_artifact_violation(&p.artifact_latex) {
                    if bad != "usepackage" {
                        d.push(
                            Diagnostic::error(
                                "PLUGIN-004",
                                ModuleId::Body,
                                DiagnosticStage::Validation,
                                "plugin.artifact_unsafe_construct",
                            )
                            .with_param("plugin", &p.plugin_id)
                            .with_param("construct", bad),
                        );
                    }
                }
            }
            _ => {}
        }
    }

    d
}
