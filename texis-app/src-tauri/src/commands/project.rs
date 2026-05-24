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
    validate_safe_name(&name)?;
    validate_profile_id(&profile_id)?;

    let output = PathBuf::from(&output_path);
    let project_dir = output.join(&name);

    if project_dir.exists() {
        return Err(format!(
            "El directorio '{}' ya existe.",
            project_dir.display()
        ));
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
pub fn save_section(project_path: String, section_id: String, blocks: Value) -> Result<(), String> {
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

    model.updated_at = now_iso8601();

    let saver = ProjectSaver;
    saver.save_to_file(&model, &yaml_path).map_err(err)?;

    // Regenerar los archivos LaTeX de la sección modificada
    let build_dir = PathBuf::from(&project_path).join("build");
    let latex_gen = LaTeXGenerator::new().map_err(err)?;
    latex_gen.generate(&model, &build_dir).map_err(err)?;

    Ok(())
}

/// Guarda el modelo completo del proyecto (metadatos + secciones) y regenera build/.
#[tauri::command]
pub fn save_project(project_path: String, project: Value) -> Result<(), String> {
    let yaml_path = PathBuf::from(&project_path).join("tesis.project.yaml");
    let mut model: ProjectModel = serde_json::from_value(project).map_err(err)?;
    model.updated_at = now_iso8601();
    let saver = ProjectSaver;
    saver.save_to_file(&model, &yaml_path).map_err(err)?;
    // Regenerar build/ con metadatos actualizados
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

/// Lista las entradas del archivo .bib del proyecto (content/bibliography/references.bib).
#[tauri::command]
pub fn list_references(project_path: String) -> Result<Value, String> {
    use texis_core::bibliography::parser::BibParser;

    let bib_path = PathBuf::from(&project_path)
        .join("content")
        .join("bibliography")
        .join("references.bib");

    if !bib_path.exists() {
        // Sin archivo .bib — devolver lista vacía, no un error
        return Ok(serde_json::json!([]));
    }

    let parser = BibParser;
    let entries = parser.parse_file(&bib_path).map_err(err)?;

    let result: Vec<Value> = entries.iter().map(|e| {
        serde_json::json!({
            "key":        e.key,
            "entry_type": e.entry_type,
            "title":      e.title(),
            "author":     e.author(),
            "year":       e.year(),
            "journal":    e.fields.get("journal").or_else(|| e.fields.get("booktitle")).map(|s| s.as_str()).unwrap_or(""),
        })
    }).collect();

    Ok(serde_json::json!(result))
}

fn build_default_model(name: &str, profile_id: &str) -> ProjectModel {
    use std::collections::HashMap;
    use texis_core::project::model::*;

    ProjectModel {
        id: format!("{}-001", name.to_lowercase().replace(' ', "-")),
        schema_version: texis_core::schema::versions::CURRENT_SCHEMA_VERSION.to_string(),
        created_at: now_iso8601(),
        updated_at: now_iso8601(),
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
            advisors: vec![],
            co_authors: vec![],
        },
        profile_id: profile_id.to_string(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: "book".to_string(),
                options: vec![
                    "12pt".to_string(),
                    "letterpaper".to_string(),
                    "oneside".to_string(),
                ],
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

fn now_iso8601() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Valida que un nombre de proyecto sea seguro para usarse como carpeta.
/// Rechaza: vacío, demasiado largo, separadores de ruta, `..`,
/// caracteres inválidos en Windows y nombres reservados del sistema.
fn validate_safe_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("El nombre del proyecto no puede estar vacío.".to_string());
    }
    if name.len() > 200 {
        return Err("El nombre del proyecto es demasiado largo (máximo 200 caracteres).".to_string());
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("El nombre del proyecto no puede contener separadores de ruta ni '..'.".to_string());
    }
    for c in &['<', '>', ':', '"', '|', '?', '*', '\0'] {
        if name.contains(*c) {
            return Err(format!("El nombre del proyecto contiene el carácter no permitido '{}'.", c));
        }
    }
    // Nombres reservados de Windows (CON, NUL, COM1…COM9, LPT1…LPT9, etc.)
    let stem = name.split('.').next().unwrap_or(name).to_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL",
        "COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
        "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9",
    ];
    if reserved.contains(&stem.as_str()) {
        return Err(format!("'{}' es un nombre reservado del sistema operativo.", name));
    }
    Ok(())
}

/// Valida que un profile_id solo contenga caracteres alfanuméricos, guiones y
/// guiones bajos, sin separadores de ruta ni traversal.
fn validate_profile_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("El ID de perfil no puede estar vacío.".to_string());
    }
    if id.len() > 100 {
        return Err("El ID de perfil es demasiado largo (máximo 100 caracteres).".to_string());
    }
    if !id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err(format!(
            "El ID de perfil '{}' contiene caracteres no permitidos. Solo se permiten letras, números, '_' y '-'.",
            id
        ));
    }
    Ok(())
}
