// Comandos Tauri para el Template Engine

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use texis_core::template_engine::engine::TemplateEngine;
use texis_core::template_engine::model::ProjectTemplate;
use texis_core::texis_project::model::{DocumentTypeHint, ProjectAuthor, ProjectMetadata};

#[derive(Serialize)]
pub struct TemplateInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub document_type: String,
    pub compatible_profiles: Vec<String>,
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub template_id: String,
    pub destination: String,
    pub title: String,
    pub language: String,
    pub author_name: Option<String>,
    pub institution: Option<String>,
}

/// Retorna todas las plantillas disponibles.
#[tauri::command]
pub fn list_templates() -> Vec<TemplateInfo> {
    TemplateEngine::available_templates()
        .into_iter()
        .map(template_to_info)
        .collect()
}

/// Crea un nuevo proyecto desde una plantilla.
#[tauri::command]
pub fn create_project_from_template(
    request: CreateProjectRequest,
) -> Result<serde_json::Value, String> {
    let template = TemplateEngine::find_template(&request.template_id)
        .ok_or_else(|| format!("Plantilla '{}' no encontrada.", request.template_id))?;

    let destination = PathBuf::from(&request.destination);
    if destination.exists() && destination.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false) {
        return Err(format!(
            "El directorio '{}' ya existe y no está vacío.",
            request.destination
        ));
    }

    let mut metadata = ProjectMetadata {
        title: request.title,
        language: request.language,
        institution: request.institution,
        ..Default::default()
    };

    if let Some(name) = request.author_name {
        metadata.authors.push(ProjectAuthor {
            name,
            email: None,
            orcid: None,
            affiliation: None,
        });
    }

    let project = TemplateEngine::instantiate(&template, &destination, &metadata)
        .map_err(|e| format!("Error al crear proyecto: {e}"))?;

    Ok(serde_json::json!({
        "id": project.id.to_string(),
        "root_path": project.root_path.display().to_string(),
        "root_file": project.root_file.display().to_string(),
        "title": project.metadata.title,
        "language": project.metadata.language,
        "engine": project.build_config.engine.to_string(),
    }))
}

fn template_to_info(t: ProjectTemplate) -> TemplateInfo {
    let doc_type = match t.document_type {
        DocumentTypeHint::Thesis => "thesis",
        DocumentTypeHint::Article => "article",
        DocumentTypeHint::Book => "book",
        DocumentTypeHint::TechnicalManual => "manual",
        DocumentTypeHint::Report => "report",
        DocumentTypeHint::Cv => "cv",
        DocumentTypeHint::Letter => "letter",
        DocumentTypeHint::Other => "other",
    };
    TemplateInfo {
        id: t.id,
        name: t.name,
        description: t.description,
        version: t.version,
        document_type: doc_type.to_string(),
        compatible_profiles: t.compatible_profiles,
    }
}
