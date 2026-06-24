//! Motor de políticas institucionales (§ Políticas Institucionales, Etapa H).
//!
//! Evalúa una `ProfilePolicy` declarativa contra el `DocumentIR`. Los requisitos
//! incumplidos producen errores bloqueantes; las recomendaciones, advertencias.
//! Separa estrictamente requisito de recomendación (el contrato del perfil ya los
//! tiene en campos distintos).

use crate::ir::modules::PreliminaryKind;
use crate::ir::DocumentIR;
use texis_document_contracts::diagnostics::{Diagnostic, DiagnosticStage, Diagnostics, Severity};
use texis_document_contracts::ids::ModuleId;
use texis_document_contracts::profile::{ProfilePolicy, RequiredPreliminary};

fn map_prelim(r: RequiredPreliminary) -> Option<PreliminaryKind> {
    Some(match r {
        RequiredPreliminary::Dedication => PreliminaryKind::Dedication,
        RequiredPreliminary::Acknowledgements => PreliminaryKind::Acknowledgements,
        RequiredPreliminary::OriginalityStatement => PreliminaryKind::OriginalityStatement,
        RequiredPreliminary::Authorization => PreliminaryKind::Authorization,
        RequiredPreliminary::Abstract => PreliminaryKind::Abstract,
        RequiredPreliminary::Epigraph => PreliminaryKind::Epigraph,
        RequiredPreliminary::Nomenclature => PreliminaryKind::Nomenclature,
        RequiredPreliminary::Glossary => PreliminaryKind::Glossary,
        // Keywords no es un preliminar con nodos; se valida vía metadata.
        RequiredPreliminary::Keywords => return None,
    })
}

fn has_preliminary(ir: &DocumentIR, kind: PreliminaryKind) -> bool {
    ir.preliminaries.items.iter().any(|i| i.kind == kind)
}

fn diag(code: &str, module: ModuleId, sev: Severity, key: &str) -> Diagnostic {
    Diagnostic::new(code, module, sev, DiagnosticStage::Validation, key)
}

/// Evalúa la política del perfil contra el IR.
pub fn evaluate(policy: &ProfilePolicy, ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();

    // Preliminares obligatorios (error) y recomendados (warning).
    for (list, sev, code) in [
        (
            &policy.required_preliminaries,
            Severity::Error,
            "POLICY-001",
        ),
        (
            &policy.recommended_preliminaries,
            Severity::Warning,
            "POLICY-002",
        ),
    ] {
        for req in list {
            let satisfied = match req {
                RequiredPreliminary::Keywords => !ir.metadata.keywords.is_empty(),
                other => map_prelim(*other)
                    .map(|k| has_preliminary(ir, k))
                    .unwrap_or(true),
            };
            if !satisfied {
                d.push(
                    diag(
                        code,
                        ModuleId::Preliminaries,
                        sev,
                        "policy.preliminary_required",
                    )
                    .with_param("element", format!("{req:?}")),
                );
            }
        }
    }

    if policy.require_keywords && ir.metadata.keywords.is_empty() {
        d.push(diag(
            "POLICY-003",
            ModuleId::Preliminaries,
            Severity::Error,
            "policy.keywords_required",
        ));
    }

    // Portada.
    let c = &policy.cover;
    if c.require_logo && ir.cover.institution.logo.is_none() {
        d.push(diag(
            "POLICY-010",
            ModuleId::Cover,
            Severity::Error,
            "policy.cover_logo_required",
        ));
    }
    if c.require_signatures && ir.cover.signatures.is_empty() {
        d.push(diag(
            "POLICY-011",
            ModuleId::Cover,
            Severity::Error,
            "policy.cover_signatures_required",
        ));
    }
    if c.require_orcid
        && !ir
            .cover
            .authors
            .first()
            .map(|a| a.orcid.is_some())
            .unwrap_or(false)
    {
        d.push(diag(
            "POLICY-012",
            ModuleId::Cover,
            Severity::Error,
            "policy.cover_orcid_required",
        ));
    }
    if let Some(max) = c.max_title_chars {
        if ir.cover.title.chars().count() > max {
            d.push(
                diag(
                    "POLICY-013",
                    ModuleId::Cover,
                    Severity::Error,
                    "policy.cover_title_too_long",
                )
                .with_param("max", max.to_string())
                .with_param("len", ir.cover.title.chars().count().to_string()),
            );
        }
    }

    // Bibliografía.
    let b = &policy.bibliography;
    if !b.allowed_styles.is_empty()
        && !ir.bibliography.style.is_empty()
        && !b.allowed_styles.iter().any(|s| s == &ir.bibliography.style)
    {
        d.push(
            diag(
                "POLICY-020",
                ModuleId::Bibliography,
                Severity::Error,
                "policy.bib_style_not_allowed",
            )
            .with_param("style", &ir.bibliography.style)
            .with_param("allowed", b.allowed_styles.join(",")),
        );
    }
    if let Some(req_backend) = &b.required_backend {
        let actual = ir
            .bibliography
            .backend
            .map(|x| format!("{x:?}").to_lowercase());
        if actual.as_deref() != Some(req_backend.as_str()) {
            d.push(
                diag(
                    "POLICY-021",
                    ModuleId::Bibliography,
                    Severity::Error,
                    "policy.bib_backend_required",
                )
                .with_param("required", req_backend)
                .with_param("actual", actual.unwrap_or_else(|| "none".into())),
            );
        }
    }

    // Índices.
    let idx = &policy.indexes;
    if idx.require_toc {
        let has_toc =
            ir.indexes.lists.iter().any(|l| {
                matches!(l.kind, crate::ir::modules::IndexKind::TableOfContents) && l.enabled
            });
        if !has_toc {
            d.push(diag(
                "POLICY-030",
                ModuleId::Indexes,
                Severity::Error,
                "policy.toc_required",
            ));
        }
    }
    if let Some(maxd) = idx.max_toc_depth {
        for l in &ir.indexes.lists {
            if matches!(l.kind, crate::ir::modules::IndexKind::TableOfContents) {
                if let Some(depth) = l.depth {
                    if depth > maxd {
                        d.push(
                            diag(
                                "POLICY-031",
                                ModuleId::Indexes,
                                Severity::Error,
                                "policy.toc_depth_exceeded",
                            )
                            .with_param("max", maxd.to_string())
                            .with_param("depth", depth.to_string()),
                        );
                    }
                }
            }
        }
    }

    // Entrega.
    let del = &policy.delivery;
    if del.require_pdf_metadata
        && (ir.metadata.title.trim().is_empty() || ir.cover.authors.is_empty())
    {
        d.push(diag(
            "POLICY-040",
            ModuleId::Assembler,
            Severity::Error,
            "policy.pdf_metadata_required",
        ));
    }
    if !del.required_abstract_languages.is_empty()
        && !has_preliminary(ir, PreliminaryKind::Abstract)
    {
        d.push(
            diag(
                "POLICY-041",
                ModuleId::Preliminaries,
                Severity::Error,
                "policy.abstract_languages_required",
            )
            .with_param("languages", del.required_abstract_languages.join(",")),
        );
    }

    d
}
