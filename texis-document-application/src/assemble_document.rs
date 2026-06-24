//! Caso de uso único de ensamblado/build (§8, paso 3 del programa).
//!
//! Es la **única** ruta productiva de build. Ejecuta el pipeline completo y
//! **bloqueante** (Bloqueador #1 de la auditoría):
//!
//! ```text
//! DocumentIR
//!   → validación de dominio (invariantes + módulos)
//!   → políticas institucionales (si hay perfil)
//!   → resolución de capacidades (vs. backend)
//!   → [gate por BuildMode]
//!   → PlanBuilder → DocumentPlan → RenderBackend → RenderedDocument
//!                                              ↘ BuildManifest (hashes)
//! ```
//!
//! Sólo `BuildMode::Draft` continúa pese a diagnósticos. `Review`/`Final`
//! devuelven `Err` ante cualquier diagnóstico bloqueante. Nunca se inventan datos.

use crate::ports::{ContentHasher, IrSerializer};
use texis_document_contracts::diagnostics::{Diagnostic, Diagnostics};
use texis_document_contracts::manifest::{
    BuildManifest, ResourceHash, ToolchainStamp, BUILD_MANIFEST_VERSION,
};
use texis_document_contracts::profile::ProfilePolicy;
use texis_document_contracts::version::DocumentSchemaVersion;
use texis_document_domain::backend::{RenderBackend, RenderedDocument};
use texis_document_domain::capability_registry;
use texis_document_domain::ir::DocumentIR;
use texis_document_domain::plan::DocumentPlan;
use texis_document_domain::plan_builder::PlanBuilder;
use texis_document_domain::{policy, validation};

/// Modo de build. Gobierna si un build puede continuar con diagnósticos.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BuildMode {
    /// Iteración: continúa pese a diagnósticos (nunca inventa datos).
    Draft,
    /// Revisión: bloquea ante cualquier diagnóstico bloqueante.
    Review,
    /// Entrega final: bloquea ante cualquier diagnóstico bloqueante.
    Final,
}

impl BuildMode {
    /// `true` si este modo puede continuar aunque haya diagnósticos bloqueantes.
    fn tolerates_blocking(self) -> bool {
        matches!(self, BuildMode::Draft)
    }
}

/// Error de build: el pipeline se detuvo por diagnósticos bloqueantes.
#[derive(Debug)]
pub struct BuildError {
    pub mode: BuildMode,
    pub diagnostics: Diagnostics,
}

impl std::fmt::Display for BuildError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let n = self.diagnostics.errors().count();
        write!(
            f,
            "build {:?} detenido: {} diagnóstico(s) bloqueante(s)",
            self.mode, n
        )
    }
}

impl std::error::Error for BuildError {}

/// Resultado del ensamblado: plan, archivos renderizados y manifiesto.
pub struct AssembledDocument {
    pub mode: BuildMode,
    pub plan: DocumentPlan,
    pub rendered: RenderedDocument,
    pub manifest: BuildManifest,
    /// Todos los diagnósticos acumulados (validación + políticas + capacidades).
    pub diagnostics: Diagnostics,
}

/// Servicio único de build.
pub struct AssembleDocumentUseCase<B, S, H>
where
    B: RenderBackend,
    S: IrSerializer,
    H: ContentHasher,
{
    backend: B,
    serializer: S,
    hasher: H,
    policy: Option<ProfilePolicy>,
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
            policy: None,
        }
    }

    /// Adjunta una política institucional que se evaluará en cada build.
    pub fn with_policy(mut self, policy: ProfilePolicy) -> Self {
        self.policy = Some(policy);
        self
    }

    /// Ejecuta el pipeline completo y bloqueante.
    pub fn execute(
        &self,
        ir: &DocumentIR,
        mode: BuildMode,
    ) -> Result<AssembledDocument, BuildError> {
        // 1) Validación de dominio (invariantes + validadores por módulo).
        let mut diagnostics = validation::validate_document(ir);

        // 2) Políticas institucionales (si hay perfil con política).
        if let Some(pol) = &self.policy {
            diagnostics.extend(policy::evaluate(pol, ir));
        }

        // 3) Resolución de capacidades contra el backend.
        let caps = capability_registry::resolve(ir, &self.backend.capabilities());
        diagnostics.extend(caps.diagnostics.clone());

        // 4) Gate por modo: Review/Final no continúan con bloqueantes.
        if diagnostics.has_blocking() && !mode.tolerates_blocking() {
            return Err(BuildError { mode, diagnostics });
        }

        // 5) Planificación: el plan transporta capacidades y diagnósticos.
        let mut plan = PlanBuilder::new().build(ir);
        plan.capabilities = caps
            .required
            .iter()
            .map(|c| c.as_str().to_string())
            .collect();
        plan.diagnostics = diagnostics.items.clone();

        // 6) Render.
        let rendered = self.backend.render_document(ir, &plan);

        // 7) Manifiesto reproducible.
        let manifest = self.build_manifest(ir, &plan, &rendered, mode);

        Ok(AssembledDocument {
            mode,
            plan,
            rendered,
            manifest,
            diagnostics,
        })
    }

    fn build_manifest(
        &self,
        ir: &DocumentIR,
        plan: &DocumentPlan,
        rendered: &RenderedDocument,
        mode: BuildMode,
    ) -> BuildManifest {
        let mut inputs = Vec::new();
        if let Ok(ir_json) = self.serializer.serialize(ir) {
            inputs.push(ResourceHash {
                name: "document_ir".to_string(),
                algorithm: self.hasher.algorithm().to_string(),
                digest: self.hasher.hash_hex(ir_json.as_bytes()),
            });
        }

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
            build_mode: format!("{mode:?}").to_lowercase(),
            profile_id: ir.profile.id.as_str().to_string(),
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
            required_capabilities: plan.capabilities.clone(),
            diagnostics,
        };
        manifest.normalize();
        manifest
    }
}
