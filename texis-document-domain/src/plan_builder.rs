//! Construcción del Plan de Documento Inmutable a partir del `DocumentIR` (§8).
//!
//! Lógica pura y **determinista**: con el mismo IR produce exactamente el mismo
//! `DocumentPlan` (paquetes y assets ordenados). Es la única autoridad que
//! decide el orden global de fases. No escribe en disco ni invoca compiladores.

use crate::ir::body_node::BodyNode;
use crate::ir::resources::PackageRequirement;
use crate::ir::DocumentIR;
use crate::phase::DocumentPhase;
use crate::plan::*;
use texis_document_contracts::diagnostics::{Diagnostic, DiagnosticStage};
use texis_document_contracts::ids::ModuleId;

/// Ruta relativa del artefacto principal de cada fase.
fn phase_artifact(phase: DocumentPhase) -> &'static str {
    match phase {
        DocumentPhase::Cover => "sections/cover.tex",
        DocumentPhase::Preliminaries => "sections/preliminaries.tex",
        DocumentPhase::Indexes => "sections/indexes.tex",
        DocumentPhase::MainMatter => "sections/body.tex",
        DocumentPhase::Appendices => "sections/appendices.tex",
        DocumentPhase::BackMatter => "sections/bibliography.tex",
    }
}

/// Constructor del plan. Sin estado: una función disfrazada de tipo para
/// facilitar futuras opciones de planificación.
#[derive(Default)]
pub struct PlanBuilder;

impl PlanBuilder {
    pub fn new() -> Self {
        Self
    }

    pub fn build(&self, ir: &DocumentIR) -> DocumentPlan {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();

        let active = self.active_phases(ir);

        // Plan de fases + grafo de archivos.
        let mut phases = Vec::new();
        let mut files = FileGraph::default();
        files.files.push(PlannedFile {
            relative_path: "preamble.tex".to_string(),
            ownership: FileOwnership::Generated,
        });
        for phase in &active {
            let artifact = phase_artifact(*phase).to_string();
            phases.push(PhasePlan {
                phase: *phase,
                artifacts: vec![artifact.clone()],
            });
            files.files.push(PlannedFile {
                relative_path: artifact,
                ownership: FileOwnership::Generated,
            });
        }
        files.files.push(PlannedFile {
            relative_path: "main.tex".to_string(),
            ownership: FileOwnership::Generated,
        });

        let packages = self.resolve_packages(ir);
        let assets = AssetPlan {
            assets: ir.resources.assets.clone(),
        };
        let toolchain = ToolchainPlan {
            engine: ir.profile.engine.clone(),
            compiler: ir.profile.compiler.clone(),
            bibliography_backend: ir.bibliography.backend.map(|b| format!("{b:?}").to_lowercase()),
        };
        let expectations = self.expectations(ir, &active, &mut diagnostics);

        DocumentPlan {
            phases,
            files,
            packages,
            assets,
            toolchain,
            expectations,
            capabilities: Vec::new(),
            diagnostics,
        }
    }

    /// Fases con contenido real, en orden canónico (§5.2).
    fn active_phases(&self, ir: &DocumentIR) -> Vec<DocumentPhase> {
        let mut active = Vec::new();
        for phase in DocumentPhase::ORDER {
            let has_content = match phase {
                DocumentPhase::Cover => true, // siempre hay portada
                DocumentPhase::Preliminaries => !ir.preliminaries.items.is_empty(),
                DocumentPhase::Indexes => ir.indexes.lists.iter().any(|l| l.enabled),
                DocumentPhase::MainMatter => !ir.body.sections.is_empty(),
                DocumentPhase::Appendices => !ir.appendices.appendices.is_empty(),
                DocumentPhase::BackMatter => {
                    !ir.bibliography.style.is_empty() || !ir.back_matter.sections.is_empty()
                }
            };
            if has_content {
                active.push(phase);
            }
        }
        active
    }

