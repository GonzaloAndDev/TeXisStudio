use serde_json::Value;
use std::path::PathBuf;
use texis_core::{
    compiler::{latexmk::LatexmkBackend, CompilationBackend, CompilationOptions},
    project::loader::ProjectLoader,
    LaTeXGenerator,
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Compila el proyecto y devuelve resultado con errores traducidos.
#[tauri::command]
pub fn compile_project(
    project_path: String,
    backend_name: String,
    draft: bool,
) -> Result<Value, String> {
    let path = PathBuf::from(&project_path);
    let yaml_path = path.join("tesis.project.yaml");

    let loader = ProjectLoader;
    let model = loader.load_from_file(&yaml_path).map_err(err)?;

    let build_dir = path.join("build");

    // Regenerar LaTeX antes de compilar
    // Nota: no se nombra la variable 'gen' (reservado en edition 2024)
    let latex_gen = LaTeXGenerator::new().map_err(err)?;
    latex_gen.generate(&model, &build_dir).map_err(err)?;

    let options = CompilationOptions {
        draft,
        clean_temp: false,
        max_runs: None,
    };

    let result = match backend_name.as_str() {
        "latexmk" => {
            let backend = LatexmkBackend::new();
            if !backend.is_available() {
                return Err(
                    "latexmk no está instalado. Instala TeX Live o MiKTeX para compilar."
                        .to_string(),
                );
            }
            backend.compile(&build_dir, &options).map_err(err)?
        }
        other => return Err(format!("Backend '{}' no reconocido.", other)),
    };

    let user_errors: Vec<Value> = result
        .user_errors
        .iter()
        .map(|e| {
            serde_json::json!({
                "message": e.message,
                "suggestion": e.suggestion,
                "raw_log_line": e.raw_log_line,
            })
        })
        .collect();

    Ok(serde_json::json!({
        "success": result.success,
        "pdf_path": result.pdf_path.map(|p| p.to_string_lossy().to_string()),
        "user_errors": user_errors,
        "warnings": result.warnings,
        "log_preview": &result.log[..result.log.len().min(4000)],
    }))
}
