//! Plan de Documento Inmutable (§8.1).
//!
//! Andamiaje de la Etapa A: define el contrato del plan final que el
//! `DocumentAssembler` producirá en la Etapa B. Aquí solo viven los **tipos**
//! (value objects); la lógica de ensamblado pertenece a la capa de aplicación.

use crate::ir::resources::PackageRequirement;
use crate::phase::DocumentPhase;
use serde::{Deserialize, Serialize};
use texis_document_contracts::assets::AssetRef;
use texis_document_contracts::diagnostics::Diagnostic;

/// Plan de una fase: artefactos ordenados que la componen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhasePlan {
    pub phase: DocumentPhase,
    /// Rutas relativas de los artefactos (.tex) de la fase, en orden.
    pub artifacts: Vec<String>,
}

/// Grafo de archivos del build con su propietario (§8).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileGraph {
    pub files: Vec<PlannedFile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileOwnership {
    /// Generado por la app; se regenera.
    Generated,
    /// Editado manualmente; se respeta según política explícita.
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlannedFile {
    pub relative_path: String,
    pub ownership: FileOwnership,
}

/// Plan de paquetes resuelto (sin conflictos).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackagePlan {
    pub packages: Vec<PackageRequirement>,
}

/// Plan de assets a copiar/verificar.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetPlan {
    pub assets: Vec<AssetRef>,
}

/// Plan de toolchain (motor, compilador, backend bibliográfico).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolchainPlan {
    pub engine: String,
    pub compiler: String,
    pub bibliography_backend: Option<String>,
}

/// Expectativas verificables tras compilar (§8.1, postflight).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerificationPlan {
    /// Claves de expectativas estructurales que el postflight debe comprobar.
    pub expectations: Vec<String>,
}

/// Plan de Documento Inmutable. Producto final de la fase de planificación.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentPlan {
    pub phases: Vec<PhasePlan>,
    pub files: FileGraph,
    pub packages: PackagePlan,
    pub assets: AssetPlan,
    pub toolchain: ToolchainPlan,
    pub expectations: VerificationPlan,
    /// Capacidades requeridas por el documento (resueltas contra el backend).
    /// Las rellena el caso de uso de ensamblado (§8.3); el plan las transporta.
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
}
