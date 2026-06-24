//! Modelo Documental Intermedio (`DocumentIR`) — el nuevo centro del sistema (§5).
//!
//! Representación semántica, normalizada, versionada e independiente de LaTeX.
//! Inmutable tras la resolución. Sus invariantes (§5.1) se comprueban con
//! [`DocumentIR::check_invariants`].

pub mod body_node;
pub mod meta;
pub mod modules;
pub mod resources;

use serde::{Deserialize, Serialize};
use texis_document_contracts::diagnostics::{
    Diagnostic, DiagnosticStage, Diagnostics, DocumentLocation,
};
use texis_document_contracts::ids::ModuleId;
use texis_document_contracts::locale::DocumentLocale;
use texis_document_contracts::provenance::ResolutionProvenance;
use texis_document_contracts::version::DocumentSchemaVersion;

use body_node::BodyNode;
use meta::{DocumentIdentity, ResolvedMetadata, ResolvedProfile};
use modules::{
    AppendicesDocument, BackMatterDocument, BibliographyDocument, BodyDocument, BodySection,
    CoverDocument, IndexesDocument, PreliminariesDocument,
};
use resources::ResourceGraph;

/// El Modelo Documental Intermedio. Producido por el `DocumentResolver` (o el
/// importador legacy), validado por los módulos, y consumido por el ensamblador.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentIR {
    pub schema: DocumentSchemaVersion,
    pub identity: DocumentIdentity,
    pub metadata: ResolvedMetadata,
    pub locale: DocumentLocale,
    pub profile: ResolvedProfile,
    pub cover: CoverDocument,
    pub preliminaries: PreliminariesDocument,
    pub indexes: IndexesDocument,
    pub body: BodyDocument,
    pub bibliography: BibliographyDocument,
    pub appendices: AppendicesDocument,
    /// Materia final no bibliográfica (glosario editorial, nomenclatura, cierre).
    #[serde(default)]
    pub back_matter: BackMatterDocument,
    pub resources: ResourceGraph,
    pub provenance: ResolutionProvenance,
}

impl DocumentIR {
    /// Comprueba las invariantes obligatorias del IR (§5.1). Devuelve
    /// diagnósticos estructurados; vacío = IR válido.
    ///
    /// Verifica:
    /// - sin rutas absolutas en assets;
    /// - el logo de portada (si existe) está declarado en el grafo de recursos;
    /// - toda figura referencia un asset existente en el grafo.
    pub fn check_invariants(&self) -> Diagnostics {
        let mut diags = Diagnostics::new();

        // Sin rutas absolutas (§5.1).
        for asset in &self.resources.assets {
            if !asset.path_is_relative() {
                diags.push(
                    Diagnostic::error(
                        "IR-001",
                        ModuleId::Resolver,
                        DiagnosticStage::Resolution,
                        "ir.asset_path_absolute",
                    )
                    .with_param("asset", asset.id.as_str())
                    .with_param("path", &asset.relative_path),
                );
            }
        }

        // El logo de portada debe estar en el grafo de recursos.
        if let Some(logo) = &self.cover.institution.logo {
            if !self.resources.assets.iter().any(|a| &a.id == logo) {
                diags.push(
                    Diagnostic::error(
                        "IR-002",
                        ModuleId::Cover,
                        DiagnosticStage::Resolution,
                        "ir.cover_logo_unresolved",
                    )
                    .with_param("asset", logo.as_str())
                    .with_location(DocumentLocation::module(ModuleId::Cover)),
                );
            }
        }

        // Toda figura del cuerpo/anexos referencia un asset declarado.
        for node in self.all_body_nodes() {
            if let BodyNode::Figure(fig) = node {
                if !self.resources.assets.iter().any(|a| a.id == fig.asset) {
                    diags.push(
                        Diagnostic::error(
                            "IR-003",
                            ModuleId::Body,
                            DiagnosticStage::Resolution,
                            "ir.figure_asset_unresolved",
                        )
                        .with_param("asset", fig.asset.as_str())
                        .with_param("figure", fig.id.as_str()),
                    );
                }
            }
        }

        diags
    }

    /// Itera todos los nodos de cuerpo y anexos (recursivo).
    pub fn all_body_nodes(&self) -> Vec<&BodyNode> {
        let mut out = Vec::new();
        for section in &self.body.sections {
            collect_section_nodes(section, &mut out);
        }
        for appendix in &self.appendices.appendices {
            out.extend(appendix.nodes.iter());
            for child in &appendix.children {
                collect_section_nodes(child, &mut out);
            }
        }
        for section in &self.back_matter.sections {
            collect_section_nodes(section, &mut out);
        }
        out
    }
}

fn collect_section_nodes<'a>(section: &'a BodySection, out: &mut Vec<&'a BodyNode>) {
    out.extend(section.nodes.iter());
    for child in &section.children {
        collect_section_nodes(child, out);
    }
}
