//! Puente de la app con el **núcleo documental nuevo** (Plan Maestro A→J).
//!
//! Tauri, CLI y (en el futuro) más superficies consumen el MISMO caso de uso de
//! ensamblado (`AssembleDocumentUseCase`). Esto cierra la integración exigida por
//! la auditoría: la app ya no depende solo del generador legacy para razonar
//! sobre el documento.
//!
//! Este comando NO compila a PDF ni escribe en disco: importa el proyecto al
//! `DocumentIR`, ejecuta el pipeline bloqueante en el modo pedido y devuelve
//! diagnósticos, plan, capacidades y manifiesto para la UI.

use std::path::Path;

use texis_core::project::loader::ProjectLoader;
use texis_document_application::{AssembleDocumentUseCase, BuildMode};
use texis_document_infra::{
    import_project_from_root, JsonIrSerializer, LatexRenderBackend, Sha256Hasher,
};

/// Resultado del ensamblado para la UI.
#[derive(serde::Serialize)]
pub struct DocumentBuildResult {
    /// `true` si el documento es utilizable en el modo pedido (sin bloqueantes).
    pub usable: bool,
    /// `true` si el pipeline bloqueó (modo Review/Final con diagnósticos críticos).
    pub blocked: bool,
    pub mode: String,
    /// Diagnósticos (importación + validación + políticas + capacidades).
    pub diagnostics: Vec<serde_json::Value>,
    /// Fases activas en orden canónico.
    pub phases: Vec<String>,
    /// Capacidades requeridas por el documento.
    pub capabilities: Vec<String>,
    /// Manifiesto de build (cuando el build procede).
    pub manifest: Option<serde_json::Value>,
}

fn parse_mode(mode: &str) -> BuildMode {
    match mode.to_lowercase().as_str() {
        "final" => BuildMode::Final,
        "review" => BuildMode::Review,
        _ => BuildMode::Draft,
    }
}

/// Importa el proyecto al núcleo nuevo y ejecuta el pipeline bloqueante.
///
/// `mode`: "draft" | "review" | "final".
#[tauri::command]
pub fn document_build(project_dir: String, mode: String) -> Result<DocumentBuildResult, String> {
    let root = Path::new(&project_dir);
    let model = ProjectLoader
        .load_from_file(&root.join("tesis.project.yaml"))
        .map_err(|e| e.to_string())?;

    let resolution = import_project_from_root(&model, root);
    let mut diagnostics: Vec<serde_json::Value> = resolution
        .diagnostics
        .iter()
        .filter_map(|d| serde_json::to_value(d).ok())
        .collect();

    let ir = resolution
        .value
        .ok_or_else(|| "la importación no produjo un DocumentIR".to_string())?;

    let build_mode = parse_mode(&mode);
    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );

    match use_case.execute(&ir, build_mode) {
        Ok(assembled) => {
            diagnostics.extend(
                assembled
                    .diagnostics
                    .iter()
                    .filter_map(|d| serde_json::to_value(d).ok()),
            );
            Ok(DocumentBuildResult {
                usable: !assembled.diagnostics.has_blocking(),
                blocked: false,
                mode,
                diagnostics,
                phases: assembled
                    .plan
                    .phases
                    .iter()
                    .map(|p| format!("{:?}", p.phase))
                    .collect(),
                capabilities: assembled.plan.capabilities.clone(),
                manifest: serde_json::to_value(&assembled.manifest).ok(),
            })
        }
        Err(err) => {
            diagnostics.extend(
                err.diagnostics
                    .iter()
                    .filter_map(|d| serde_json::to_value(d).ok()),
            );
            Ok(DocumentBuildResult {
                usable: false,
                blocked: true,
                mode,
                diagnostics,
                phases: Vec::new(),
                capabilities: Vec::new(),
                manifest: None,
            })
        }
    }
}
