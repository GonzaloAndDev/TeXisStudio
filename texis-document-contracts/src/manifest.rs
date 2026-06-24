//! Manifiesto de build reproducible (§ "Entrega Reproducible").
//!
//! Cada build produce un `BuildManifest` con hashes de entradas y artefactos,
//! versiones de contratos y toolchain, capacidades resueltas, políticas
//! aplicadas y diagnósticos. Permite demostrar, para cualquier PDF, qué
//! participó y si el build es determinista.

use crate::diagnostics::Diagnostic;
use crate::profile::ProfilePolicy;
use crate::provenance::ResolutionProvenance;
use crate::version::{ContractVersion, DocumentSchemaVersion};
use serde::{Deserialize, Serialize};

/// Versión del propio contrato del manifiesto.
pub const BUILD_MANIFEST_VERSION: ContractVersion = ContractVersion::new(0, 1);

/// Hash de un recurso (entrada o artefacto). Algoritmo + hex.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct ResourceHash {
    /// Nombre/ruta lógica del recurso.
    pub name: String,
    /// Algoritmo ("sha256").
    pub algorithm: String,
    /// Digest en hexadecimal.
    pub digest: String,
}

impl ResourceHash {
    pub fn sha256(name: impl Into<String>, digest: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            algorithm: "sha256".to_string(),
            digest: digest.into(),
        }
    }
}

/// Versiones de los contratos y herramientas que participaron.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolchainStamp {
    pub document_schema: DocumentSchemaVersion,
    pub manifest_version: ContractVersion,
    /// Motor LaTeX objetivo ("xelatex", "lualatex", "pdflatex").
    pub engine: String,
    /// Compilador ("latexmk", "tectonic").
    pub compiler: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bibliography_backend: Option<String>,
}

/// Manifiesto de un build. Determinista: con entradas idénticas produce el mismo
/// manifiesto (salvo campos de tiempo, que se omiten para reproducibilidad).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BuildManifest {
    pub manifest_version: ContractVersion,
    /// Id del documento construido.
    pub document_id: String,
    /// Modo de build ("draft"/"review"/"final").
    pub build_mode: String,
    /// Perfil institucional aplicado.
    pub profile_id: String,
    /// Idioma documental y fallback resueltos.
    pub document_locale: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_locale_fallback: Option<String>,
    /// Política efectivamente aplicada por el pipeline.
    pub profile_policy: ProfilePolicy,
    /// Trazabilidad de las decisiones de resolución.
    pub provenance: ResolutionProvenance,
    /// Plugins presentes en el documento, ordenados y sin duplicados.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub plugin_ids: Vec<String>,
    pub toolchain: ToolchainStamp,
    /// Hashes de las entradas relevantes (ordenados).
    pub inputs: Vec<ResourceHash>,
    /// Hashes de los artefactos producidos (ordenados).
    pub artifacts: Vec<ResourceHash>,
    /// Capacidades que el backend declaró satisfacer.
    pub resolved_capabilities: Vec<String>,
    /// Capacidades que el documento requería (resueltas en planificación).
    #[serde(default)]
    pub required_capabilities: Vec<String>,
    /// Diagnósticos acumulados durante el build.
    pub diagnostics: Vec<Diagnostic>,
}

impl BuildManifest {
    /// Ordena entradas y artefactos para que el manifiesto sea determinista.
    pub fn normalize(&mut self) {
        self.inputs.sort();
        self.artifacts.sort();
        self.resolved_capabilities.sort();
        self.required_capabilities.sort();
        self.plugin_ids.sort();
        self.plugin_ids.dedup();
    }
}
