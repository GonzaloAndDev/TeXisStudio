use chrono;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;
use texis_core::compiler::detector::LatexInstallation;
use texis_core::profile::{ProfileLoader, ProfileRegistry};

/// Payload de actualización de perfil enviado desde el frontend.
#[derive(Debug, Deserialize, Serialize)]
pub struct ProfileUpdatePayload {
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub license: Option<String>,
    pub latex_engine: String,
    pub document_class: String,
    pub bibliography_style: String,
    pub bibliography_backend: String,
    pub tags: Vec<String>,
    pub sections: Vec<SectionUpdateEntry>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SectionUpdateEntry {
    pub id: String,
    pub element_id: String,
    pub placement: String,
    pub required: bool,
    pub title: Option<String>,
    pub label: Option<String>,
    #[serde(default)]
    pub guidance: Option<String>,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Localiza el directorio de perfiles.
/// - Producción: resource_dir/profiles (bundle de Tauri)
/// - Dev: workspace_root/profiles (relativo a CARGO_MANIFEST_DIR)
fn profiles_dir(app: &tauri::AppHandle) -> PathBuf {
    // Producción primero
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("profiles");
        if p.exists() {
            return p;
        }
    }
    // Dev: CARGO_MANIFEST_DIR apunta a texis-app/src-tauri
    // Dos niveles arriba = workspace root
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|root| root.join("profiles"))
        .unwrap_or_else(|| PathBuf::from("profiles"));
    dev_path
}

/// Devuelve los perfiles disponibles cargando desde el directorio de perfiles.
#[tauri::command]
pub fn get_profiles(app: tauri::AppHandle) -> Result<Value, String> {
    let dir = profiles_dir(&app);
    let mut registry = ProfileRegistry::new();

    if dir.exists() {
        registry.load_from_dir(&dir).map_err(err)?;
    }

    // Si el registry está vacío (primera vez / no hay dir), devolver builtin hardcodeados
    let mut profiles: Vec<&texis_core::profile::Profile> = registry.list().collect();
    // Ordenar por id para salida determinista
    profiles.sort_by(|a, b| a.id.cmp(&b.id));

    if profiles.is_empty() {
        // Fallback mínimo
        return Ok(serde_json::json!([
            {
                "id": "generic.thesis",
                "name": "Tesis genérica",
                "description": "Estructura clásica con marco teórico, metodología, resultados y conclusiones.",
                "meta": "XeLaTeX · biber · APA 7",
                "tags": ["tesis", "licenciatura", "maestria", "doctorado"],
                "sections_count": 8,
                "author": "Gonzalo Andrade Estrella",
                "version": "0.1.0",
                "sections": []
            },
            {
                "id": "generic.tesina",
                "name": "Tesina genérica",
                "description": "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
                "meta": "XeLaTeX · biber · APA 7",
                "tags": ["tesina", "licenciatura"],
                "sections_count": 5,
                "author": "Gonzalo Andrade Estrella",
                "version": "0.1.0",
                "sections": []
            },
        ]));
    }

    let result: Vec<Value> = profiles
        .iter()
        .map(|p| profile_to_json(p))
        .collect();

    Ok(serde_json::json!(result))
}

/// Devuelve el detalle completo de un perfil por ID (incluye secciones).
#[tauri::command]
pub fn get_profile_detail(app: tauri::AppHandle, profile_id: String) -> Result<Value, String> {
    let dir = profiles_dir(&app);
    let mut registry = ProfileRegistry::new();
    if dir.exists() {
        registry.load_from_dir(&dir).map_err(err)?;
    }
    let profile = registry
        .get(&profile_id)
        .ok_or_else(|| format!("Perfil '{}' no encontrado.", profile_id))?;

    Ok(profile_to_json(profile))
}

