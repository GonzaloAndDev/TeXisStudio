use serde_json::Value;
use std::path::PathBuf;
use texis_core::{
    project::{loader::ProjectLoader, model::ProjectModel, saver::ProjectSaver},
    validator::Validator,
    LaTeXGenerator,
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Crea un nuevo proyecto con perfil dado en la ruta indicada.
#[tauri::command]
pub fn create_project(
    name: String,
    profile_id: String,
    output_path: String,
) -> Result<Value, String> {
    let output = PathBuf::from(&output_path);
    let project_dir = output.join(&name);

    if project_dir.exists() {
        return Err(format!("El directorio '{}' ya existe.", project_dir.display()));
    }

    // Crear estructura
    std::fs::create_dir_all(project_dir.join("content").join("sections")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("bibliography")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("figures")).map_err(err)?;

    let model = build_default_model(&name, &profile_id);
    let saver = ProjectSaver;
    saver
        .save_to_file(&model, &project_dir.join("tesis.project.yaml"))
        .map_err(err)?;

    let build_dir = project_dir.join("build");
    // Nota: no se nombra la variable 'gen' (reservado en edition 2024)
    let latex_gen = LaTeXGenerator::new().map_err(err)?;
    latex_gen.generate(&model, &build_dir).map_err(err)?;

    Ok(serde_json::json!({
        "project_path": project_dir.to_string_lossy(),
        "name": name,
        "profile_id": profile_id,
    }))
}

/// Carga un proyecto desde su archivo .yaml.
#[tauri::command]
pub fn get_project(project_path: String) -> Result<Value, String> {
    let path = PathBuf::from(&project_path);
    let yaml_file = if path.is_dir() {
        path.join("tesis.project.yaml")
    } else {
        path
    };

    let loader = ProjectLoader;
    let model = loader.load_from_file(&yaml_file).map_err(err)?;
    serde_json::to_value(&model).map_err(err)
}

/// Lista proyectos recientes — busca archivos .project.yaml en el directorio dado.
#[tauri::command]
pub fn list_recent_projects(search_dir: String) -> Result<Value, String> {
    let dir = PathBuf::from(&search_dir);
    let mut projects = Vec::new();

    if dir.exists() {
        for entry in walkdir::WalkDir::new(&dir)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.file_name().and_then(|n| n.to_str()) == Some("tesis.project.yaml") {
                if let Ok(loader) = {
                    let loader = ProjectLoader;
                    loader.load_from_file(path).map(|m| {
                        serde_json::json!({
                            "path": path.parent().unwrap_or(path).to_string_lossy(),
                            "title": m.metadata.title,
                            "profile_id": m.profile_id,
                            "academic_level": format!("{:?}", m.metadata.academic_level),
                            "updated_at": m.updated_at,
                        })
                    })
                } {
                    projects.push(loader);
                }
            }
        }
    }

    Ok(serde_json::json!(projects))
}

/// Guarda los bloques de contenido de una sección.
#[tauri::command]
pub fn save_section(
    project_path: String,
    section_id: String,
    blocks: Value,
) -> Result<(), String> {
    let yaml_path = PathBuf::from(&project_path).join("tesis.project.yaml");
    let loader = ProjectLoader;
    let mut model = loader.load_from_file(&yaml_path).map_err(err)?;

    let section = model
        .sections
        .iter_mut()
        .find(|s| s.id == section_id)
        .ok_or_else(|| format!("Sección '{}' no encontrada.", section_id))?;

    // Deserializar los bloques desde JSON
    let new_blocks: Vec<texis_core::project::model::ContentBlock> =
        serde_json::from_value(blocks).map_err(err)?;
    section.blocks = new_blocks;
    section.enabled = true;

    let saver = ProjectSaver;
    saver.save_to_file(&model, &yaml_path).map_err(err)?;

    // Regenerar los archivos LaTeX de la sección modificada
    let build_dir = PathBuf::from(&project_path).join("build");
    let latex_gen = LaTeXGenerator::new().map_err(err)?;
    latex_gen.generate(&model, &build_dir).map_err(err)?;

    Ok(())
}

