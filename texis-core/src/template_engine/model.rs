use crate::texis_project::model::DocumentTypeHint;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub type TemplateId = String;

/// Plantilla de proyecto — estructura inicial concreta.
/// Diferencia fundamental:
///   Perfil = reglas de validación y política institucional.
///   Plantilla = archivos, carpetas y configuración inicial.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTemplate {
    pub id: TemplateId,
    pub name: String,
    pub description: String,
    pub version: String,
    pub document_type: DocumentTypeHint,
    /// Perfiles con los que esta plantilla es compatible (IDs)
    pub compatible_profiles: Vec<String>,
    pub required_files: Vec<TemplateFile>,
    pub default_metadata: ProjectMetadataTemplate,
    pub default_build_config: TemplateBuildConfig,
    pub default_packages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateFile {
    /// Ruta relativa al root del proyecto
    pub relative_path: PathBuf,
    pub content: TemplateContent,
    /// Si es false, la app NUNCA toca este archivo después de crearlo
    pub is_app_managed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TemplateContent {
    /// Contenido fijo, tal cual
    Static(String),
    /// La app lo genera dinámicamente (main.tex, preamble.tex)
    Generated { generator: GeneratorKind },
    /// Archivo vacío con comentario orientativo
    Placeholder { hint: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GeneratorKind {
    MainTex,
    PreambleTex,
    MetadataTex,
    BibFile,
    GlossaryFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadataTemplate {
    pub title_placeholder: String,
    pub suggested_language: String,
    pub required_metadata_fields: Vec<String>,
}

impl Default for ProjectMetadataTemplate {
    fn default() -> Self {
        Self {
            title_placeholder: "Título del documento".to_string(),
            suggested_language: "es".to_string(),
            required_metadata_fields: vec!["title".to_string(), "authors".to_string()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateBuildConfig {
    pub engine: String,
    pub bibliography_tool: String,
    pub output_dir: String,
}

impl Default for TemplateBuildConfig {
    fn default() -> Self {
        Self {
            engine: "xelatex".to_string(),
            bibliography_tool: "biber".to_string(),
            output_dir: "build".to_string(),
        }
    }
}
