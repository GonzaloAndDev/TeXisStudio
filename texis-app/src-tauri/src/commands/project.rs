use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use texis_core::{
    document::DocumentEngine,
    events::EventBus,
    postflight::{check_pdf_visual_quality, PdfChecker},
    profile::{model::Profile, ProfileRegistry},
    project::{loader::ProjectLoader, model::ProjectModel, saver::ProjectSaver},
    validator::Validator,
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn core_err(e: texis_core::error::CoreError) -> String {
    crate::error_format::user_message(e)
}

/// Cuántos snapshots de plataforma se conservan por proyecto tras cada guardado.
const SAVE_SNAPSHOT_RETENTION: usize = 20;

/// Persiste el modelo del proyecto de forma **transaccional** vía `texis-platform`:
/// toma el lock del proyecto, registra la operación en el journal, hace un snapshot
/// del estado previo, escribe atómicamente y actualiza el manifiesto de integridad.
///
/// `regenerate` se ejecuta **dentro** de la transacción y **bajo el mismo lock**,
/// tras escribir el YAML (p. ej. regenerar `build/`). Si falla, se hace rollback
/// del YAML al estado previo: nunca queda el YAML nuevo con `build/` viejo, ni se
/// libera el lock entre el guardado y la regeneración (no hay carrera entre
/// ventanas sobre los archivos generados). Pasa `|| Ok(())` si no hay derivados.
///
/// Reemplaza la escritura directa de `ProjectSaver::save_to_file` en el flujo vivo
/// de la app, de modo que las garantías de la plataforma protegen guardados reales.
fn persist_model_transactional<F>(
    project_dir: &std::path::Path,
    yaml_path: &std::path::Path,
    model: &ProjectModel,
    regenerate: F,
) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String>,
{
    let yaml = ProjectSaver
        .to_yaml_string(model, yaml_path)
        .map_err(core_err)?;

    // El lock se libera automáticamente al salir del scope (Drop), tras incluir
    // la regeneración derivada dentro de su vigencia.
    let _lock = texis_platform::ProjectLock::acquire(project_dir).map_err(|e| match e {
        texis_platform::LockError::Held(info) => format!(
            "El proyecto está en uso por otra ventana o proceso (pid {} en {}). \
             Cierra la otra instancia e inténtalo de nuevo.",
            info.pid, info.host
        ),
        other => format!("No se pudo bloquear el proyecto: {other}"),
    })?;

    // Ruta relativa del yaml respecto a la raíz del proyecto (lo normal: el
    // propio nombre del archivo, ya que vive en la raíz).
    let rel = yaml_path
        .strip_prefix(project_dir)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "tesis.project.yaml".to_string());

    // El error de `regenerate` (String) se transporta a través de io::Error y se
    // recupera al final para no perder el mensaje original orientado al usuario.
    let mut regen_err: Option<String> = None;
    let regen_slot = &mut regen_err;
    texis_platform::transactional_save_with(
        project_dir,
        &[(rel, yaml.into_bytes())],
        SAVE_SNAPSHOT_RETENTION,
        || {
            regenerate().map_err(|msg| {
                *regen_slot = Some(msg);
                std::io::Error::other("regeneración de artefactos derivados falló")
            })
        },
    )
    .map_err(|e| regen_err.unwrap_or_else(|| format!("Guardado transaccional falló: {e}")))?;

    Ok(())
}

