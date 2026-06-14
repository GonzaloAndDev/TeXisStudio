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

/// Compiles a standalone preview for a single plugin figure using the
/// specified backend ("tectonic" or "latexmk"). Returns the absolute path
/// to the generated `preview.pdf`.
#[tauri::command]
pub async fn compile_snippet_preview(
    project_path: String,
    figure_id: String,
    backend: String,
) -> Result<String, String> {
    if !safe_figure_id(&figure_id) {
        return Err(format!("figureId inválido: '{figure_id}'"));
    }

    let dir = figure_dir(&project_path, &figure_id);

    let tex_content = std::fs::read_to_string(dir.join("output.tex"))
        .map_err(|e| format!("No se pudo leer output.tex: {e}"))?;

    let manifest_raw =
        std::fs::read_to_string(dir.join("manifest.json")).unwrap_or_else(|_| "{}".to_string());
    let manifest: Value =
        serde_json::from_str(&manifest_raw).unwrap_or(Value::Object(Default::default()));
    let packages: Vec<String> = manifest["requiredPackages"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    // Build preamble: amsmath always first, then figure packages
    let mut preamble = String::from("\\usepackage{amsmath}\n");
    for pkg in &packages {
        let pkg = pkg.trim();
        if pkg.is_empty() || pkg == "amsmath" {
            continue;
        }
        preamble.push_str(&format!("\\usepackage{{{pkg}}}\n"));
        if pkg == "pgfplots" {
            preamble.push_str("\\pgfplotsset{compat=1.18}\n");
        }
    }

    let doc = format!(
        "\\documentclass[border=4pt]{{standalone}}\n{preamble}\\begin{{document}}\n{tex_content}\n\\end{{document}}\n"
    );

    let preview_tex = dir.join("preview.tex");
    std::fs::write(&preview_tex, &doc).map_err(err)?;

    let preview_pdf = dir.join("preview.pdf");
    let dir_clone = dir.clone();
    let tex_clone = preview_tex.clone();

    tokio::task::spawn_blocking(move || {
        let output = if backend == "latexmk" {
            std::process::Command::new("latexmk")
                .arg("-pdf")
                .arg("-interaction=nonstopmode")
                .arg("-halt-on-error")
                .arg(format!("-outdir={}", dir_clone.display()))
                .arg(&tex_clone)
                .current_dir(&dir_clone)
                .output()
                .map_err(|e| format!("No se pudo ejecutar latexmk: {e}"))?
        } else {
            std::process::Command::new("tectonic")
                .arg("--outdir")
                .arg(&dir_clone)
                .arg(&tex_clone)
                .output()
                .map_err(|e| format!("No se pudo ejecutar Tectonic: {e}"))?
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let detail = if stderr.trim().is_empty() {
                stdout
            } else {
                stderr
            };
            return Err(format!(
                "{} falló:\n{detail}",
                if backend == "latexmk" {
                    "latexmk"
                } else {
                    "Tectonic"
                }
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Error interno: {e}"))??;

    Ok(preview_pdf.to_string_lossy().into_owned())
}