/// Importa un perfil desde una ruta .texisprofile (directorio) o profile.yaml.
/// Copia/registra el perfil en el directorio de perfiles de la app.
#[tauri::command]
pub fn import_profile(app: tauri::AppHandle, source_path: String) -> Result<Value, String> {
    use texis_core::profile::ProfileLoader;
    use std::path::Path;

    let src = Path::new(&source_path);
    let profiles_root = profiles_dir(&app);

    // Resolver la ruta del profile.yaml dentro de la fuente
    let profile_yaml = if src.is_dir() {
        src.join("profile.yaml")
    } else if src.file_name().and_then(|n| n.to_str()) == Some("profile.yaml") {
        src.to_path_buf()
    } else {
        return Err("La ruta debe ser un directorio de perfil o un archivo profile.yaml.".to_string());
    };

    if !profile_yaml.exists() {
        return Err(format!("No se encontró profile.yaml en '{}'.", source_path));
    }

    // Cargar y validar el perfil
    let loader = ProfileLoader;
    let profile = loader.load_from_file(&profile_yaml).map_err(err)?;

    // Destino: profiles_root / profile_id /
    let dest_dir = profiles_root.join(&profile.id);
    if dest_dir.exists() {
        return Err(format!(
            "El perfil '{}' ya está instalado. Elimínalo primero para reimportarlo.",
            profile.id
        ));
    }
    std::fs::create_dir_all(&dest_dir).map_err(err)?;

    // Copia recursiva del directorio fuente
    let src_dir = profile_yaml.parent().unwrap_or(src);
    copy_dir_recursive(src_dir, &dest_dir)?;

    Ok(profile_to_json(&profile))
}

/// Exporta un perfil instalado a una carpeta destino como directorio .texisprofile.
#[tauri::command]
pub fn export_profile(
    app: tauri::AppHandle,
    profile_id: String,
    dest_path: String,
) -> Result<Value, String> {
    let profiles_root = profiles_dir(&app);
    let src_dir = profiles_root.join(&profile_id);

    if !src_dir.exists() {
        return Err(format!("Perfil '{}' no encontrado en el directorio de perfiles.", profile_id));
    }

    let dest = PathBuf::from(&dest_path).join(format!("{}.texisprofile", profile_id));
    std::fs::create_dir_all(&dest).map_err(err)?;

    copy_dir_recursive(&src_dir, &dest)?;

    Ok(serde_json::json!({
        "exported_to": dest.to_string_lossy(),
        "profile_id": profile_id,
    }))
}

/// Actualiza los metadatos y secciones de un perfil instalado y guarda el profile.yaml.
#[tauri::command]
pub fn update_profile(
    app: tauri::AppHandle,
    profile_id: String,
    payload: ProfileUpdatePayload,
) -> Result<Value, String> {
    use texis_core::profile::model::{ProfileDocumentClass, ProfileSectionDef};

    let profiles_root = profiles_dir(&app);
    let yaml_path = profiles_root.join(&profile_id).join("profile.yaml");

    if !yaml_path.exists() {
        return Err(format!("No se encontró el perfil '{}' en '{}'.", profile_id, yaml_path.display()));
    }

    // Cargar el perfil actual para preservar campos que el editor no toca
    let loader = ProfileLoader;
    let mut profile = loader.load_from_file(&yaml_path).map_err(err)?;

    // Aplicar updates del payload
    profile.name = payload.name;
    profile.description = payload.description;
    profile.author = payload.author;
    profile.version = payload.version;
    profile.license = payload.license;
    profile.latex_engine = payload.latex_engine;
    profile.bibliography_style = payload.bibliography_style;
    profile.bibliography_backend = payload.bibliography_backend;
    profile.tags = payload.tags;
    profile.document_class = ProfileDocumentClass {
        name: payload.document_class,
        options: profile.document_class.options.clone(), // conservar opciones existentes
    };
    profile.sections = payload.sections.iter().map(|s| ProfileSectionDef {
        id: s.id.clone(),
        element_id: s.element_id.clone(),
        placement: s.placement.clone(),
        required: s.required,
        title: s.title.clone(),
        label: s.label.clone(),
        guidance: s.guidance.clone(),
    }).collect();

    loader.save_to_file(&profile, &yaml_path).map_err(err)?;

    Ok(profile_to_json(&profile))
}