fn unique_build_work_dir(project_dir: &Path, label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    project_dir.join(format!(
        ".texisstudio-{label}-{}-{nanos}",
        std::process::id()
    ))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !src.exists() {
        return Ok(());
    }
    for entry in walkdir::WalkDir::new(src) {
        let entry = entry.map_err(std::io::Error::other)?;
        let rel = entry
            .path()
            .strip_prefix(src)
            .map_err(std::io::Error::other)?;
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

fn replace_build_from_staging<F>(
    project_dir: &Path,
    staging_dir: &Path,
    after_promote: F,
) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String>,
{
    let live_build = project_dir.join("build");
    let rollback_dir = unique_build_work_dir(project_dir, "build-rollback");

    if rollback_dir.exists() {
        std::fs::remove_dir_all(&rollback_dir).map_err(err)?;
    }

    let had_live_build = live_build.exists();
    if had_live_build {
        std::fs::rename(&live_build, &rollback_dir).map_err(err)?;
    }

    if let Err(e) = std::fs::rename(staging_dir, &live_build) {
        if had_live_build {
            let _ = std::fs::rename(&rollback_dir, &live_build);
        }
        return Err(e.to_string());
    }

    if let Err(e) = after_promote() {
        let _ = std::fs::remove_dir_all(&live_build);
        if had_live_build {
            let _ = std::fs::rename(&rollback_dir, &live_build);
        }
        return Err(e);
    }

    if had_live_build {
        std::fs::remove_dir_all(&rollback_dir).map_err(err)?;
    }
    Ok(())
}

/// Regenera `build/` de forma transaccional: copia el build vivo a un staging,
/// ejecuta `generate` sobre el staging, y solo entonces promueve el staging a
/// `build/` (con rollback al estado previo si la promoción o el guardado de
/// checksums falla). Así una regeneración a medias nunca deja `build/` roto.
/// Compartido por el flujo de guardado y por la compilación para que ambos den
/// la misma garantía.
pub(crate) fn regenerate_build_transactional<F>(
    project_dir: &Path,
    generate: F,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> Result<DocumentEngine, String>,
{
    let staging_dir = unique_build_work_dir(project_dir, "build-staging");
    if staging_dir.exists() {
        std::fs::remove_dir_all(&staging_dir).map_err(err)?;
    }

    let live_build = project_dir.join("build");
    if live_build.exists() {
        copy_dir_recursive(&live_build, &staging_dir).map_err(err)?;
    }

    let engine = match generate(&staging_dir) {
        Ok(engine) => engine,
        Err(e) => {
            let _ = std::fs::remove_dir_all(&staging_dir);
            return Err(e);
        }
    };

    let result = replace_build_from_staging(project_dir, &staging_dir, || {
        engine.save_checksums(project_dir).map_err(core_err)
    });
    if result.is_err() {
        let _ = std::fs::remove_dir_all(&staging_dir);
    }
    result
}

fn generate_new_document(model: &ProjectModel, project_dir: &Path) -> Result<(), String> {
    regenerate_build_transactional(project_dir, |build_dir| {
        let mut engine = DocumentEngine::new().map_err(core_err)?;
        engine
            .generate(model, build_dir, &EventBus::new())
            .map_err(core_err)?;
        Ok(engine)
    })
}

fn sync_document(model: &ProjectModel, project_dir: &Path) -> Result<(), String> {
    regenerate_build_transactional(project_dir, |build_dir| {
        let mut engine = DocumentEngine::load(project_dir).map_err(core_err)?;
        engine
            .sync_preserving_external_edits(model, build_dir, None, None, &EventBus::new())
            .map_err(core_err)?;
        Ok(engine)
    })
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
        .ok_or_else(|| {
            format!(
                "Perfil '{}' no encontrado en {}.",
                profile_id,
                prof_dir.display()
            )
        })?
        .clone();

    // Crear estructura de directorios
    std::fs::create_dir_all(project_dir.join("content").join("sections")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("bibliography")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("figures")).map_err(err)?;

    let model = build_model_from_profile(&name, &profile);
    persist_model_transactional(
        &project_dir,
        &project_dir.join("tesis.project.yaml"),
        &model,
        || generate_new_document(&model, &project_dir),
    )?;

    Ok(serde_json::json!({
        "project_path": project_dir.to_string_lossy(),
        "name": name,
        "profile_id": profile_id,
        "sections_count": model.sections.len(),
    }))
}

/// Importa un archivo .tex existente como un proyecto TeXisStudio editable.
///
/// La importacion conserva el contenido LaTeX como bloque confirmado para no
/// perder fidelidad. El usuario puede migrarlo despues a bloques visuales.
#[tauri::command]
pub fn import_tex_project(
    app: tauri::AppHandle,
    tex_path: String,
    output_path: String,
    project_name: Option<String>,
    profile_id: Option<String>,
) -> Result<Value, String> {
    use texis_core::project::model::{ContentBlock, RawLatexBlock, SectionPlacement};

    let tex_path = PathBuf::from(&tex_path);
    if !tex_path.is_file() {
        return Err("Selecciona un archivo .tex valido.".to_string());
    }
    if tex_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("tex"))
        != Some(true)
    {
        return Err("El archivo seleccionado debe tener extension .tex.".to_string());
    }

    let raw = std::fs::read_to_string(&tex_path).map_err(err)?;
    let imported_body = extract_document_body(&raw).trim().to_string();
    if imported_body.is_empty() {
        return Err("El archivo .tex no contiene contenido importable.".to_string());
    }

    let fallback_name = tex_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("tesis-importada")
        .to_string();
    let name = project_name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or(fallback_name);
    validate_safe_name(&name)?;
    let title = latex_title(&raw).unwrap_or_else(|| name.clone());

    let profile_id = profile_id.unwrap_or_else(|| "generic.thesis".to_string());
    validate_profile_id(&profile_id)?;

    let output = PathBuf::from(&output_path);
    let project_dir = output.join(&name);
    if project_dir.exists() {
        return Err(format!(
            "El directorio '{}' ya existe.",
            project_dir.display()
        ));
    }

    let prof_dir = profiles_dir_for_app(&app);
    let mut registry = ProfileRegistry::new();
    registry.load_from_dir(&prof_dir).map_err(err)?;
    let profile = registry
        .get(&profile_id)
        .ok_or_else(|| {
            format!(
                "Perfil '{}' no encontrado en {}.",
                profile_id,
                prof_dir.display()
            )
        })?
        .clone();

    std::fs::create_dir_all(project_dir.join("content").join("sections")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("bibliography")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("content").join("figures")).map_err(err)?;
    std::fs::create_dir_all(project_dir.join("imports")).map_err(err)?;
    std::fs::copy(&tex_path, project_dir.join("imports").join("source.tex")).map_err(err)?;

    let mut model = build_model_from_profile(&name, &profile);
    model.metadata.title = title;
    model.updated_at = now_iso8601();

    if let Some(section) = model
        .sections
        .iter_mut()
        .find(|s| matches!(s.placement, SectionPlacement::Body))
    {
        section.id = "imported_tex".to_string();
        section.element_id = "imported_tex".to_string();
        section.title = None;
        section.enabled = true;
        section.blocks = vec![ContentBlock::RawLatex(RawLatexBlock {
            id: "imported-tex-source".to_string(),
            content: imported_body,
            user_confirmed: true,
        })];
        section.notes = Some(
            "Contenido importado desde source.tex. Conviene migrarlo gradualmente a bloques TeXisStudio."
                .to_string(),
        );
    } else {
        return Err(
            "El perfil seleccionado no tiene una seccion de cuerpo para importar.".to_string(),
        );
    }

    persist_model_transactional(
        &project_dir,
        &project_dir.join("tesis.project.yaml"),
        &model,
        || generate_new_document(&model, &project_dir),
    )?;

    Ok(serde_json::json!({
        "project_path": project_dir.to_string_lossy(),
        "name": name,
        "profile_id": profile_id,
        "imported_from": tex_path.to_string_lossy(),
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

    let project_dir = PathBuf::from(&project_path);
    // La regeneración de los .tex de la sección entra en la transacción y bajo el
    // mismo lock: si falla, el YAML vuelve al estado previo.
    persist_model_transactional(&project_dir, &yaml_path, &model, || {
        sync_document(&model, &project_dir)
    })?;

    Ok(())
}

/// Guarda el modelo completo del proyecto (metadatos + secciones) y regenera build/.
#[tauri::command]
pub fn save_project(project_path: String, project: Value) -> Result<(), String> {
    let yaml_path = PathBuf::from(&project_path).join("tesis.project.yaml");
    let mut model: ProjectModel = serde_json::from_value(project).map_err(err)?;
    model.updated_at = now_iso8601();
    let project_dir = PathBuf::from(&project_path);
    // Regenerar build/ dentro de la transacción y bajo el mismo lock.
    persist_model_transactional(&project_dir, &yaml_path, &model, || {
        sync_document(&model, &project_dir)
    })?;
    Ok(())
}

/// Valida el proyecto y devuelve el reporte de issues.
#[tauri::command]
pub fn validate_project(app: tauri::AppHandle, project_path: String) -> Result<Value, String> {
    let path = PathBuf::from(&project_path);
    let yaml_path = path.join("tesis.project.yaml");
    let loader = ProjectLoader;
    let model = loader.load_from_file(&yaml_path).map_err(err)?;

    let profile = load_profile_for_model(&app, &model);

    let validator = Validator::new();
    let report = validator
        .validate_with_profile(&model, &path, profile.as_ref())
        .map_err(err)?;

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
            "doi":        e.fields.get("doi").map(|s| s.as_str()).unwrap_or(""),
            "pages":      e.fields.get("pages").map(|s| s.as_str()).unwrap_or(""),
            "volume":     e.fields.get("volume").map(|s| s.as_str()).unwrap_or(""),
            "publisher":  e.fields.get("publisher").map(|s| s.as_str()).unwrap_or(""),
            "url":        e.fields.get("url").map(|s| s.as_str()).unwrap_or(""),
        })
    }).collect();

    Ok(serde_json::json!(result))
}

/// Añade una entrada BibTeX al archivo references.bib del proyecto.
/// Crea el archivo (y directorios intermedios) si no existe.
/// Rechaza entradas duplicadas por citation key O por campo DOI.
/// Retorna la citation key de la entrada creada.
#[tauri::command]
pub fn append_bib_entry(project_path: String, bibtex: String) -> Result<String, String> {
    use std::io::Write;
    use texis_core::bibliography::parser::BibParser;

    let bibtex = bibtex.trim().to_string();
    if bibtex.is_empty() {
        return Err("La entrada BibTeX está vacía.".to_string());
    }

    let bib_dir = PathBuf::from(&project_path)
        .join("content")
        .join("bibliography");
    std::fs::create_dir_all(&bib_dir).map_err(err)?;
    let bib_path = bib_dir.join("references.bib");

    let parser = BibParser;
    let new_entries = parser.parse_str(&bibtex);
    if new_entries.len() != 1 {
        return Err("La entrada BibTeX debe contener exactamente una referencia.".to_string());
    }

    let new_entry = &new_entries[0];
    let new_key = new_entry.key.clone();
    let new_doi = new_entry.fields.get("doi").map(|s| s.to_lowercase());

    if new_key.is_empty() {
        return Err("La citation key está vacía. Verifica el formato BibTeX.".to_string());
    }

    // Detectar duplicados: por clave Y por DOI
    if bib_path.exists() {
        let existing_content = std::fs::read_to_string(&bib_path).map_err(err)?;
        let existing_entries = parser.parse_str(&existing_content);

        if existing_entries.iter().any(|e| e.key == new_key) {
            return Err(format!("La clave '{new_key}' ya existe en references.bib."));
        }

        if let Some(ref doi) = new_doi {
            if !doi.is_empty() {
                if let Some(dup) = existing_entries
                    .iter()
                    .find(|e| e.fields.get("doi").map(|d| d.to_lowercase()).as_deref() == Some(doi))
                {
                    return Err(format!(
                        "El DOI '{doi}' ya está registrado como '{}'.",
                        dup.key
                    ));
                }
            }
        }
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&bib_path)
        .map_err(err)?;

    if bib_path.metadata().map(|m| m.len()).unwrap_or(0) > 0 {
        writeln!(file).map_err(err)?;
    }
    writeln!(file, "{}", bibtex).map_err(err)?;

    Ok(new_key)
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
        b["filename"]
            .as_str()
            .unwrap_or("")
            .cmp(a["filename"].as_str().unwrap_or(""))
    });

    Ok(serde_json::json!(entries))
}

