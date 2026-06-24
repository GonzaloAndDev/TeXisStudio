//! Caso de uso único de ensamblado/build (§8, paso 3 del programa).
//!
//! Es la **única** ruta productiva de build del núcleo nuevo: app y CLI llaman
//! aquí. Compone el pipeline determinista:
//!
//! ```text
//! DocumentIR → PlanBuilder → DocumentPlan → RenderBackend → RenderedDocument
//!                                        ↘ BuildManifest (hashes reproducibles)
//! ```
//!
//! No escribe en disco ni invoca compiladores: produce artefactos en memoria y
//! un manifiesto. La escritura atómica y la compilación pertenecen a adaptadores.

use crate::ports::{ContentHasher, IrSerializer};
use texis_document_contracts::diagnostics::Diagnostic;
use texis_document_contracts::manifest::{
    BuildManifest, ResourceHash, ToolchainStamp, BUILD_MANIFEST_VERSION,
};
use texis_document_contracts::version::DocumentSchemaVersion;
use texis_document_domain::backend::{RenderBackend, RenderedDocument};
use texis_document_domain::ir::DocumentIR;
use texis_document_domain::plan::DocumentPlan;
use texis_document_domain::plan_builder::PlanBuilder;

/// Resultado del ensamblado: plan, archivos renderizados y manifiesto.
pub struct AssembledDocument {
    pub plan: DocumentPlan,
    pub rendered: RenderedDocument,
    pub manifest: BuildManifest,
}

/// Servicio único de build. Genérico sobre el backend de render, el serializador
/// del IR (para hashear la entrada) y el hasher de contenido.
pub struct AssembleDocumentUseCase<B, S, H>
where
    B: RenderBackend,
    S: IrSerializer,
    H: ContentHasher,
{
    backend: B,
    serializer: S,
    hasher: H,
}

impl<B, S, H> AssembleDocumentUseCase<B, S, H>
where
    B: RenderBackend,
    S: IrSerializer,
    H: ContentHasher,
{
    pub fn new(backend: B, serializer: S, hasher: H) -> Self {
        Self {
            backend,
            serializer,
            hasher,
        }
    }

    /// Ejecuta el pipeline completo de ensamblado sobre un IR resuelto.
    pub fn execute(&self, ir: &DocumentIR) -> AssembledDocument {
        let plan = PlanBuilder::new().build(ir);
        let rendered = self.backend.render_document(ir, &plan);
        let manifest = self.build_manifest(ir, &plan, &rendered);

        AssembledDocument {
            plan,
            rendered,
            manifest,
        }
    }

    fn build_manifest(
        &self,
        ir: &DocumentIR,
        plan: &DocumentPlan,
        rendered: &RenderedDocument,
    ) -> BuildManifest {
        // Entrada: hash del IR canónico serializado.
        let mut inputs = Vec::new();
        if let Ok(ir_json) = self.serializer.serialize(ir) {
            inputs.push(ResourceHash {
                name: "document_ir".to_string(),
                algorithm: self.hasher.algorithm().to_string(),
                digest: self.hasher.hash_hex(ir_json.as_bytes()),
            });
        }

        // Artefactos: hash de cada archivo renderizado.
        let artifacts = rendered
            .files
            .iter()
            .map(|f| ResourceHash {
                name: f.relative_path.clone(),
                algorithm: self.hasher.algorithm().to_string(),
                digest: self.hasher.hash_hex(f.content.as_bytes()),
            })
            .collect();

        let resolved_capabilities = self
            .backend
            .capabilities()
            .capabilities
            .iter()
            .map(|c| c.as_str().to_string())
            .collect();

        let mut diagnostics: Vec<Diagnostic> = plan.diagnostics.clone();
        diagnostics.extend(rendered.diagnostics.iter().cloned());

        let mut manifest = BuildManifest {
            manifest_version: BUILD_MANIFEST_VERSION,
            document_id: ir.identity.id.as_str().to_string(),
            toolchain: ToolchainStamp {
                document_schema: DocumentSchemaVersion::CURRENT,
                manifest_version: BUILD_MANIFEST_VERSION,
                engine: plan.toolchain.engine.clone(),
                compiler: plan.toolchain.compiler.clone(),
                bibliography_backend: plan.toolchain.bibliography_backend.clone(),
            },
            inputs,
            artifacts,
            resolved_capabilities,
            diagnostics,
        };
        manifest.normalize();
        manifest
    }
}