/// Elimina un perfil instalado del directorio de perfiles.
#[tauri::command]
pub fn delete_profile(
    app: tauri::AppHandle,
    profile_id: String,
) -> Result<(), String> {
    // Rechazar profile_id con traversal, separadores de ruta o chars inválidos.
    // Se permite '.' para IDs como "apa7.basic" o "generic.thesis".
    let id_invalid = profile_id.is_empty()
        || profile_id.len() > 100
        || profile_id.contains("..")
        || profile_id.contains('/')
        || profile_id.contains('\\')
        || !profile_id.chars().next().map(|c| c.is_alphanumeric()).unwrap_or(false)
        || !profile_id.chars().all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.'));
    if id_invalid {
        return Err(format!("ID de perfil inválido: '{}'.", profile_id));
    }

    let profiles_root = profiles_dir(&app);
    let profile_dir = profiles_root.join(&profile_id);

    if !profile_dir.exists() {
        return Err(format!("El perfil '{}' no está instalado.", profile_id));
    }

    // Verificar que es un directorio de perfil válido (tiene profile.yaml)
    if !profile_dir.join("profile.yaml").exists() {
        return Err("El directorio no contiene un profile.yaml válido.".to_string());
    }

    // Canonicalizar ambas rutas para detectar symlinks que salgan del sandbox
    let canon_root = profiles_root.canonicalize().map_err(err)?;
    let canon_dir  = profile_dir.canonicalize().map_err(err)?;
    if !canon_dir.starts_with(&canon_root) {
        return Err("Operación denegada: la ruta resuelta queda fuera del directorio de perfiles.".to_string());
    }

    std::fs::remove_dir_all(&profile_dir).map_err(err)?;
    Ok(())
}

/// Crea un perfil nuevo desde cero y lo guarda en el directorio de perfiles.
#[tauri::command]
pub fn create_profile(
    app: tauri::AppHandle,
    profile_id: String,
    payload: ProfileUpdatePayload,
) -> Result<Value, String> {
    use texis_core::profile::model::{Profile, ProfileDocumentClass, ProfileSectionDef};

    // Validar profile_id (mismas reglas que delete_profile)
    let id_invalid = profile_id.is_empty()
        || profile_id.len() > 100
        || profile_id.contains("..")
        || profile_id.contains('/')
        || profile_id.contains('\\')
        || !profile_id.chars().next().map(|c| c.is_alphanumeric()).unwrap_or(false)
        || !profile_id.chars().all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.'));
    if id_invalid {
        return Err(format!("ID de perfil inválido: '{}'.", profile_id));
    }

    let profiles_root = profiles_dir(&app);
    let profile_dir = profiles_root.join(&profile_id);

    if profile_dir.exists() {
        return Err(format!(
            "El perfil '{}' ya existe. Usa 'Editar perfil' para modificarlo o elimínalo primero.",
            profile_id
        ));
    }

    std::fs::create_dir_all(&profile_dir).map_err(err)?;

    let mut profile = Profile::new_draft(
        profile_id.clone(),
        payload.name,
        ProfileDocumentClass {
            name: payload.document_class,
            options: vec![
                "12pt".to_string(),
                "letterpaper".to_string(),
                "oneside".to_string(),
            ],
        },
        payload.latex_engine,
        payload.bibliography_backend,
        payload.bibliography_style,
    );

    profile.schema_version = texis_core::schema::versions::CURRENT_SCHEMA_VERSION.to_string();
    profile.description    = payload.description;
    profile.author         = payload.author;
    profile.version        = Some(payload.version.unwrap_or_else(|| "0.1.0".to_string()));
    profile.license        = payload.license;
    profile.tags           = payload.tags;
    profile.sections       = payload.sections.iter().map(|s| ProfileSectionDef {
        id:         s.id.clone(),
        element_id: s.element_id.clone(),
        placement:  s.placement.clone(),
        required:   s.required,
        title:      s.title.clone(),
        label:      s.label.clone(),
        guidance:   s.guidance.clone(),
    }).collect();

    let yaml_path = profile_dir.join("profile.yaml");
    let loader = ProfileLoader;
    loader.save_to_file(&profile, &yaml_path).map_err(err)?;

    Ok(profile_to_json(&profile))
}

// ── Helpers ──────────────────────────────────────────────────────

