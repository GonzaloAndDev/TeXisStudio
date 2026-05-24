use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;
use texis_core::compiler::detector::LatexInstallation;
use texis_core::profile::ProfileRegistry;

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

    // Copiar todos los archivos del directorio fuente
    let src_dir = profile_yaml.parent().unwrap_or(src);
    for entry in std::fs::read_dir(src_dir).map_err(err)? {
        let entry = entry.map_err(err)?;
        let dest_file = dest_dir.join(entry.file_name());
        std::fs::copy(entry.path(), dest_file).map_err(err)?;
    }

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

    for entry in std::fs::read_dir(&src_dir).map_err(err)? {
        let entry = entry.map_err(err)?;
        let dest_file = dest.join(entry.file_name());
        std::fs::copy(entry.path(), dest_file).map_err(err)?;
    }

    Ok(serde_json::json!({
        "exported_to": dest.to_string_lossy(),
        "profile_id": profile_id,
    }))
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
    })).collect();

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
    })
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