/// Restaura el proyecto a un snapshot.
/// Antes de sobreescribir, crea automáticamente un snapshot de "pre-restauración".
#[tauri::command]
pub fn restore_snapshot(project_path: String, snapshot_filename: String) -> Result<(), String> {
    // Seguridad: el nombre no puede contener separadores de ruta
    if snapshot_filename.contains('/')
        || snapshot_filename.contains('\\')
        || snapshot_filename.contains("..")
    {
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
    if snapshot_filename.contains('/')
        || snapshot_filename.contains('\\')
        || snapshot_filename.contains("..")
    {
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

/// Ejecuta el postflight sobre el PDF compilado del proyecto.
/// Devuelve el resultado como JSON para mostrarlo en la UI.
#[tauri::command]
pub fn check_pdf_postflight(project_path: String) -> Result<Value, String> {
    let pdf_path = PathBuf::from(&project_path).join("build").join("main.pdf");
    let result = PdfChecker::check(&pdf_path);
    serde_json::to_value(&result).map_err(err)
}

/// Genera un paquete ZIP de entrega.
///
/// `export_mode`:
///   - "draft"  → permite warnings y errores, el ZIP se marca como borrador
///   - "review" → permite warnings, bloquea errores de validación críticos
///   - "final"  → bloquea errores de validación y de postflight PDF
///
/// Devuelve la ruta al ZIP creado.
#[tauri::command]
pub fn export_delivery(
    app: tauri::AppHandle,
    project_path: String,
    output_path: String,
    export_mode: Option<String>,
) -> Result<Value, String> {
    use texis_core::exporter::{DeliveryInput, DeliveryOptions};

    let mode = export_mode.as_deref().unwrap_or("draft");
    let project_dir = PathBuf::from(&project_path);
    let project_yaml = project_dir.join("tesis.project.yaml");
    let pdf_path = project_dir.join("build").join("main.pdf");

    // ── Cargar modelo y perfil ────────────────────────────────────
    let model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;
    let profile = load_profile_for_model(&app, &model);

    // ── P1.9: Bloqueo de dependencias críticas en modo final ─────
    if mode == "final" {
        check_critical_dependencies_for_export(&model, profile.as_ref())?;
    }

    // ── Validación + postflight + compuerta única de calidad ─────
    let validation = Validator::new()
        .validate_with_profile(&model, &project_dir, profile.as_ref())
        .map_err(err)?;

    let postflight = PdfChecker::check(&pdf_path);
    let visual_pdf = if pdf_path.exists() {
        Some(check_pdf_visual_quality(&pdf_path))
    } else {
        None
    };
    let log = std::fs::read_to_string(project_dir.join("build").join("main.log")).ok();

    // Fuente de verdad: el mismo DeliveryQualityReport que consume la UI. El gate
    // de exportación ya no reimplementa su propia lógica — pregunta a la compuerta.
    let quality = texis_core::quality::assess(texis_core::quality::QualityInputs {
        validation: &validation,
        postflight: if pdf_path.exists() {
            Some(&postflight)
        } else {
            None
        },
        visual_pdf: visual_pdf.as_ref().map(|v| v.issues.as_slice()),
        log: log.as_deref(),
        profile: profile.as_ref(),
    });

    let gate = match mode {
        "final" => &quality.final_gate,
        "review" => &quality.review_gate,
        _ => &quality.draft_gate,
    };
    if !gate.passed {
        let msgs: Vec<String> = quality
            .findings
            .iter()
            .filter(|f| gate.blocking_codes.contains(&f.code))
            .map(|f| match &f.suggestion {
                Some(s) => format!("• {} → {}", f.message, s),
                None => format!("• {}", f.message),
            })
            .collect();
        return Err(format!(
            "Exportación «{}» bloqueada — {} problema(s) de calidad:\n{}",
            mode,
            gate.blocking_codes.len(),
            msgs.join("\n")
        ));
    }
    if mode == "final" && !pdf_path.exists() {
        return Err(
            "Exportación final bloqueada — no existe PDF compilado. Compila primero.".to_string(),
        );
    }

    // ── Delegar generación del ZIP al módulo compartido ──────────
    let output_dir = PathBuf::from(&output_path);
    std::fs::create_dir_all(&output_dir).map_err(err)?;

    let input = DeliveryInput {
        project_dir: &project_dir,
        model: &model,
        profile: profile.as_ref(),
        validation: &validation,
        postflight: &postflight,
    };
    let options = DeliveryOptions {
        output_dir: &output_dir,
        mode,
        app_version: env!("CARGO_PKG_VERSION"),
    };

    let result = texis_core::exporter::create_delivery_package(&input, &options).map_err(err)?;

    Ok(serde_json::json!({
        "zip_path": result.zip_path.to_string_lossy(),
        "export_mode": result.export_mode,
        "validation_errors": result.validation_errors,
        "postflight_passed": result.postflight_passed,
        "all_fonts_embedded": result.all_fonts_embedded,
    }))
}

/// Compuerta única de calidad: devuelve el [`DeliveryQualityReport`] unificado
/// (validación + postflight + log + confianza de perfil) como JSON. Es la misma
/// fuente de verdad que usa `export_delivery` para bloquear, de modo que la UI
/// muestra exactamente lo que la exportación va a exigir.
#[tauri::command]
pub fn delivery_quality_report(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<Value, String> {
    let project_dir = PathBuf::from(&project_path);
    let model = ProjectLoader
        .load_from_file(&project_dir.join("tesis.project.yaml"))
        .map_err(err)?;
    let profile = load_profile_for_model(&app, &model);
    let validation = Validator::new()
        .validate_with_profile(&model, &project_dir, profile.as_ref())
        .map_err(err)?;

    let pdf_path = project_dir.join("build").join("main.pdf");
    let postflight = if pdf_path.exists() {
        Some(PdfChecker::check(&pdf_path))
    } else {
        None
    };
    let visual_pdf = if pdf_path.exists() {
        Some(check_pdf_visual_quality(&pdf_path))
    } else {
        None
    };
    let log = std::fs::read_to_string(project_dir.join("build").join("main.log")).ok();

    let report = texis_core::quality::assess(texis_core::quality::QualityInputs {
        validation: &validation,
        postflight: postflight.as_ref(),
        visual_pdf: visual_pdf.as_ref().map(|v| v.issues.as_slice()),
        log: log.as_deref(),
        profile: profile.as_ref(),
    });
    serde_json::to_value(&report).map_err(err)
}

/// Agrega recursivamente un directorio al ZIP, excluyendo archivos por nombre.
#[allow(dead_code)]
fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<impl std::io::Write + std::io::Seek>,
    dir: &std::path::Path,
    prefix: &str,
    opts: zip::write::SimpleFileOptions,
    exclude_names: &[&str],
) -> Result<(), String> {
    use std::io::Write;
    let walker = walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok());
    for entry in walker {
        let path = entry.path();
        let rel = path.strip_prefix(dir).map_err(err)?;
        let zip_name = format!("{}/{}", prefix, rel.to_string_lossy().replace('\\', "/"));

        if path.is_dir() {
            continue; // WalkDir creates files implicitly
        }

        let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if exclude_names.contains(&filename) {
            continue;
        }

        zip.start_file(&zip_name, opts).map_err(err)?;
        let bytes = std::fs::read(path).map_err(err)?;
        zip.write_all(&bytes).map_err(err)?;
    }
    Ok(())
}

/// Actualiza los ajustes tipográficos del proyecto (fuente, papel, interlineado, márgenes).
#[tauri::command]
pub fn update_typography(
    project_path: String,
    font_size: Option<String>,
    paper_size: Option<String>,
    line_spacing: Option<String>,
    margin_cm: Option<f32>,
) -> Result<(), String> {
    use texis_core::project::model::LatexTypography;

    let project_dir = std::path::Path::new(&project_path);
    let project_yaml = project_dir.join("tesis.project.yaml");
    let mut model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    model.latex_config.typography = LatexTypography {
        font_size,
        paper_size,
        line_spacing,
        margin_cm,
    };

    persist_model_transactional(project_dir, &project_yaml, &model, || Ok(()))
}

/// Payload para update_preamble_config. Agrupa los 11 campos en un struct
/// para respetar el límite de 7 argumentos de clippy en Tauri commands.
#[derive(serde::Deserialize)]
pub struct PreambleConfigPayload {
    pub cjk_main_font: Option<String>,
    pub cjk_japanese_font: Option<String>,
    pub cjk_korean_font: Option<String>,
    pub cyrillic_font: Option<String>,
    pub main_font: Option<String>,
    pub sans_font: Option<String>,
    pub mono_font: Option<String>,
    pub math_operators: Option<serde_json::Value>,
    pub extra_theorems: Option<serde_json::Value>,
    pub extra: Option<String>,
}

/// Actualiza la configuración de preámbulo del proyecto.
/// Gestiona fuentes CJK, fuentes del documento, operadores matemáticos,
/// teoremas adicionales y preámbulo extra.
#[tauri::command]
pub fn update_preamble_config(
    project_path: String,
    payload: PreambleConfigPayload,
) -> Result<(), String> {
    use texis_core::project::model::{ExtraTheorem, MathOperator, PreambleConfig};

    let project_dir = std::path::Path::new(&project_path);
    let project_yaml = project_dir.join("tesis.project.yaml");
    let mut model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    let ops: Vec<MathOperator> = payload
        .math_operators
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let thms: Vec<ExtraTheorem> = payload
        .extra_theorems
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    model.latex_config.preamble_config = PreambleConfig {
        cyrillic_font: payload.cyrillic_font.filter(|s| !s.is_empty()),
        cjk_main_font: payload.cjk_main_font.filter(|s| !s.is_empty()),
        cjk_japanese_font: payload.cjk_japanese_font.filter(|s| !s.is_empty()),
        cjk_korean_font: payload.cjk_korean_font.filter(|s| !s.is_empty()),
        main_font: payload.main_font.filter(|s| !s.is_empty()),
        sans_font: payload.sans_font.filter(|s| !s.is_empty()),
        mono_font: payload.mono_font.filter(|s| !s.is_empty()),
        math_operators: ops,
        extra_theorems: thms,
        extra: payload.extra.filter(|s| !s.trim().is_empty()),
    };

    persist_model_transactional(project_dir, &project_yaml, &model, || Ok(()))
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
    use texis_core::project::model::ProjectSection;
    use texis_core::project::model::SectionStatus;

    fn apply(
        sections: &mut [ProjectSection],
        id: &str,
        status: &SectionStatus,
        notes: &Option<String>,
    ) -> bool {
        for s in sections.iter_mut() {
            if s.id == id {
                s.status = status.clone();
                s.notes = notes.clone();
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
        "revised" => SectionStatus::Revised,
        "approved" => SectionStatus::Approved,
        _ => SectionStatus::Draft,
    };

    let path = std::path::Path::new(&project_path);
    let project_yaml = path.join("tesis.project.yaml");
    let mut model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    if !apply(&mut model.sections, &section_id, &new_status, &notes) {
        return Err(format!("Sección '{}' no encontrada", section_id));
    }

    persist_model_transactional(path, &project_yaml, &model, || Ok(()))
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

/// Carga el perfil correspondiente al profile_id del modelo, sin fallar si no se encuentra.
fn load_profile_for_model(app: &tauri::AppHandle, model: &ProjectModel) -> Option<Profile> {
    use texis_core::profile::ProfileLoader;

    let profiles_root = profiles_dir_for_app(app);
    let loader = ProfileLoader;

    // 1. Perfiles bundled: profiles/<id>/profile.yaml
    let bundled = profiles_root.join(&model.profile_id).join("profile.yaml");
    if bundled.exists() {
        return loader.load_from_file(&bundled).ok();
    }

    // 2. Perfiles externos instalados: profiles/external/<id>/profile.yaml
    let external = profiles_root
        .join("external")
        .join(&model.profile_id)
        .join("profile.yaml");
    if external.exists() {
        return loader.load_from_file(&external).ok();
    }

    None
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
            "back_matter" => SectionPlacement::BackMatter,
            "appendix" => SectionPlacement::Appendix,
            _ => SectionPlacement::Body,
        }
    };

    let engine = match profile.latex_engine.as_str() {
        "pdflatex" => LatexEngine::Pdflatex,
        "lualatex" => LatexEngine::Lualatex,
        _ => LatexEngine::Xelatex,
    };

    let compiler = match profile.compiler.as_str() {
        "tectonic" => CompilerKind::Tectonic,
        _ => CompilerKind::Latexmk,
    };

    let bib_backend = match profile.bibliography_backend.as_str() {
        "bibtex" => BibliographyBackend::Bibtex,
        _ => BibliographyBackend::Biber,
    };

    let sections = profile
        .sections
        .iter()
        .map(|s| ProjectSection {
            id: s.id.clone(),
            element_id: s.element_id.clone(),
            title: s.title.clone(),
            placement: map_placement(&s.placement),
            required: s.required,
            enabled: true,
            label: s.label.clone(),
            status: SectionStatus::Draft,
            notes: None,
            blocks: vec![],
            fields: HashMap::new(),
            children: vec![],
        })
        .collect();

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
            year: chrono::Utc::now()
                .format("%Y")
                .to_string()
                .parse()
                .unwrap_or(2026),
            keywords: vec![],
            funding: None,
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
            committee: vec![],
            orcid: None,
        },
        profile_id: profile.id.clone(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: profile.document_class.name.clone(),
                options: profile.document_class.options.clone(),
            },
            engine,
            compiler,
            bibliography_backend: bib_backend,
            bibliography_style: profile.bibliography_style.clone(),
            packages_required: profile.packages.clone(),
            typography: Default::default(),
            page_layout: map_profile_page_layout(profile),
            packages_with_options: vec![],
            preamble_config: Default::default(),
        },
        sections,
        file_states: HashMap::new(),
    }
}