/// Valida el proyecto y devuelve el reporte de issues.
#[tauri::command]
pub fn validate_project(project_path: String) -> Result<Value, String> {
    let path = PathBuf::from(&project_path);
    let yaml_path = path.join("tesis.project.yaml");
    let loader = ProjectLoader;
    let model = loader.load_from_file(&yaml_path).map_err(err)?;

    let validator = Validator::new();
    let report = validator.validate(&model, &path).map_err(err)?;

    let issues: Vec<Value> = report
        .issues
        .iter()
        .map(|i| {
            serde_json::json!({
                "severity": format!("{:?}", i.severity),
                "code": i.code,
                "message": i.message,
                "suggestion": i.suggestion,
                "section_id": i.section_id,
            })
        })
        .collect();

    Ok(serde_json::json!({
        "has_errors": report.has_errors(),
        "issues": issues,
    }))
}

fn build_default_model(name: &str, profile_id: &str) -> ProjectModel {
    use std::collections::HashMap;
    use texis_core::project::model::*;

    ProjectModel {
        id: format!("{}-001", name.to_lowercase().replace(' ', "-")),
        schema_version: "0.1.0".to_string(),
        created_at: chrono_now(),
        updated_at: chrono_now(),
        metadata: ProjectMetadata {
            title: name.to_string(),
            subtitle: None,
            document_kind: DocumentKind::Tesis,
            academic_level: AcademicLevel::Licenciatura,
            language: "es".to_string(),
            city: "Ciudad de México".to_string(),
            year: 2026,
            keywords: vec![],
        },
        institution: InstitutionData {
            name: "Universidad".to_string(),
            faculty: None,
            department: None,
            logo_path: None,
            country: "México".to_string(),
        },
        student: StudentData {
            full_name: "Autor".to_string(),
            student_id: None,
            email: None,
            advisor: None,
            co_advisor: None,
        },
        profile_id: profile_id.to_string(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: "book".to_string(),
                options: vec!["12pt".to_string(), "letterpaper".to_string(), "oneside".to_string()],
            },
            engine: LatexEngine::Xelatex,
            compiler: CompilerKind::Latexmk,
            bibliography_backend: BibliographyBackend::Biber,
            bibliography_style: "apa".to_string(),
            packages_required: vec![],
        },
        sections: vec![
            ProjectSection {
                id: "title_page".to_string(),
                element_id: "title_page".to_string(),
                title: None,
                placement: SectionPlacement::FrontMatter,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "table_of_contents".to_string(),
                element_id: "table_of_contents".to_string(),
                title: None,
                placement: SectionPlacement::FrontMatter,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "introduction".to_string(),
                element_id: "introduction".to_string(),
                title: Some("Introducción".to_string()),
                placement: SectionPlacement::Body,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "methodology".to_string(),
                element_id: "methodology".to_string(),
                title: Some("Metodología".to_string()),
                placement: SectionPlacement::Body,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "results".to_string(),
                element_id: "results".to_string(),
                title: Some("Resultados".to_string()),
                placement: SectionPlacement::Body,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "conclusions".to_string(),
                element_id: "conclusions".to_string(),
                title: Some("Conclusiones".to_string()),
                placement: SectionPlacement::Body,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "references".to_string(),
                element_id: "references".to_string(),
                title: Some("Referencias".to_string()),
                placement: SectionPlacement::BackMatter,
                required: true,
                enabled: true,
                label: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
        ],
        file_states: HashMap::new(),
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // ISO 8601 básico
    let d = secs / 86400;
    let s = secs % 86400;
    let h = s / 3600;
    let m = (s % 3600) / 60;
    let sec = s % 60;
    let days_since_epoch = d;
    // Simple: just return epoch-based timestamp string
    let _ = (days_since_epoch, h, m, sec);
    format!("{}", secs)
}
