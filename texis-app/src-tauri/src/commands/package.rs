// Comandos Tauri para PackageEngine.
// Analiza los paquetes LaTeX requeridos por el proyecto y detecta conflictos.

use std::path::PathBuf;
use texis_core::package::{PackageAnalysis, PackageDetector};

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
    let preamble_path = root.join("preamble.tex");

    // Leer preamble.tex (puede no existir aún)
    let preamble = if preamble_path.exists() {
        std::fs::read_to_string(&preamble_path).map_err(err)?
    } else {
        String::new()
    };

    // Recopilar todos los .tex del proyecto (recursivo)
    let tex_contents = collect_tex_sources(&root)?;
    let tex_refs: Vec<&str> = tex_contents.iter().map(|s| s.as_str()).collect();

    let detector = PackageDetector::new();
    let analysis: PackageAnalysis = detector.analyze(&tex_refs, &preamble);

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

fn collect_tex_sources(root: &std::path::Path) -> Result<Vec<String>, String> {
    let mut sources = Vec::new();
    collect_tex_recursive(root, &mut sources)?;
    Ok(sources)
}

fn collect_tex_recursive(dir: &std::path::Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(err)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            // Skip build and hidden directories
            if name.starts_with('.') || name == "build" || name == "target" {
                continue;
            }
            collect_tex_recursive(&path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("tex") {
            if let Ok(content) = std::fs::read_to_string(&path) {
                out.push(content);
            }
        }
    }
    Ok(())
}