/// Convierte el `page_layout` del perfil al tipo `PageLayout` del modelo de proyecto.
/// Devuelve `None` si el perfil no declara page_layout.
fn map_profile_page_layout(profile: &Profile) -> Option<texis_core::project::model::PageLayout> {
    use texis_core::project::model::{PageLayout, PageMargins};

    let pl = profile.page_layout.as_ref()?;
    Some(PageLayout {
        paper: pl.paper.clone(),
        margins: pl.margins.as_ref().map(|m| PageMargins {
            top: m.top.clone(),
            bottom: m.bottom.clone(),
            left: m.left.clone(),
            right: m.right.clone(),
        }),
        line_spacing: pl.line_spacing,
    })
}

fn now_iso8601() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn extract_document_body(raw: &str) -> &str {
    let begin = "\\begin{document}";
    let end = "\\end{document}";
    let Some(start) = raw.find(begin) else {
        return raw;
    };
    let body_start = start + begin.len();
    let body = &raw[body_start..];
    if let Some(stop) = body.find(end) {
        &body[..stop]
    } else {
        body
    }
}

fn latex_title(raw: &str) -> Option<String> {
    let marker = "\\title{";
    let start = raw.find(marker)? + marker.len();
    let mut depth = 1usize;
    let mut end = start;
    for (offset, ch) in raw[start..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    end = start + offset;
                    break;
                }
            }
            _ => {}
        }
    }
    if depth != 0 {
        return None;
    }
    let title = raw[start..end]
        .replace(['\n', '\r', '\t'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    (!title.is_empty()).then_some(title)
}

/// Valida que un nombre de proyecto sea seguro para usarse como carpeta.
/// Rechaza: vacío, demasiado largo, separadores de ruta, `..`,
/// caracteres inválidos en Windows y nombres reservados del sistema.
fn validate_safe_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("El nombre del proyecto no puede estar vacío.".to_string());
    }
    if name.len() > 200 {
        return Err(
            "El nombre del proyecto es demasiado largo (máximo 200 caracteres).".to_string(),
        );
    }
    // Windows trata mal los nombres que terminan en punto o espacio
    if name.ends_with('.') {
        return Err("El nombre del proyecto no puede terminar en punto.".to_string());
    }
    if name.ends_with(' ') {
        return Err("El nombre del proyecto no puede terminar en espacio.".to_string());
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err(
            "El nombre del proyecto no puede contener separadores de ruta ni '..'.".to_string(),
        );
    }
    // Caracteres inválidos en Windows y caracteres de control
    for c in name.chars() {
        if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*') {
            return Err(format!(
                "El nombre del proyecto contiene el carácter no permitido {:?}.",
                c
            ));
        }
    }
    // Nombres reservados de Windows (CON, NUL, COM1…COM9, LPT1…LPT9, etc.)
    let stem = name.split('.').next().unwrap_or(name).to_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if reserved.contains(&stem.as_str()) {
        return Err(format!(
            "'{}' es un nombre reservado del sistema operativo.",
            name
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests_validation {
    use super::*;

    #[test]
    fn extract_document_body_uses_document_environment() {
        let raw = "\\documentclass{book}\n\\begin{document}\nHola\n\\end{document}\n% tail";
        assert_eq!(extract_document_body(raw).trim(), "Hola");
    }

    #[test]
    fn extract_document_body_accepts_fragment_without_environment() {
        assert_eq!(extract_document_body("Texto suelto"), "Texto suelto");
    }

    #[test]
    fn latex_title_reads_balanced_title() {
        assert_eq!(
            latex_title("\\title{Analisis de {sistemas} complejos}"),
            Some("Analisis de {sistemas} complejos".to_string())
        );
    }

    // ── validate_profile_id ───────────────────────────────────────
    #[test]
    fn profile_id_validos() {
        for id in &[
            "generic.thesis",
            "apa7.basic",
            "vancouver.health",
            "mx_unam_apa7",
            "a",
            "A1-b",
        ] {
            assert!(
                validate_profile_id(id).is_ok(),
                "debería ser válido: {}",
                id
            );
        }
    }

    #[test]
    fn profile_id_traversal_rechazado() {
        for id in &["../x", "a/../b", "a..b"] {
            assert!(
                validate_profile_id(id).is_err(),
                "debería ser inválido: {}",
                id
            );
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
            assert!(
                validate_safe_name(name).is_ok(),
                "debería ser válido: {}",
                name
            );
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
            assert!(
                validate_safe_name(name).is_err(),
                "reservado debería rechazarse: {}",
                name
            );
        }
    }

    #[test]
    fn name_chars_invalidos_rechazados() {
        for name in &["tesis<v>", "my:project", "tesis|final", "test*"] {
            assert!(
                validate_safe_name(name).is_err(),
                "char inválido debería rechazarse: {}",
                name
            );
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
    if !id
        .chars()
        .next()
        .map(|c| c.is_alphanumeric())
        .unwrap_or(false)
    {
        return Err("El ID de perfil debe empezar con una letra o número.".to_string());
    }
    if !id
        .chars()
        .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.'))
    {
        return Err(format!(
            "El ID de perfil '{}' contiene caracteres no permitidos. Solo se permiten letras, números, '_', '-' y '.'.",
            id
        ));
    }
    Ok(())
}

/// P1.9 — Verifica que las dependencias críticas para `export final` están disponibles.
///
/// Bloquea solo por ausencias críticas (D3-bis). Los warnings no bloquean.
/// La escritura y los modos draft/review nunca se bloquean.
fn check_critical_dependencies_for_export(
    model: &ProjectModel,
    profile: Option<&texis_core::profile::model::Profile>,
) -> Result<(), String> {
    use texis_core::system::doctor;

    let engine = profile
        .map(|p| p.latex_engine.as_str())
        .or_else(|| {
            use texis_core::project::model::LatexEngine;
            Some(match &model.latex_config.engine {
                LatexEngine::Xelatex => "xelatex",
                LatexEngine::Pdflatex => "pdflatex",
                LatexEngine::Lualatex => "lualatex",
            })
        })
        .unwrap_or("xelatex");

    let bib_backend = profile
        .map(|p| p.bibliography_backend.as_str())
        .unwrap_or("biber");

    let bib_style = profile.map(|p| p.bibliography_style.as_str()).unwrap_or("");

    let requires_pdfa = profile
        .and_then(|p| p.pdf_requirements.as_ref())
        .and_then(|r| r.pdfa.as_ref())
        .map(|pdfa| pdfa.required)
        .unwrap_or(false);

    let report = doctor::run_doctor(engine, bib_backend, bib_style, requires_pdfa);

    if report.has_critical_missing {
        let missing: Vec<String> = report
            .checks
            .iter()
            .filter(|c| c.critical && c.status == doctor::ToolStatus::Missing)
            .map(|c| {
                let hint = c
                    .install_hint
                    .as_ref()
                    .map(|h| {
                        let platform = if cfg!(target_os = "macos") {
                            h.macos.as_deref()
                        } else if cfg!(target_os = "windows") {
                            h.windows.as_deref()
                        } else {
                            h.linux.as_deref()
                        };
                        platform.map(|s| format!("  → {s}")).unwrap_or_default()
                    })
                    .unwrap_or_default();
                format!(
                    "- {} ({}){}",
                    c.name,
                    c.description,
                    if hint.is_empty() {
                        String::new()
                    } else {
                        format!("\n{hint}")
                    }
                )
            })
            .collect();

        return Err(format!(
            "ERROR: No se puede generar la entrega final.\n\nFaltan dependencias críticas:\n{}\n\nInstálalas e intenta de nuevo.",
            missing.join("\n")
        ));
    }

    Ok(())
}

// ── P5A — Reporte de revisión para asesor ─────────────────────────────────────

/// Genera un reporte Markdown de revisión con estado de secciones,
/// notas del autor, issues de validación y estructura del documento.
/// Diseñado para compartir con el asesor o exportar como borrador de revisión.
#[tauri::command]
pub fn generate_review_report(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<String, String> {
    use texis_core::project::model::SectionStatus;
    use texis_core::validator::Validator;

    let project_dir = PathBuf::from(&project_path);
    let project_yaml = project_dir.join("tesis.project.yaml");
    let model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;
    let profile = load_profile_for_model(&app, &model);

    let validation = Validator::new()
        .validate_with_profile(&model, &project_dir, profile.as_ref())
        .map_err(err)?;

    let mut md = String::new();

    // ── Encabezado ──
    md.push_str(&format!(
        "# Reporte de revisión: {}\n\n",
        model.metadata.title
    ));
    md.push_str(&format!("**Autor:** {}  \n", model.student.full_name));
    if let Some(advisor) = model.student.advisor.as_deref() {
        md.push_str(&format!("**Director:** {}  \n", advisor));
    }
    md.push_str(&format!("**Institución:** {}  \n", model.institution.name));
    md.push_str(&format!("**Perfil activo:** {}  \n", model.profile_id));
    md.push_str(&format!(
        "**Fecha de reporte:** {}  \n\n",
        chrono::Utc::now().format("%Y-%m-%d")
    ));

    // ── Progreso de secciones ──
    md.push_str("## Estado de secciones\n\n");
    md.push_str("| Sección | Estado | Notas del autor |\n");
    md.push_str("|---------|--------|----------------|\n");

    let status_label = |s: &SectionStatus| match s {
        SectionStatus::Draft => "🟡 Borrador",
        SectionStatus::InReview => "🔵 En revisión",
        SectionStatus::Revised => "🟠 Corrigiendo",
        SectionStatus::Approved => "🟢 Aprobado",
    };

    for section in &model.sections {
        if !section.enabled {
            continue;
        }
        let title = section
            .title
            .as_deref()
            .unwrap_or(section.element_id.as_str());
        let notes = section.notes.as_deref().unwrap_or("—");
        let words: usize = section
            .blocks
            .iter()
            .filter_map(|b| match b {
                texis_core::project::model::ContentBlock::Paragraph(p) => {
                    Some(p.content.split_whitespace().count())
                }
                _ => None,
            })
            .sum();
        let word_note = if words > 0 {
            format!(" ({} palabras)", words)
        } else {
            String::new()
        };
        md.push_str(&format!(
            "| {}{} | {} | {} |\n",
            title,
            word_note,
            status_label(&section.status),
            notes
        ));
    }
    md.push('\n');

    // ── Resumen de validación ──
    let errors: Vec<_> = validation
        .issues
        .iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Error))
        .collect();
    let warnings: Vec<_> = validation
        .issues
        .iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Warning))
        .collect();

    md.push_str("## Validación automática\n\n");
    md.push_str(&format!("- **Errores:** {}  \n", errors.len()));
    md.push_str(&format!("- **Advertencias:** {}  \n\n", warnings.len()));

    if !errors.is_empty() {
        md.push_str("### Errores\n\n");
        for issue in &errors {
            md.push_str(&format!("- **[{}]** {}  \n", issue.code, issue.message));
            if let Some(s) = &issue.suggestion {
                md.push_str(&format!("  > 💡 {}  \n", s));
            }
        }
        md.push('\n');
    }

    if !warnings.is_empty() {
        md.push_str("### Advertencias\n\n");
        for issue in &warnings {
            md.push_str(&format!("- **[{}]** {}  \n", issue.code, issue.message));
            if let Some(s) = &issue.suggestion {
                md.push_str(&format!("  > 💡 {}  \n", s));
            }
        }
        md.push('\n');
    }

    if errors.is_empty() && warnings.is_empty() {
        md.push_str(
            "Sin issues detectados — el documento pasa todas las validaciones automáticas. ✓\n\n",
        );
    }

    // ── Notas globales del asesor (placeholder) ──
    md.push_str("## Observaciones del asesor\n\n");
    md.push_str("_(Espacio para que el asesor añada sus observaciones)_\n\n");
    md.push_str("---\n");
    md.push_str("*Generado por TeXisStudio — solo para uso interno de revisión.*\n");

    Ok(md)
}

// ── P5A — Resumen de progreso de secciones ────────────────────────────────────

#[derive(serde::Serialize)]
pub struct SectionProgress {
    pub id: String,
    pub element_id: String,
    pub title: String,
    pub placement: String,
    pub status: String,
    pub enabled: bool,
    pub word_count: usize,
    pub has_notes: bool,
    pub notes: Option<String>,
    pub block_count: usize,
}

/// Retorna el progreso editorial de todas las secciones del proyecto.
#[tauri::command]
pub fn get_section_progress(project_path: String) -> Result<Vec<SectionProgress>, String> {
    let project_dir = PathBuf::from(&project_path);
    let project_yaml = project_dir.join("tesis.project.yaml");
    let model = ProjectLoader.load_from_file(&project_yaml).map_err(err)?;

    let progress = model
        .sections
        .iter()
        .map(|s| {
            let word_count: usize = s
                .blocks
                .iter()
                .filter_map(|b| match b {
                    texis_core::project::model::ContentBlock::Paragraph(p) => {
                        Some(p.content.split_whitespace().count())
                    }
                    texis_core::project::model::ContentBlock::Heading(h) => {
                        Some(h.content.split_whitespace().count())
                    }
                    _ => None,
                })
                .sum();
            let status_str = match s.status {
                texis_core::project::model::SectionStatus::Draft => "draft",
                texis_core::project::model::SectionStatus::InReview => "in_review",
                texis_core::project::model::SectionStatus::Revised => "revised",
                texis_core::project::model::SectionStatus::Approved => "approved",
            };
            SectionProgress {
                id: s.id.clone(),
                element_id: s.element_id.clone(),
                title: s.title.clone().unwrap_or_else(|| s.element_id.clone()),
                placement: match s.placement {
                    texis_core::project::model::SectionPlacement::FrontMatter => "front_matter",
                    texis_core::project::model::SectionPlacement::Body => "body",
                    texis_core::project::model::SectionPlacement::BackMatter => "back_matter",
                    texis_core::project::model::SectionPlacement::Appendix => "appendix",
                }
                .to_string(),
                status: status_str.to_string(),
                enabled: s.enabled,
                word_count,
                has_notes: s.notes.as_ref().map(|n| !n.is_empty()).unwrap_or(false),
                notes: s.notes.clone(),
                block_count: s.blocks.len(),
            }
        })
        .collect();

    Ok(progress)
}

// ── Conflictos externos en build/ ─────────────────────────────────

/// Detecta si algún archivo del build (main.tex, preamble.tex) fue modificado
/// fuera de TeXisStudio desde la última generación.
/// Devuelve una lista de objetos { file, kind } para cada conflicto.
#[tauri::command]
pub fn detect_build_conflicts(project_path: String) -> Result<Value, String> {
    use texis_core::document::ExternalChange;
    let project_dir = PathBuf::from(&project_path);
    let build_dir = project_dir.join("build");
    let engine = DocumentEngine::load(&project_dir).map_err(err)?;
    let changes = engine.detect_external_changes(&build_dir);
    let conflicts: Vec<Value> = changes
        .iter()
        .map(|c| match c {
            ExternalChange::MainTexModified => {
                serde_json::json!({ "file": "main.tex", "kind": "main_tex_modified" })
            }
            ExternalChange::PreambleModified => {
                serde_json::json!({ "file": "preamble.tex", "kind": "preamble_modified" })
            }
        })
        .collect();
    Ok(serde_json::json!(conflicts))
}

/// Fuerza la regeneración de build/ ignorando ediciones externas.
/// Llama a `generate_with_profile` que sobreescribe todos los archivos.
#[tauri::command]
pub fn force_regenerate_build(project_path: String) -> Result<(), String> {
    let project_dir = PathBuf::from(&project_path);
    let model = ProjectLoader
        .load_from_file(&project_dir.join("tesis.project.yaml"))
        .map_err(err)?;
    generate_new_document(&model, &project_dir)
}

/// Guarda una copia del archivo modificado externamente con sufijo .external-edit.tex,
/// luego regenera build/ desde el modelo del proyecto.
/// Útil para conservar la edición externa como referencia mientras se restaura el flujo normal.
#[tauri::command]
pub fn save_external_copy_and_regenerate(
    project_path: String,
    conflicted_file: String,
) -> Result<Value, String> {
    if conflicted_file.contains('/')
        || conflicted_file.contains('\\')
        || conflicted_file.contains("..")
    {
        return Err("Nombre de archivo inválido.".to_string());
    }
    let project_dir = PathBuf::from(&project_path);
    let build_dir = project_dir.join("build");
    let src = build_dir.join(&conflicted_file);
    if !src.exists() {
        return Err(format!(
            "Archivo '{}' no encontrado en build/.",
            conflicted_file
        ));
    }

    let stem = conflicted_file
        .strip_suffix(".tex")
        .unwrap_or(&conflicted_file);
    let ts = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let copy_name = format!("{}.{}.external-edit.tex", stem, ts);
    let copy_path = build_dir.join(&copy_name);
    std::fs::copy(&src, &copy_path).map_err(err)?;

    let model = ProjectLoader
        .load_from_file(&project_dir.join("tesis.project.yaml"))
        .map_err(err)?;
    generate_new_document(&model, &project_dir)?;

    Ok(serde_json::json!({ "copy_saved_as": copy_name }))
}

/// Lista los assets disponibles en el directorio assets/ del proyecto.
/// Retorna rutas relativas al root del proyecto, extensión y nombre canónico.
#[tauri::command]
pub fn list_project_assets(project_path: String) -> Result<Value, String> {
    let root = PathBuf::from(&project_path);
    let assets_dir = root.join("assets");

    if !assets_dir.exists() {
        return Ok(serde_json::json!([]));
    }

    let mut files: Vec<serde_json::Value> = Vec::new();
    collect_assets_recursive(&assets_dir, &root, &mut files);
    files.sort_by(|a, b| {
        a["name"]
            .as_str()
            .unwrap_or("")
            .cmp(b["name"].as_str().unwrap_or(""))
    });

    Ok(serde_json::json!(files))
}

fn collect_assets_recursive(
    dir: &std::path::Path,
    root: &std::path::Path,
    out: &mut Vec<serde_json::Value>,
) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let image_exts = ["png", "jpg", "jpeg", "pdf", "svg", "eps", "bmp", "tiff"];

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_assets_recursive(&path, root, out);
        } else {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if image_exts.contains(&ext.as_str()) {
                let relative = path.strip_prefix(root).unwrap_or(&path);
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                out.push(serde_json::json!({
                    "name": name,
                    "path": relative.to_string_lossy().replace('\\', "/"),
                    "ext": ext,
                }));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_staging_failure_leaves_live_build_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let build = root.join("build");
        std::fs::create_dir_all(&build).unwrap();
        std::fs::write(build.join("main.tex"), "old").unwrap();

        let result = regenerate_build_transactional(root, |staging| {
            std::fs::create_dir_all(staging).unwrap();
            std::fs::write(staging.join("main.tex"), "new-partial").unwrap();
            Err("generation failed after partial write".to_string())
        });

        assert!(result.is_err());
        assert_eq!(
            std::fs::read_to_string(build.join("main.tex")).unwrap(),
            "old"
        );
        assert!(
            std::fs::read_dir(root)
                .unwrap()
                .filter_map(|entry| entry.ok())
                .all(|entry| !entry
                    .file_name()
                    .to_string_lossy()
                    .contains("build-staging")),
            "staging directory should be cleaned on failure"
        );
    }

    #[test]
    fn promote_failure_restores_previous_build() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let build = root.join("build");
        let staging = root.join(".texisstudio-build-staging-test");
        std::fs::create_dir_all(&build).unwrap();
        std::fs::write(build.join("main.tex"), "old").unwrap();
        std::fs::create_dir_all(&staging).unwrap();
        std::fs::write(staging.join("main.tex"), "new").unwrap();

        let result =
            replace_build_from_staging(root, &staging, || Err("checksum write failed".to_string()));

        assert!(result.is_err());
        assert_eq!(
            std::fs::read_to_string(build.join("main.tex")).unwrap(),
            "old"
        );
    }
}
