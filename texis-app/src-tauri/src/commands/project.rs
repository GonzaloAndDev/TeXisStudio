use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;
use texis_core::{
    profile::{model::Profile, ProfileRegistry},
    project::{loader::ProjectLoader, model::ProjectModel, saver::ProjectSaver},
    validator::Validator,
    LaTeXGenerator,
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Crea un nuevo proyecto cargando el perfil real desde el directorio de perfiles.
#[tauri::command]
pub fn create_project(
    app: tauri::AppHandle,
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

    // Cargar el perfil real desde el directorio de perfiles
    let prof_dir = profiles_dir_for_app(&app);
    let mut registry = ProfileRegistry::new();
    registry.load_from_dir(&prof_dir).map_err(err)?;
    let profile = registry
        .get(&profile_id)
        .ok_or_else(|| format!(
            "Perfil '{}' no encontrado en {}.",
            profile_id,
            prof_dir.display()
        ))?
        .clone();

    // Crear estructura de directorios
    std::fs::create_dir_all(project_dir.join("content").join("sections")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("bibliography")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("figures")).map_err(err)?;

    let model = build_model_from_profile(&name, &profile);
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
        "sections_count": model.sections.len(),
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

// ── Snapshots ─────────────────────────────────────────────────────

/// Crea un snapshot (copia nombrada) del proyecto en su estado actual.
/// El archivo se guarda en `<project>/snapshots/<timestamp>_<label>.project.yaml`.
#[tauri::command]
pub fn create_snapshot(project_path: String, label: String) -> Result<Value, String> {
    let label_clean = sanitize_snapshot_label(&label);
    if label_clean.is_empty() {
        return Err("La etiqueta del snapshot no puede estar vacía.".to_string());
    }

    let project_dir = PathBuf::from(&project_path);
    let src = project_dir.join("tesis.project.yaml");
    if !src.exists() {
        return Err("No se encontró tesis.project.yaml en el directorio del proyecto.".to_string());
    }

    let snapshots_dir = project_dir.join("snapshots");
    std::fs::create_dir_all(&snapshots_dir).map_err(err)?;

    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let filename = format!("{}_{}.project.yaml", timestamp, label_clean);
    let dest = snapshots_dir.join(&filename);

    std::fs::copy(&src, &dest).map_err(err)?;

    Ok(serde_json::json!({
        "filename": filename,
        "label": label,
        "created_at": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Devuelve la lista de snapshots del proyecto, ordenados por nombre (más reciente primero).
#[tauri::command]
pub fn list_snapshots(project_path: String) -> Result<Value, String> {
    let snapshots_dir = PathBuf::from(&project_path).join("snapshots");

    if !snapshots_dir.exists() {
        return Ok(serde_json::json!([]));
    }

    let mut entries: Vec<Value> = std::fs::read_dir(&snapshots_dir)
        .map_err(err)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x == "yaml")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let filename = e.file_name().to_string_lossy().to_string();
            // Extraer label desde el nombre: <timestamp>_<label>.project.yaml
            let stem = filename.strip_suffix(".project.yaml")?;
            let (ts, label) = stem.split_once('_').unwrap_or((stem, ""));
            Some(serde_json::json!({
                "filename": filename,
                "timestamp": ts,
                "label": label,
            }))
        })
        .collect();

    // Ordenar más reciente primero (por nombre, que tiene el timestamp al inicio)
    entries.sort_by(|a, b| {
        b["filename"].as_str().unwrap_or("").cmp(a["filename"].as_str().unwrap_or(""))
    });

    Ok(serde_json::json!(entries))
}

/// Restaura el proyecto a un snapshot.
/// Antes de sobreescribir, crea automáticamente un snapshot de "pre-restauración".
#[tauri::command]
pub fn restore_snapshot(project_path: String, snapshot_filename: String) -> Result<(), String> {
    // Seguridad: el nombre no puede contener separadores de ruta
    if snapshot_filename.contains('/') || snapshot_filename.contains('\\') || snapshot_filename.contains("..") {
        return Err("Nombre de snapshot inválido.".to_string());
    }

    let project_dir = PathBuf::from(&project_path);
    let snapshots_dir = project_dir.join("snapshots");
    let snapshot_path = snapshots_dir.join(&snapshot_filename);

    if !snapshot_path.exists() {
        return Err(format!("El snapshot '{}' no existe.", snapshot_filename));
    }

    let current = project_dir.join("tesis.project.yaml");

    // Backup automático del estado actual antes de restaurar
    if current.exists() {
        let ts = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
        let pre_restore = snapshots_dir.join(format!("{}_pre-restauracion.project.yaml", ts));
        std::fs::create_dir_all(&snapshots_dir).map_err(err)?;
        std::fs::copy(&current, &pre_restore).map_err(err)?;
    }

    std::fs::copy(&snapshot_path, &current).map_err(err)?;
    Ok(())
}

/// Elimina un snapshot del proyecto.
#[tauri::command]
pub fn delete_snapshot(project_path: String, snapshot_filename: String) -> Result<(), String> {
    if snapshot_filename.contains('/') || snapshot_filename.contains('\\') || snapshot_filename.contains("..") {
        return Err("Nombre de snapshot inválido.".to_string());
    }

    let path = PathBuf::from(&project_path)
        .join("snapshots")
        .join(&snapshot_filename);

    if !path.exists() {
        return Err(format!("El snapshot '{}' no existe.", snapshot_filename));
    }

    std::fs::remove_file(&path).map_err(err)?;
    Ok(())
}

/// Actualiza los ajustes tipográficos del proyecto (fuente, papel, interlineado, márgenes).
#[tauri::command]
pub fn update_typography(
    project_path: String,
    font_size:    Option<String>,
    paper_size:   Option<String>,
    line_spacing: Option<String>,
    margin_cm:    Option<f32>,
) -> Result<(), String> {
    use texis_core::project::model::LatexTypography;

    let project_yaml = std::path::Path::new(&project_path).join("tesis.project.yaml");
    let mut model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    model.latex_config.typography = LatexTypography {
        font_size,
        paper_size,
        line_spacing,
        margin_cm,
    };

    ProjectSaver.save_to_file(&model, &project_yaml).map_err(err)
}

/// Actualiza el estado editorial y las notas internas de una sección.
/// No toca los bloques ni los campos; solo status y notes.
#[tauri::command]
pub fn update_section_meta(
    project_path: String,
    section_id: String,
    status: String,
    notes: Option<String>,
) -> Result<(), String> {
    use texis_core::project::model::SectionStatus;
    use texis_core::project::model::ProjectSection;

    fn apply(sections: &mut Vec<ProjectSection>, id: &str, status: &SectionStatus, notes: &Option<String>) -> bool {
        for s in sections.iter_mut() {
            if s.id == id {
                s.status = status.clone();
                s.notes  = notes.clone();
                return true;
            }
            if apply(&mut s.children, id, status, notes) {
                return true;
            }
        }
        false
    }

    let new_status = match status.as_str() {
        "in_review" => SectionStatus::InReview,
        "revised"   => SectionStatus::Revised,
        "approved"  => SectionStatus::Approved,
        _           => SectionStatus::Draft,
    };

    let path = std::path::Path::new(&project_path);
    let project_yaml = path.join("tesis.project.yaml");
    let mut model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    if !apply(&mut model.sections, &section_id, &new_status, &notes) {
        return Err(format!("Sección '{}' no encontrada", section_id));
    }

    ProjectSaver.save_to_file(&model, &project_yaml).map_err(err)
}

/// Sanitiza la etiqueta de un snapshot para usarla como parte del nombre de archivo.
fn sanitize_snapshot_label(label: &str) -> String {
    label
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else if c == ' ' {
                '-'
            } else {
                '_'
            }
        })
        .take(60)
        .collect::<String>()
        .trim_matches(['-', '_'].as_ref())
        .to_string()
}

/// Construye el directorio de perfiles para una app handle dada.
/// (Misma lógica que system.rs — producción primero, luego dev.)
fn profiles_dir_for_app(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("profiles");
        if p.exists() {
            return p;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|root| root.join("profiles"))
        .unwrap_or_else(|| PathBuf::from("profiles"))
}

/// Construye un ProjectModel con los datos del perfil real.
/// Metadatos del estudiante/institución se dejan con valores por defecto
/// para que el usuario los rellene después desde la UI.
fn build_model_from_profile(name: &str, profile: &Profile) -> ProjectModel {
    use std::collections::HashMap;
    use texis_core::project::model::*;

    let map_placement = |s: &str| -> SectionPlacement {
        match s {
            "front_matter" => SectionPlacement::FrontMatter,
            "back_matter"  => SectionPlacement::BackMatter,
            "appendix"     => SectionPlacement::Appendix,
            _              => SectionPlacement::Body,
        }
    };

    let engine = match profile.latex_engine.as_str() {
        "pdflatex" => LatexEngine::Pdflatex,
        "lualatex" => LatexEngine::Lualatex,
        _          => LatexEngine::Xelatex,
    };

    let compiler = match profile.compiler.as_str() {
        "tectonic" => CompilerKind::Tectonic,
        _          => CompilerKind::Latexmk,
    };

    let bib_backend = match profile.bibliography_backend.as_str() {
        "bibtex" => BibliographyBackend::Bibtex,
        _        => BibliographyBackend::Biber,
    };

    let sections = profile
        .sections
        .iter()
        .map(|s| ProjectSection {
            id:         s.id.clone(),
            element_id: s.element_id.clone(),
            title:      s.title.clone(),
            placement:  map_placement(&s.placement),
            required:   s.required,
            enabled:    true,
            label:      s.label.clone(),
            status:     SectionStatus::Draft,
            notes:      None,
            blocks:     vec![],
            fields:     HashMap::new(),
            children:   vec![],
        })
        .collect();

    ProjectModel {
        id: format!("{}-001", name.to_lowercase().replace(' ', "-")),
        schema_version: texis_core::schema::versions::CURRENT_SCHEMA_VERSION.to_string(),
        created_at: now_iso8601(),
        updated_at: now_iso8601(),
        metadata: ProjectMetadata {
            title:          name.to_string(),
            subtitle:       None,
            document_kind:  DocumentKind::Tesis,
            academic_level: AcademicLevel::Licenciatura,
            language:       "es".to_string(),
            city:           "Ciudad de México".to_string(),
            year:           chrono::Utc::now().format("%Y").to_string().parse().unwrap_or(2026),
            keywords:       vec![],
        },
        institution: InstitutionData {
            name:       "Universidad".to_string(),
            faculty:    None,
            department: None,
            logo_path:  None,
            country:    "México".to_string(),
        },
        student: StudentData {
            full_name:  "Autor".to_string(),
            student_id: None,
            email:      None,
            advisor:    None,
            co_advisor: None,
            advisors:   vec![],
            co_authors: vec![],
        },
        profile_id: profile.id.clone(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name:    profile.document_class.name.clone(),
                options: profile.document_class.options.clone(),
            },
            engine,
            compiler,
            bibliography_backend: bib_backend,
            bibliography_style:   profile.bibliography_style.clone(),
            packages_required:    profile.packages.clone(),
            typography:           Default::default(),
        },
        sections,
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
    // Windows trata mal los nombres que terminan en punto o espacio
    if name.ends_with('.') {
        return Err("El nombre del proyecto no puede terminar en punto.".to_string());
    }
    if name.ends_with(' ') {
        return Err("El nombre del proyecto no puede terminar en espacio.".to_string());
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("El nombre del proyecto no puede contener separadores de ruta ni '..'.".to_string());
    }
    // Caracteres inválidos en Windows y caracteres de control
    for c in name.chars() {
        if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*') {
            return Err(format!(
                "El nombre del proyecto contiene el carácter no permitido {:?}.", c
            ));
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

#[cfg(test)]
mod tests_validation {
    use super::*;

    // ── validate_profile_id ───────────────────────────────────────
    #[test]
    fn profile_id_validos() {
        for id in &["generic.thesis", "apa7.basic", "vancouver.health", "mx_unam_apa7", "a", "A1-b"] {
            assert!(validate_profile_id(id).is_ok(), "debería ser válido: {}", id);
        }
    }

    #[test]
    fn profile_id_traversal_rechazado() {
        for id in &["../x", "a/../b", "a..b"] {
            assert!(validate_profile_id(id).is_err(), "debería ser inválido: {}", id);
        }
    }

    #[test]
    fn profile_id_separadores_rechazados() {
        assert!(validate_profile_id("a/b").is_err());
        assert!(validate_profile_id("a\\b").is_err());
    }

    #[test]
    fn profile_id_empieza_con_punto_rechazado() {
        assert!(validate_profile_id(".hidden").is_err());
    }

    #[test]
    fn profile_id_vacio_rechazado() {
        assert!(validate_profile_id("").is_err());
    }

    // ── validate_safe_name ────────────────────────────────────────
    #[test]
    fn name_validos() {
        for name in &["Mi Tesis", "Tesis2026", "tesis-final", "proyecto.v2"] {
            assert!(validate_safe_name(name).is_ok(), "debería ser válido: {}", name);
        }
    }

    #[test]
    fn name_trailing_punto_rechazado() {
        assert!(validate_safe_name("tesis.").is_err());
    }

    #[test]
    fn name_trailing_espacio_rechazado() {
        assert!(validate_safe_name("tesis ").is_err());
    }

    #[test]
    fn name_reservados_windows_rechazados() {
        for name in &["CON", "NUL", "COM1", "LPT9", "con.txt", "nul.yaml"] {
            assert!(validate_safe_name(name).is_err(), "reservado debería rechazarse: {}", name);
        }
    }

    #[test]
    fn name_chars_invalidos_rechazados() {
        for name in &["tesis<v>", "my:project", "tesis|final", "test*"] {
            assert!(validate_safe_name(name).is_err(), "char inválido debería rechazarse: {}", name);
        }
    }
}

/// Valida que un profile_id sea seguro para usarse como nombre de directorio.
/// Permite: letras, números, `_`, `-`, `.` — pero NO `..`, `/` ni `\`.
fn validate_profile_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("El ID de perfil no puede estar vacío.".to_string());
    }
    if id.len() > 100 {
        return Err("El ID de perfil es demasiado largo (máximo 100 caracteres).".to_string());
    }
    // Rechazar traversal explícitamente antes del check de chars
    if id.contains("..") || id.contains('/') || id.contains('\\') {
        return Err("El ID de perfil no puede contener '..', '/' ni '\\'.".to_string());
    }
    if !id.chars().next().map(|c| c.is_alphanumeric()).unwrap_or(false) {
        return Err("El ID de perfil debe empezar con una letra o número.".to_string());
    }
    if !id.chars().all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.')) {
        return Err(format!(
            "El ID de perfil '{}' contiene caracteres no permitidos. Solo se permiten letras, números, '_', '-' y '.'.",
            id
        ));
    }
    Ok(())
}
