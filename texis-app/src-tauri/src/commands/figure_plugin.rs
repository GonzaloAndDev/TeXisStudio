use serde_json::Value;
use std::path::PathBuf;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn safe_figure_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn figure_dir(project_path: &str, figure_id: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join("texisstudio-assets")
        .join("figures")
        .join(figure_id)
}

fn project_root(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path);
    if !root.is_dir() || !root.join("tesis.project.yaml").is_file() {
        return Err("Ruta de proyecto invalida: no contiene tesis.project.yaml.".to_string());
    }
    Ok(root)
}

/// Persists a plugin figure to disk:
///   <project>/texisstudio-assets/figures/<figureId>/source.json
///   <project>/texisstudio-assets/figures/<figureId>/output.tex
///   <project>/texisstudio-assets/figures/<figureId>/manifest.json
///
/// Returns the figureId so the frontend can store it in PluginFigureBlock.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn save_plugin_figure(
    project_path: String,
    figure_id: String,
    latex_tex: String,
    source_json: String,
    required_packages: Vec<String>,
    plugin_id: String,
    caption: String,
    label: String,
    warnings: Vec<String>,
) -> Result<Value, String> {
    if !safe_figure_id(&figure_id) {
        return Err(format!("figureId inválido: '{figure_id}'"));
    }

    project_root(&project_path)?;

    let dir = figure_dir(&project_path, &figure_id);
    std::fs::create_dir_all(&dir).map_err(err)?;

    // Write output.tex (the bare figure body). An empty latex_tex signals a
    // meta-only update (caption/label), so the existing body is left intact.
    if !latex_tex.is_empty() {
        std::fs::write(dir.join("output.tex"), &latex_tex).map_err(err)?;
    }

    // Write source.json (engine document for re-editing)
    std::fs::write(dir.join("source.json"), &source_json).map_err(err)?;

    // Write manifest.json
    let manifest = serde_json::json!({
        "id": figure_id,
        "pluginId": plugin_id,
        "caption": caption,
        "label": label,
        "requiredPackages": required_packages,
        "warnings": warnings,
        "updatedAt": chrono::Utc::now().to_rfc3339(),
    });
    std::fs::write(dir.join("manifest.json"), manifest.to_string()).map_err(err)?;

    Ok(serde_json::json!({ "figureId": figure_id, "dir": dir.to_string_lossy() }))
}

/// Loads the source.json for a previously-saved plugin figure so the
/// frontend can reconstruct the engine document for re-editing.
#[tauri::command]
pub fn load_figure_source(project_path: String, figure_id: String) -> Result<Value, String> {
    if !safe_figure_id(&figure_id) {
        return Err(format!("figureId inválido: '{figure_id}'"));
    }

    project_root(&project_path)?;

    let dir = figure_dir(&project_path, &figure_id);
    let source_path = dir.join("source.json");
    let manifest_path = dir.join("manifest.json");

    if !source_path.exists() {
        return Err(format!(
            "source.json no encontrado para la figura '{figure_id}'"
        ));
    }

    let source_json = std::fs::read_to_string(&source_path).map_err(err)?;
    let manifest: Option<Value> = if manifest_path.exists() {
        Some(
            serde_json::from_str(&std::fs::read_to_string(&manifest_path).map_err(err)?)
                .map_err(err)?,
        )
    } else {
        None
    };

    Ok(serde_json::json!({
        "sourceJson": source_json,
        "manifest": manifest,
    }))
}

/// Removes all assets for a plugin figure from disk.
/// Called when the user deletes a PluginFigureBlock from the editor.
#[tauri::command]
pub fn delete_plugin_figure(project_path: String, figure_id: String) -> Result<(), String> {
    if !safe_figure_id(&figure_id) {
        return Err(format!("figureId inválido: '{figure_id}'"));
    }

    project_root(&project_path)?;

    let dir = figure_dir(&project_path, &figure_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(err)?;
    }
    Ok(())
}

/// Lists all plugin figures saved in the project (for diagnostics / asset panel).
#[tauri::command]
pub fn list_plugin_figures(project_path: String) -> Result<Value, String> {
    let root = project_root(&project_path)?;
    let figures_dir = root.join("texisstudio-assets").join("figures");

    if !figures_dir.exists() {
        return Ok(serde_json::json!([]));
    }

    let mut entries: Vec<Value> = Vec::new();
    let read = std::fs::read_dir(&figures_dir).map_err(err)?;
    for entry in read.flatten() {
        let figure_id = entry.file_name().to_string_lossy().to_string();
        let manifest_path = entry.path().join("manifest.json");
        if manifest_path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<Value>(&raw) {
                    entries.push(manifest);
                    continue;
                }
            }
        }
        entries.push(serde_json::json!({ "id": figure_id }));
    }

    Ok(serde_json::json!(entries))
}
