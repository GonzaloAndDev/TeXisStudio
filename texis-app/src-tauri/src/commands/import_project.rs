// Comando Tauri: importar proyecto LaTeX desde carpeta externa.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use texis_core::importer::{import_from_folder, ImportOptions, ImportSourcePlatform};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Parámetros de importación que llegan desde el frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProjectParams {
    /// Carpeta que contiene los archivos .tex originales.
    pub source_dir: String,
    /// Carpeta de trabajo donde se creará la estructura TeXisStudio.
    pub work_dir: String,
    /// Plataforma de origen: "overleaf" | "texstudio" | "miktex" | "texlive" | "vscode" | "other"
    pub source_platform: String,
    /// Nombre del archivo raíz (opcional, para proyectos sin main.tex obvio).
    pub main_file_hint: Option<String>,
    /// Si es true, sobreescribe el work_dir aunque no esté vacío.
    #[serde(default)]
    pub overwrite: bool,
}

/// Resultado de la importación que se envía al frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProjectResult {
    /// Ruta al `tesis.project.yaml` generado.
    pub project_file: String,
    /// Avisos no fatales (archivos no encontrados, entornos de plugin detectados, etc.)
    pub warnings: Vec<String>,
    /// Número de figuras copiadas.
    pub figures_copied: usize,
    /// Número de archivos .bib copiados.
    pub bibs_copied: usize,
}

/// Importa un proyecto LaTeX externo a la estructura de trabajo TeXisStudio.
#[tauri::command]
pub fn import_from_source(params: ImportProjectParams) -> Result<ImportProjectResult, String> {
    let source_dir = PathBuf::from(&params.source_dir);
    let work_dir = PathBuf::from(&params.work_dir);

    if !source_dir.exists() {
        return Err(format!(
            "La carpeta de origen no existe: {}",
            params.source_dir
        ));
    }

    let source_platform = parse_platform(&params.source_platform);
    let options = ImportOptions {
        source_platform,
        main_file_hint: params.main_file_hint,
        overwrite: params.overwrite,
    };

    let result = import_from_folder(&source_dir, &work_dir, &options).map_err(err)?;

    Ok(ImportProjectResult {
        project_file: result.project_file.to_string_lossy().into_owned(),
        warnings: result.warnings,
        figures_copied: result.figures_copied,
        bibs_copied: result.bibs_copied,
    })
}

fn parse_platform(s: &str) -> ImportSourcePlatform {
    match s {
        "overleaf" => ImportSourcePlatform::Overleaf,
        "texstudio" => ImportSourcePlatform::TeXstudio,
        "miktex" => ImportSourcePlatform::MikTeX,
        "texlive" => ImportSourcePlatform::TexLive,
        "vscode" => ImportSourcePlatform::VsCode,
        _ => ImportSourcePlatform::Other,
    }
}
