// Comandos Tauri para PackageEngine.
// Analiza los paquetes LaTeX requeridos por el proyecto y detecta conflictos.

use std::path::PathBuf;
use texis_core::events::EventBus;
use texis_core::package::PackageEngine;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Analiza los paquetes del proyecto y retorna qué falta y qué conflictos hay.
///
/// `project_root`: ruta raíz del proyecto.
/// Busca automáticamente preamble.tex y todos los .tex del proyecto.
#[tauri::command]
pub fn analyze_packages(project_root: String) -> Result<serde_json::Value, String> {
    let root = PathBuf::from(&project_root);
    let mut engine = PackageEngine::load(&root).map_err(err)?;
    let analysis = engine
        .analyze_project(&root, &EventBus::new())
        .map_err(err)?;
    engine.save(&root).map_err(err)?;

    Ok(serde_json::json!({
        "missing": analysis.missing.iter().map(|r| serde_json::json!({
            "package_name": r.package_name,
            "options": r.options,
            "reason": r.reason,
            "priority": r.priority,
            "already_declared": r.already_declared,
        })).collect::<Vec<_>>(),
        "declared": analysis.declared,
        "conflicts": analysis.conflicts.iter().map(|c| serde_json::json!({
            "package_a": c.package_a,
            "package_b": c.package_b,
            "description": c.description,
            "resolution": c.resolution,
            "is_blocking": c.is_blocking,
        })).collect::<Vec<_>>(),
        "requires_shell_escape": analysis.requires_shell_escape,
        "has_blocking_issues": analysis.has_blocking_issues(),
    }))
}
