// Comandos Tauri para GlossaryEngine.

use std::path::PathBuf;
use texis_core::glossary::GlossaryParser;

fn err(e: impl std::fmt::Display) -> String { e.to_string() }

/// Analiza el glosario del proyecto: entradas definidas, acrónimos y estado de uso.
#[tauri::command]
pub fn analyze_glossary(project_root: String) -> Result<serde_json::Value, String> {
    let root = PathBuf::from(&project_root);

    // Leer glossary.tex (puede estar en la raíz o en glossary/)
    let glossary_content = ["glossary.tex", "glossary/glossary.tex"]
        .iter()
        .find_map(|p| {
            let path = root.join(p);
            if path.exists() { std::fs::read_to_string(path).ok() } else { None }
        })
        .unwrap_or_default();

    // Recopilar todos los .tex del cuerpo
    let body_contents = collect_tex_body(&root)?;
    let body_refs: Vec<&str> = body_contents.iter().map(|s| s.as_str()).collect();

    let parser = GlossaryParser::new();
    let registry = parser.parse(&glossary_content, &body_refs);

    Ok(serde_json::json!({
        "entries": registry.entries.iter().map(|e| serde_json::json!({
            "key": e.key,
            "name": e.name,
            "description": e.description,
            "status": e.status,
        })).collect::<Vec<_>>(),
        "acronyms": registry.acronyms.iter().map(|a| serde_json::json!({
            "key": a.key,
            "short": a.short,
            "long": a.long,
            "status": a.status,
        })).collect::<Vec<_>>(),
        "is_empty": registry.is_empty(),
        "has_issues": registry.has_issues(),
        "undefined_references": registry.undefined_references(),
    }))
}

fn collect_tex_body(root: &std::path::Path) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    collect_recursive(root, &mut out)?;
    Ok(out)
}

fn collect_recursive(dir: &std::path::Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(err)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') || name == "build" || name == "target" { continue; }
            collect_recursive(&path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("tex") {
            if let Ok(content) = std::fs::read_to_string(&path) {
                out.push(content);
            }
        }
    }
    Ok(())
}
