use serde_json::Value;
use std::path::PathBuf;
use texis_core::{
    compiler::{
        latexmk::LatexmkBackend,
        tectonic::TectonicBackend,
        CompilationBackend, CompilationOptions,
    },
    project::loader::ProjectLoader,
    LaTeXGenerator,
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Compila el proyecto y devuelve resultado con errores traducidos.
/// backend_name: "latexmk" | "tectonic" | "auto" (elige el mejor disponible)
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

    // Selección de backend
    let backend: Box<dyn CompilationBackend> = match backend_name.as_str() {
        "latexmk" => {
            let b = LatexmkBackend::new();
            if !b.is_available() {
                return Err(
                    "latexmk no está instalado. Instala TeX Live, MiKTeX, o usa Tectonic."
                        .to_string(),
                );
            }
            Box::new(b)
        }
        "tectonic" => {
            let b = TectonicBackend::new();
            if !b.is_available() {
                return Err(
                    "Tectonic no está instalado. Visita https://tectonic-typesetting.github.io para instalarlo.".to_string()
                );
            }
            Box::new(b)
        }
        "auto" => {
            // Preferir latexmk si está disponible, sino tectonic
            let lmk = LatexmkBackend::new();
            if lmk.is_available() {
                Box::new(lmk)
            } else {
                let tec = TectonicBackend::new();
                if tec.is_available() {
                    Box::new(tec)
                } else {
                    return Err(
                        "No se encontró ningún compilador LaTeX. Instala latexmk (TeX Live/MiKTeX) o Tectonic.".to_string()
                    );
                }
            }
        }
        other => return Err(format!("Backend '{}' no reconocido. Usa: latexmk, tectonic o auto.", other)),
    };

    let result = backend.compile(&build_dir, &options).map_err(err)?;

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
        "log_preview": &result.log[..result.log.len().min(6000)],
        "backend_used": backend.name(),
    }))
}