fn profile_to_json(p: &texis_core::profile::Profile) -> Value {
    let meta = format!(
        "{} · {} · {}",
        engine_label(&p.latex_engine),
        p.bibliography_backend,
        bib_style_label(&p.bibliography_style)
    );

    let sections: Vec<Value> = p.sections.iter().map(|s| serde_json::json!({
        "id": s.id,
        "element_id": s.element_id,
        "placement": s.placement,
        "required": s.required,
        "title": s.title,
        "label": s.label,
        "guidance": s.guidance,
    })).collect();

    let status_str = match p.status {
        texis_core::profile::ProfileStatus::Experimental => "experimental",
        texis_core::profile::ProfileStatus::Draft        => "draft",
        texis_core::profile::ProfileStatus::Reviewed     => "reviewed",
        texis_core::profile::ProfileStatus::Verified     => "verified",
        texis_core::profile::ProfileStatus::Stale        => "stale",
        texis_core::profile::ProfileStatus::Deprecated   => "deprecated",
    };

    let verification = p.verification.as_ref().map(|v| serde_json::json!({
        "verified_at": v.verified_at,
        "verified_by": v.verified_by,
        "reviewed_at": v.reviewed_at,
        "reviewed_by": v.reviewed_by,
        "source_urls": v.source_urls,
        "review_interval_days": v.review_interval_days,
    }));

    serde_json::json!({
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "meta": meta,
        "tags": p.tags,
        "sections_count": p.sections.len(),
        "sections": sections,
        "author": p.author,
        "version": p.version,
        "license": p.license,
        "document_class": p.document_class.name,
        "bibliography_style": p.bibliography_style,
        "latex_engine": p.latex_engine,
        "status": status_str,
        "verification": verification,
        "max_words": p.max_words,
        "max_abstract_words": p.max_abstract_words,
    })
}

/// Copia recursivamente `src` a `dst`, preservando la estructura de subdirectorios.
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    for entry in walkdir::WalkDir::new(src).min_depth(1) {
        let entry = entry.map_err(err)?;
        let rel = entry.path().strip_prefix(src).map_err(err)?;
        let dest = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&dest).map_err(err)?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(err)?;
            }
            std::fs::copy(entry.path(), &dest).map_err(err)?;
        }
    }
    Ok(())
}

fn engine_label(engine: &str) -> &str {
    match engine {
        "xelatex"  => "XeLaTeX",
        "pdflatex" => "pdfLaTeX",
        "lualatex" => "LuaLaTeX",
        other      => other,
    }
}

fn bib_style_label(style: &str) -> String {
    match style {
        "apa"       => "APA 7".to_string(),
        "vancouver" => "Vancouver".to_string(),
        "ieee"      => "IEEE".to_string(),
        "chicago"   => "Chicago".to_string(),
        "mla"       => "MLA".to_string(),
        other       => other.to_uppercase(),
    }
}

/// Detecta carpetas de nube instaladas (OneDrive, Google Drive, Dropbox).
#[tauri::command]
pub fn get_cloud_folders() -> Result<Value, String> {
    let mut folders: Vec<Value> = Vec::new();

    // Directorio home del usuario
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\User"));

    // OneDrive (variable de entorno tiene prioridad)
    let onedrive_path = std::env::var("OneDriveConsumer")
        .or_else(|_| std::env::var("OneDrive"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| home.join("OneDrive"));

    if onedrive_path.exists() {
        folders.push(serde_json::json!({
            "service": "OneDrive",
            "path": onedrive_path.to_string_lossy(),
            "icon": "☁",
            "hint": "Microsoft OneDrive — sincroniza automáticamente con tu cuenta Microsoft",
        }));
    }

    // Google Drive (varios nombres posibles)
    for name in &["Google Drive", "My Drive", "GoogleDrive"] {
        let p = home.join(name);
        if p.exists() {
            folders.push(serde_json::json!({
                "service": "Google Drive",
                "path": p.to_string_lossy(),
                "icon": "☁",
                "hint": "Google Drive — sincroniza con tu cuenta Google",
            }));
            break;
        }
    }

    // Dropbox
    let dropbox_info = home
        .join("AppData").join("Roaming").join("Dropbox").join("info.json");
    if dropbox_info.exists() {
        if let Ok(content) = std::fs::read_to_string(&dropbox_info) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                if let Some(path) = json["personal"]["path"].as_str()
                    .or_else(|| json["business"]["path"].as_str()) {
                    let p = PathBuf::from(path);
                    if p.exists() {
                        folders.push(serde_json::json!({
                            "service": "Dropbox",
                            "path": p.to_string_lossy(),
                            "icon": "☁",
                            "hint": "Dropbox — sincroniza con tu cuenta Dropbox",
                        }));
                    }
                }
            }
        }
    }

    Ok(serde_json::json!(folders))
}

