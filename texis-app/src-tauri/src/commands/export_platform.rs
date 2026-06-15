// Comando Tauri: exportar proyecto a plataformas externas.

use serde::Serialize;
use std::path::PathBuf;
use texis_core::{
    exporter::{export_for_platform, ExportTarget, PlatformExportInput},
    project::{loader::ProjectLoader, model::ProjectModel},
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Serialize)]
pub struct PlatformExportSummary {
    /// Ruta absoluta al artefacto generado (carpeta o ZIP).
    pub artifact_path: String,
    /// URL de documentación del destino (Overleaf, TeXstudio, LaTeX Workshop).
    pub info_url: Option<String>,
    /// Clave de i18n para la nota post-export que se muestra en la UI.
    pub note_key: String,
}

/// Exporta el proyecto al formato de la plataforma destino.
///
/// `project_path`: ruta absoluta al directorio del proyecto.
/// `output_dir`: directorio donde se dejará el artefacto exportado.
/// `target`: "overleaf" | "te_x_studio" | "vs_code" | "local"
///   (serde snake_case: overleaf, te_x_studio, vs_code, local)
#[tauri::command]
pub fn export_for_target(
    project_path: String,
    output_dir: String,
    target: ExportTarget,
) -> Result<PlatformExportSummary, String> {
    let project_dir = PathBuf::from(&project_path);
    if !project_dir.exists() {
        return Err(format!("El directorio del proyecto no existe: {project_path}"));
    }

    let out_dir = PathBuf::from(&output_dir);
    std::fs::create_dir_all(&out_dir).map_err(err)?;

    let project_yaml = project_dir.join("tesis.project.yaml");
    let model: ProjectModel = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    let input = PlatformExportInput {
        project_dir: &project_dir,
        model: &model,
        output_dir: &out_dir,
        target,
    };

    let result = export_for_platform(&input).map_err(err)?;

    Ok(PlatformExportSummary {
        artifact_path: result.artifact_path.to_string_lossy().into_owned(),
        info_url: result.info_url.map(str::to_string),
        note_key: result.note_key.to_string(),
    })
}
