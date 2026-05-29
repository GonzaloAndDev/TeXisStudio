// Comandos Tauri para el BuildEngine

use serde::Serialize;
use std::path::PathBuf;
use texis_core::build_engine::{
    engine::BuildEngine,
    toolchain::detect_toolchain,
};
use texis_core::texis_project::model::{BuildConfig, LatexEngine, TexisProject};

#[derive(Serialize)]
pub struct BuildResultSummary {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub total_duration_ms: u64,
    pub error_count: usize,
    pub warning_count: usize,
    pub rerun_needed: bool,
    pub steps: Vec<BuildStepSummary>,
}

#[derive(Serialize)]
pub struct BuildStepSummary {
    pub name: String,
    pub success: bool,
    pub duration_ms: u64,
    pub exit_code: Option<i32>,
}

#[derive(Serialize)]
pub struct ToolchainInfo {
    pub available_engines: Vec<String>,
    pub biber_available: bool,
    pub makeglossaries_available: bool,
    pub makeindex_available: bool,
}

/// Detecta las herramientas LaTeX disponibles en el sistema.
#[tauri::command]
pub fn detect_latex_toolchain() -> ToolchainInfo {
    let tc = detect_toolchain();
    ToolchainInfo {
        available_engines: ["pdflatex", "xelatex", "lualatex"]
            .iter()
            .filter(|&&e| tc.is_available(e))
            .map(|&s| s.to_string())
            .collect(),
        biber_available: tc.is_available("biber"),
        makeglossaries_available: tc.is_available("makeglossaries"),
        makeindex_available: tc.is_available("makeindex"),
    }
}

/// Compila un proyecto en modo Full.
/// `project_root`: ruta absoluta al directorio del proyecto.
/// `root_file`: nombre del archivo principal (ej. "main.tex").
/// `engine`: "xelatex" | "pdflatex" | "lualatex"
#[tauri::command]
pub async fn build_project_full(
    project_root: String,
    root_file: String,
    engine: Option<String>,
    shell_escape: Option<bool>,
) -> Result<BuildResultSummary, String> {
    let root = PathBuf::from(&project_root);
    if !root.exists() {
        return Err(format!("El directorio '{}' no existe.", project_root));
    }

    // shell_escape NUNCA puede activarse silenciosamente
    let se = shell_escape.unwrap_or(false);
    if se {
        // En producción, esto debería requerir confirmación previa desde la UI
        // Aquí solo lo registramos como advertencia
        eprintln!("[SECURITY] shell-escape activado para: {}", project_root);
    }

    let latex_engine = match engine.as_deref().unwrap_or("xelatex") {
        "pdflatex" => LatexEngine::PdfLatex,
        "lualatex" => LatexEngine::LuaLatex,
        _ => LatexEngine::XeLatex,
    };

    let mut config = BuildConfig::default();
    config.engine = latex_engine;
    config.shell_escape = se;

    let mut project = TexisProject::new(root, PathBuf::from(&root_file));
    project.build_config = config;

    let engine = BuildEngine::new();
    let result = engine.build_full(&project);

    Ok(BuildResultSummary {
        success: result.success,
        pdf_path: result.pdf_path.as_ref().map(|p| p.display().to_string()),
        total_duration_ms: result.total_duration_ms,
        error_count: result.error_count(),
        warning_count: result.warning_count(),
        rerun_needed: result.rerun_needed,
        steps: result
            .steps
            .iter()
            .map(|s| BuildStepSummary {
                name: s.kind.to_string(),
                success: s.success,
                duration_ms: s.duration_ms,
                exit_code: s.exit_code,
            })
            .collect(),
    })
}

/// Compilación rápida (una pasada LaTeX).
#[tauri::command]
pub async fn build_project_quick(
    project_root: String,
    root_file: String,
    engine: Option<String>,
) -> Result<BuildResultSummary, String> {
    let root = PathBuf::from(&project_root);
    let latex_engine = match engine.as_deref().unwrap_or("xelatex") {
        "pdflatex" => LatexEngine::PdfLatex,
        "lualatex" => LatexEngine::LuaLatex,
        _ => LatexEngine::XeLatex,
    };

    let mut config = BuildConfig::default();
    config.engine = latex_engine;

    let mut project = TexisProject::new(root, PathBuf::from(&root_file));
    project.build_config = config;

    let engine = BuildEngine::new();
    let result = engine.build_quick(&project);

    Ok(BuildResultSummary {
        success: result.success,
        pdf_path: result.pdf_path.as_ref().map(|p| p.display().to_string()),
        total_duration_ms: result.total_duration_ms,
        error_count: result.error_count(),
        warning_count: result.warning_count(),
        rerun_needed: result.rerun_needed,
        steps: result
            .steps
            .iter()
            .map(|s| BuildStepSummary {
                name: s.kind.to_string(),
                success: s.success,
                duration_ms: s.duration_ms,
                exit_code: s.exit_code,
            })
            .collect(),
    })
}
