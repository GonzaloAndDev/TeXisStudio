use serde_json::Value;
use std::path::PathBuf;
use texis_core::compiler::detector::LatexInstallation;

/// Devuelve los perfiles disponibles (builtin + desde directorio de la app).
#[tauri::command]
pub fn get_profiles() -> Result<Value, String> {
    // Por ahora devuelve los perfiles builtin hardcodeados.
    // En Release 0.3 se cargará desde el directorio de perfiles.
    Ok(serde_json::json!([
        {
            "id": "generic.thesis",
            "name": "Tesis genérica",
            "description": "Estructura clásica con marco teórico, metodología, resultados y conclusiones.",
            "meta": "XeLaTeX · biber · APA 7",
            "tags": ["tesis", "licenciatura", "maestria", "doctorado"],
        },
        {
            "id": "generic.tesina",
            "name": "Tesina",
            "description": "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
            "meta": "XeLaTeX · biber · APA 7",
            "tags": ["tesina", "licenciatura"],
        },
    ]))
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
        "has_latexmk": info.has_latexmk,
        "has_xelatex": info.has_xelatex,
        "has_biber": info.has_biber,
        "is_usable": info.is_usable(),
        "latexmk_version": info.latexmk_version,
        "texlive_year": info.texlive_year,
    }))
}
