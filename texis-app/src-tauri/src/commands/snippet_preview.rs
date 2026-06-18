use serde_json::Value;
use std::path::{Path, PathBuf};

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

/// Reads the figure's required packages from manifest.json (best-effort).
fn read_required_packages(dir: &Path) -> Vec<String> {
    let manifest_raw =
        std::fs::read_to_string(dir.join("manifest.json")).unwrap_or_else(|_| "{}".to_string());
    let manifest: Value =
        serde_json::from_str(&manifest_raw).unwrap_or(Value::Object(Default::default()));
    manifest["requiredPackages"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// Wraps a bare figure body in a minimal `standalone` document with the
/// figure's required packages (amsmath always first).
fn wrap_standalone(body: &str, packages: &[String]) -> String {
    let mut preamble = String::from("\\usepackage{amsmath}\n");
    for pkg in packages {
        let pkg = pkg.trim();
        if pkg.is_empty() || pkg == "amsmath" {
            continue;
        }
        preamble.push_str(&format!("\\usepackage{{{pkg}}}\n"));
        if pkg == "pgfplots" {
            preamble.push_str("\\pgfplotsset{compat=1.18}\n");
        }
    }
    format!(
        "\\documentclass[border=4pt]{{standalone}}\n{preamble}\\begin{{document}}\n{body}\n\\end{{document}}\n"
    )
}

/// Runs the chosen backend on `tex_path`, writing output into `out_dir`.
/// Returns the compiler's error output on failure.
fn run_backend(backend: &str, out_dir: &Path, tex_path: &Path) -> Result<(), String> {
    let output = if backend == "latexmk" {
        std::process::Command::new("latexmk")
            .arg("-pdf")
            .arg("-interaction=nonstopmode")
            .arg("-halt-on-error")
            .arg(format!("-outdir={}", out_dir.display()))
            .arg(tex_path)
            .current_dir(out_dir)
            .output()
            .map_err(|e| format!("No se pudo ejecutar latexmk: {e}"))?
    } else {
        std::process::Command::new("tectonic")
            .arg("--outdir")
            .arg(out_dir)
            .arg(tex_path)
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
        let name = if backend == "latexmk" {
            "latexmk"
        } else {
            "Tectonic"
        };
        return Err(format!("{name} falló:\n{detail}"));
    }
    Ok(())
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
    let packages = read_required_packages(&dir);
    let doc = wrap_standalone(&tex_content, &packages);

    let preview_tex = dir.join("preview.tex");
    std::fs::write(&preview_tex, &doc).map_err(err)?;

    let preview_pdf = dir.join("preview.pdf");
    let dir_clone = dir.clone();

    let preview_tex_clone = preview_tex.clone();
    tokio::task::spawn_blocking(move || run_backend(&backend, &dir_clone, &preview_tex_clone))
        .await
        .map_err(|e| format!("Error interno: {e}"))??;

    Ok(preview_pdf.to_string_lossy().into_owned())
}

/// Validates a hand-edited figure body by compiling it in a standalone
/// document **without** touching output.tex or preview.pdf. Returns Ok(())
/// if it compiles, or the compiler error otherwise. Temporary artifacts are
/// cleaned up afterwards.
#[tauri::command]
pub async fn validate_figure_snippet(
    project_path: String,
    figure_id: String,
    tex_body: String,
    backend: String,
) -> Result<(), String> {
    if !safe_figure_id(&figure_id) {
        return Err(format!("figureId inválido: '{figure_id}'"));
    }

    let dir = figure_dir(&project_path, &figure_id);
    if !dir.exists() {
        return Err("La figura no existe en disco.".to_string());
    }
    let packages = read_required_packages(&dir);
    let doc = wrap_standalone(&tex_body, &packages);

    let validate_tex = dir.join("_validate.tex");
    std::fs::write(&validate_tex, &doc).map_err(err)?;
    let dir_clone = dir.clone();
    let tex_clone = validate_tex.clone();

    let result = tokio::task::spawn_blocking(move || run_backend(&backend, &dir_clone, &tex_clone))
        .await
        .map_err(|e| format!("Error interno: {e}"))?;

    // Clean up temp artifacts regardless of outcome.
    for ext in ["tex", "pdf", "aux", "log", "fls", "fdb_latexmk"] {
        let _ = std::fs::remove_file(dir.join(format!("_validate.{ext}")));
    }

    result
}
