// Descarga e instalación de perfiles remotos (biblioteca de comunidad).

use serde_json::Value;
use std::io::Cursor;
use std::path::PathBuf;
use tauri::Manager;
use texis_core::profile::ProfileLoader;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn profiles_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("profiles");
        if p.exists() {
            return p;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent().and_then(|p| p.parent())
        .map(|root| root.join("profiles"))
        .unwrap_or_else(|| PathBuf::from("profiles"))
}

fn profile_to_json(p: &texis_core::profile::Profile) -> Value {
    let meta = format!(
        "{} · {} · {}",
        p.latex_engine, p.bibliography_backend, p.bibliography_style,
    );
    let sections: Vec<Value> = p.sections.iter().map(|s| serde_json::json!({
        "id": s.id, "element_id": s.element_id,
        "placement": s.placement, "required": s.required,
        "title": s.title, "label": s.label,
    })).collect();
    serde_json::json!({
        "id": p.id, "name": p.name, "description": p.description,
        "meta": meta, "tags": p.tags, "sections_count": p.sections.len(),
        "sections": sections, "author": p.author, "version": p.version,
        "license": p.license, "document_class": p.document_class.name,
        "bibliography_style": p.bibliography_style, "latex_engine": p.latex_engine,
    })
}

/// Descarga un ZIP desde `url`, busca un profile.yaml dentro de él,
/// y lo instala en el directorio de perfiles de la app.
///
/// Formato esperado del ZIP: el archivo puede tener un directorio raíz arbitrario
/// (como GitHub añade `{repo}-{branch}/`). El instalador busca el `profile.yaml`
/// más superficial y usa su directorio padre como raíz del perfil.
#[tauri::command]
pub async fn fetch_remote_profile(
    app: tauri::AppHandle,
    url: String,
) -> Result<Value, String> {
    // 1. Descargar ZIP
    let response = reqwest::get(&url).await.map_err(|e| {
        format!("Error descargando desde '{}': {}", url, e)
    })?;

    if !response.status().is_success() {
        return Err(format!(
            "El servidor respondió {} para '{}'.",
            response.status(), url
        ));
    }

    let bytes = response.bytes().await.map_err(err)?.to_vec();

    // 2. Abrir el ZIP en memoria
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes.clone())).map_err(|e| {
        format!("El archivo descargado no es un ZIP válido: {}", e)
    })?;

    // 3. Coleccionar todos los nombres de archivo del ZIP
    let all_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    // 4. Buscar el profile.yaml más superficial
    let profile_path_in_zip = find_profile_yaml_in_names(&all_names)?;

    // El directorio del perfil dentro del ZIP es el padre del profile.yaml
    let profile_dir_in_zip = {
        let p = std::path::Path::new(&profile_path_in_zip);
        p.parent()
            .map(|d| {
                let s = d.to_string_lossy().replace('\\', "/");
                if s.is_empty() { s } else { format!("{}/", s) }
            })
            .unwrap_or_default()
    };

    // 5. Extraer el perfil a un directorio temporal (reabrir el ZIP)
    let temp_dir = std::env::temp_dir().join(format!("texis-remote-{}", uuid_short()));
    std::fs::create_dir_all(&temp_dir).map_err(err)?;

    let mut archive2 = zip::ZipArchive::new(Cursor::new(bytes)).map_err(err)?;

    for i in 0..archive2.len() {
        let mut file = archive2.by_index(i).map_err(err)?;
        let raw_path = file.name().replace('\\', "/");

        // Solo extraer archivos dentro del directorio del perfil
        let relative = if profile_dir_in_zip.is_empty() {
            raw_path.clone()
        } else if raw_path.starts_with(&profile_dir_in_zip) {
            raw_path[profile_dir_in_zip.len()..].to_string()
        } else {
            continue;
        };

        if relative.is_empty() || relative.ends_with('/') {
            continue; // es un directorio
        }

        let dest_file = temp_dir.join(&relative);
        if let Some(parent) = dest_file.parent() {
            std::fs::create_dir_all(parent).map_err(err)?;
        }

        let mut out = std::fs::File::create(&dest_file).map_err(err)?;
        std::io::copy(&mut file, &mut out).map_err(err)?;
    }

    // 6. Cargar y validar el perfil temporal
    let temp_yaml = temp_dir.join("profile.yaml");
    if !temp_yaml.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("No se encontró profile.yaml en el ZIP descargado.".to_string());
    }

    let loader = ProfileLoader;
    let profile = loader.load_from_file(&temp_yaml).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("profile.yaml inválido: {}", e)
    })?;

    // 7. Verificar que el perfil no esté ya instalado
    let profiles_root = profiles_dir(&app);
    let dest_dir = profiles_root.join(&profile.id);

    if dest_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!(
            "El perfil '{}' ya está instalado. Elimínalo primero para reinstalarlo.",
            profile.id
        ));
    }

    // 8. Copiar al directorio de perfiles
    std::fs::create_dir_all(&dest_dir).map_err(err)?;
    for entry in std::fs::read_dir(&temp_dir).map_err(err)? {
        let entry = entry.map_err(err)?;
        let dest_file = dest_dir.join(entry.file_name());
        std::fs::copy(entry.path(), dest_file).map_err(err)?;
    }
    let _ = std::fs::remove_dir_all(&temp_dir);

    Ok(profile_to_json(&profile))
}

// ── Helpers ──────────────────────────────────────────────────────

/// Busca el `profile.yaml` de menor profundidad dentro de una lista de nombres de archivo ZIP.
fn find_profile_yaml_in_names(names: &[String]) -> Result<String, String> {
    let mut candidates: Vec<(usize, &str)> = names
        .iter()
        .filter(|n| {
            let p = std::path::Path::new(n.as_str());
            p.file_name().and_then(|f| f.to_str()) == Some("profile.yaml")
        })
        .map(|n| {
            let depth = n.chars().filter(|&c| c == '/' || c == '\\').count();
            (depth, n.as_str())
        })
        .collect();

    if candidates.is_empty() {
        return Err("El ZIP no contiene ningún archivo profile.yaml.".to_string());
    }

    candidates.sort_by_key(|(depth, _)| *depth);
    Ok(candidates[0].1.to_string())
}

/// UUID corto para nombres de directorio temporal.
fn uuid_short() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:08x}", t)
}