/// Ejecuta el System Doctor y devuelve el reporte de diagnóstico del entorno.
#[tauri::command]
pub fn run_system_doctor(
    profile_engine: String,
    bibliography_backend: String,
    bibliography_style: String,
    requires_pdfa: bool,
) -> Result<Value, String> {
    use texis_core::system::doctor;

    let report = doctor::run_doctor(
        &profile_engine,
        &bibliography_backend,
        &bibliography_style,
        requires_pdfa,
    );

    let checks: Vec<Value> = report.checks.iter().map(|c| {
        let status = match c.status {
            doctor::ToolStatus::Available => "available",
            doctor::ToolStatus::Missing   => "missing",
            doctor::ToolStatus::Unknown   => "unknown",
        };
        let hint = c.install_hint.as_ref().map(|h| serde_json::json!({
            "macos":   h.macos,
            "linux":   h.linux,
            "windows": h.windows,
        }));
        serde_json::json!({
            "name":         c.name,
            "status":       status,
            "version":      c.version,
            "description":  c.description,
            "critical":     c.critical,
            "install_hint": hint,
        })
    }).collect();

    Ok(serde_json::json!({
        "checks":               checks,
        "environment_ok":       report.environment_ok,
        "has_critical_missing": report.has_critical_missing,
    }))
}

/// Comprueba si el proyecto tiene profile.lock.yaml y devuelve su contenido.
#[tauri::command]
pub fn check_profile_lock(project_path: String) -> Result<Value, String> {
    use texis_core::profile::lock::{check_lock_status, LockStatus, ProfileLock};

    let dir = std::path::PathBuf::from(&project_path);
    let status = check_lock_status(&dir);

    match status {
        LockStatus::Locked => {
            let lock = ProfileLock::load(&dir).map_err(|e| e.to_string())?;
            Ok(serde_json::json!({
                "locked": true,
                "lock":   lock,
            }))
        }
        LockStatus::Unlocked => {
            Ok(serde_json::json!({
                "locked": false,
                "lock":   null,
            }))
        }
    }
}

/// Crea profile.lock.yaml para el proyecto con el perfil activo.
#[tauri::command]
pub fn create_profile_lock(
    app: tauri::AppHandle,
    project_path: String,
    profile_id: String,
) -> Result<Value, String> {
    use texis_core::profile::lock::ProfileLock;
    use texis_core::profile::ProfileRegistry;

    let project_dir = std::path::PathBuf::from(&project_path);
    let profiles_root = profiles_dir(&app);

    let mut registry = ProfileRegistry::new();
    if profiles_root.exists() {
        registry.load_from_dir(&profiles_root).map_err(err)?;
    }
    let profile = registry
        .get(&profile_id)
        .ok_or_else(|| format!("Perfil '{}' no encontrado.", profile_id))?;

    let profile_yaml_path = profiles_root.join(&profile_id).join("profile.yaml");
    let sha256 = if profile_yaml_path.exists() {
        ProfileLock::sha256_of_file(&profile_yaml_path).unwrap_or_else(|_| "unknown".to_string())
    } else {
        "unknown".to_string()
    };

    let status_str = match profile.status {
        texis_core::profile::ProfileStatus::Draft        => "draft",
        texis_core::profile::ProfileStatus::Reviewed     => "reviewed",
        texis_core::profile::ProfileStatus::Verified     => "verified",
        texis_core::profile::ProfileStatus::Experimental => "experimental",
        texis_core::profile::ProfileStatus::Stale        => "stale",
        texis_core::profile::ProfileStatus::Deprecated   => "deprecated",
    };

    let lock = ProfileLock {
        profile_id:              profile_id.clone(),
        profile_version:         profile.version.clone().unwrap_or_else(|| "0.1.0".to_string()),
        profile_status_at_lock:  status_str.to_string(),
        source:                  "TeXisStudio-Profiles".to_string(),
        sha256,
        locked_at:               chrono::Utc::now().to_rfc3339(),
        texis_core_version:      env!("CARGO_PKG_VERSION").to_string(),
    };

    lock.save(&project_dir).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "locked": true,
        "lock":   lock,
    }))
}

/// Detecta si LaTeX está instalado en el sistema.
#[tauri::command]
pub fn detect_latex() -> Result<Value, String> {
    let info = LatexInstallation::detect();
    Ok(serde_json::json!({
        "has_latexmk":       info.has_latexmk,
        "has_xelatex":       info.has_xelatex,
        "has_biber":         info.has_biber,
        "is_usable":         info.is_usable(),
        "latexmk_usable":    info.latexmk_usable(),
        "latexmk_version":   info.latexmk_version,
        "texlive_year":      info.texlive_year,
        "has_tectonic":      info.has_tectonic,
        "tectonic_version":  info.tectonic_version,
        "available_backends": info.available_backends(),
        "preferred_backend": info.preferred_backend(),
    }))
}