    /// Resuelve y deduplica los paquetes requeridos (determinista: ordenado).
    fn resolve_packages(&self, ir: &DocumentIR) -> PackagePlan {
        let mut packages: Vec<PackageRequirement> = Vec::new();
        let add = |req: PackageRequirement, packages: &mut Vec<PackageRequirement>| {
            if !packages.iter().any(|p| p.name == req.name) {
                packages.push(req);
            }
        };

        // Paquetes derivados del contenido del IR.
        for p in &ir.resources.packages {
            add(p.clone(), &mut packages);
        }

        // Baseline según motor: XeLaTeX/LuaLaTeX usan fontspec.
        if matches!(ir.profile.engine.as_str(), "xelatex" | "lualatex") {
            add(PackageRequirement::new("fontspec"), &mut packages);
        }
        add(PackageRequirement::new("geometry"), &mut packages);

        // Paquetes derivados de los nodos del cuerpo/anexos.
        let nodes = ir.all_body_nodes();
        if nodes.iter().any(|n| matches!(n, BodyNode::Figure(_))) {
            add(PackageRequirement::new("graphicx"), &mut packages);
        }
        if nodes.iter().any(|n| matches!(n, BodyNode::Equation(_) | BodyNode::Theorem(_))) {
            add(PackageRequirement::new("amsmath"), &mut packages);
            add(PackageRequirement::new("amsthm"), &mut packages);
        }
        if nodes.iter().any(|n| matches!(n, BodyNode::CodeListing(_))) {
            add(PackageRequirement::new("listings"), &mut packages);
        }
        if nodes.iter().any(|n| matches!(n, BodyNode::Algorithm(_))) {
            add(PackageRequirement::new("algorithm2e"), &mut packages);
        }
        if nodes.iter().any(|n| matches!(n, BodyNode::GlossaryEntry(_) | BodyNode::AcronymEntry(_))) {
            add(PackageRequirement::new("glossaries"), &mut packages);
        }
        if !ir.bibliography.style.is_empty() {
            add(PackageRequirement::new("biblatex"), &mut packages);
        }

        // Orden determinista por nombre.
        packages.sort_by(|a, b| a.name.cmp(&b.name));
        PackagePlan { packages }
    }

    /// Expectativas verificables por el postflight + diagnósticos de planificación.
    fn expectations(
        &self,
        ir: &DocumentIR,
        active: &[DocumentPhase],
        diagnostics: &mut Vec<Diagnostic>,
    ) -> VerificationPlan {
        let mut expectations = vec!["phase_order_canonical".to_string()];

        if active.contains(&DocumentPhase::Indexes) {
            expectations.push("toc_present".to_string());
        }
        if active.contains(&DocumentPhase::Appendices) {
            expectations.push("appendix_numbering_valid".to_string());
        }

        // Coherencia: hay citas pero no hay estilo bibliográfico configurado.
        let has_citations = ir
            .all_body_nodes()
            .iter()
            .any(|n| matches!(n, BodyNode::Citation(_)));
        if has_citations {
            expectations.push("no_unresolved_citations".to_string());
            if ir.bibliography.style.is_empty() {
                diagnostics.push(
                    Diagnostic::warning(
                        "PLAN-001",
                        ModuleId::Bibliography,
                        DiagnosticStage::Planning,
                        "plan.citations_without_style",
                    ),
                );
            }
        }

        VerificationPlan { expectations }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // El plan completo se valida con un IR real en
    // `texis-document-infra/tests/pipeline.rs` (build determinista, orden de
    // fases, paquetes). Aquí solo fijamos las rutas estables de artefactos.
    #[test]
    fn phase_artifact_paths_are_stable() {
        assert_eq!(phase_artifact(DocumentPhase::Cover), "sections/cover.tex");
        assert_eq!(
            phase_artifact(DocumentPhase::BackMatter),
            "sections/bibliography.tex"
        );
    }
}
