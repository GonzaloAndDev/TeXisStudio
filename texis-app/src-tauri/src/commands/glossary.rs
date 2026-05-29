// Comandos Tauri para GlossaryEngine.

use std::path::PathBuf;
use texis_core::glossary::{AcronymEntry, GlossaryEntry, GlossaryEntryStatus, GlossaryParser, GlossaryRegistry};
use texis_core::project::{loader::ProjectLoader, model::ContentBlock};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Analiza el glosario del proyecto: entradas definidas, acrónimos y estado de uso.
/// Soporta dos fuentes:
/// 1. Bloques GlossaryEntry/AcronymEntry en el YAML del proyecto (fuente principal)
/// 2. glossary.tex / glossary/glossary.tex (fuente legacy)
#[tauri::command]
pub fn analyze_glossary(project_root: String) -> Result<serde_json::Value, String> {
    let root = PathBuf::from(&project_root);

    // ── Fuente 1: bloques del YAML del proyecto ──────────────────────────────
    let yaml_registry = load_glossary_from_yaml(&root);

    if let Some(registry) = yaml_registry {
        return Ok(registry_to_json(&registry));
    }

    // ── Fuente 2: glossary.tex legacy ────────────────────────────────────────
    let glossary_content = ["glossary.tex", "glossary/glossary.tex"]
        .iter()
        .find_map(|p| {
            let path = root.join(p);
            if path.exists() {
                std::fs::read_to_string(path).ok()
            } else {
                None
            }
        })
        .unwrap_or_default();

    let body_contents = collect_tex_body(&root)?;
    let body_refs: Vec<&str> = body_contents.iter().map(|s| s.as_str()).collect();

    let parser = GlossaryParser::new();
    let registry = parser.parse(&glossary_content, &body_refs);

    Ok(registry_to_json(&registry))
}

/// Lee el proyecto YAML y extrae GlossaryEntry/AcronymEntry de todos los bloques.
/// Retorna None si no existe un proyecto YAML o no tiene entradas de glosario.
fn load_glossary_from_yaml(root: &std::path::Path) -> Option<GlossaryRegistry> {
    // Buscar el archivo del proyecto (*.project.yaml)
    let project_file = find_project_file(root)?;

    let loader = ProjectLoader;
    let model = loader.load_from_file(&project_file).ok()?;

    let mut entries: Vec<GlossaryEntry> = Vec::new();
    let mut acronyms: Vec<AcronymEntry> = Vec::new();

    for section in &model.sections {
        for block in &section.blocks {
            match block {
                ContentBlock::GlossaryEntry(g) => {
                    entries.push(GlossaryEntry {
                        key: g.id.clone(),
                        name: g.term.clone(),
                        name_plural: None,
                        description: g.definition.clone(),
                        symbol: None,
                        category: None,
                        // Entradas YAML se renderizan directamente — no usan \gls{}
                        status: GlossaryEntryStatus::Active,
                    });
                }
                ContentBlock::AcronymEntry(a) => {
                    acronyms.push(AcronymEntry {
                        key: a.id.clone(),
                        short: a.acronym.clone(),
                        long: a.full_form.clone(),
                        long_plural: None,
                        description: a.description.clone(),
                        // Acrónimos YAML se renderizan directamente — no usan \gls{}
                        status: GlossaryEntryStatus::Active,
                    });
                }
                _ => {}
            }
        }
    }

    if entries.is_empty() && acronyms.is_empty() {
        return None;
    }

    Some(GlossaryRegistry { entries, acronyms })
}

fn find_project_file(root: &std::path::Path) -> Option<PathBuf> {
    let read_dir = std::fs::read_dir(root).ok()?;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.ends_with(".project.yaml") {
                return Some(path);
            }
        }
    }
    None
}

fn registry_to_json(registry: &GlossaryRegistry) -> serde_json::Value {
    serde_json::json!({
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
    })
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
            if name.starts_with('.') || name == "build" || name == "target" {
                continue;
            }
            collect_recursive(&path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("tex") {
            if let Ok(content) = std::fs::read_to_string(&path) {
                out.push(content);
            }
        }
    }
    Ok(())
}
