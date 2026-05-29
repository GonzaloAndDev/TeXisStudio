// Descarga e instalación de perfiles remotos (biblioteca de comunidad).

use futures_util::StreamExt;
use serde_json::Value;
use std::io::Cursor;
use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;
use texis_core::profile::ProfileLoader;

/// Tamaño máximo del ZIP descargado: 10 MB.
const MAX_ZIP_BYTES: usize = 10 * 1024 * 1024;
/// Tamaño máximo total descomprimido: 50 MB.
const MAX_UNCOMPRESSED_BYTES: u64 = 50 * 1024 * 1024;
/// Número máximo de entradas en el ZIP.
const MAX_ZIP_ENTRIES: usize = 200;

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
        .parent()
        .and_then(|p| p.parent())
        .map(|root| root.join("profiles"))
        .unwrap_or_else(|| PathBuf::from("profiles"))
}

fn profile_to_json(p: &texis_core::profile::Profile) -> Value {
    let meta = format!(
        "{} · {} · {}",
        p.latex_engine, p.bibliography_backend, p.bibliography_style,
    );
    let sections: Vec<Value> = p
        .sections
        .iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id, "element_id": s.element_id,
                "placement": s.placement, "required": s.required,
                "title": s.title, "label": s.label,
                "guidance": s.guidance,
            })
        })
        .collect();
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
    expected_sha256: Option<String>,
) -> Result<Value, String> {
    // 0. Validar URL con parser formal — exigir HTTPS y host presente
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL inválida '{}': {}", url, e))?;
    if parsed.scheme() != "https" {
        return Err("Solo se permiten descargas mediante HTTPS.".to_string());
    }
    if parsed.host().is_none() {
        return Err("La URL no contiene un host válido.".to_string());
    }

    // 1. Descargar ZIP con timeout y límite de tamaño
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(err)?;

    let response = client
        .get(parsed)
        .send()
        .await
        .map_err(|e| format!("Error descargando desde '{}': {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "El servidor respondió {} para '{}'.",
            response.status(),
            url
        ));
    }

    // Rechazar si Content-Length supera el límite
    if let Some(len) = response.content_length() {
        if len as usize > MAX_ZIP_BYTES {
            return Err(format!(
                "El archivo es demasiado grande ({} bytes, máximo {} bytes).",
                len, MAX_ZIP_BYTES
            ));
        }
    }

    // Leer el stream limitando la cantidad de bytes acumulados
    let mut bytes: Vec<u8> = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(err)?;
        bytes.extend_from_slice(&chunk);
        if bytes.len() > MAX_ZIP_BYTES {
            return Err(format!(
                "El archivo supera el tamaño máximo permitido ({} bytes).",
                MAX_ZIP_BYTES
            ));
        }
    }

    // 2. Verificar SHA256 si el llamador proporcionó el hash esperado
    if let Some(expected) = &expected_sha256 {
        let expected = expected.trim().to_lowercase();
        if !expected.is_empty() {
            let valid_sha = expected.len() == 64 && expected.chars().all(|c| c.is_ascii_hexdigit());
            if !valid_sha {
                return Err("El hash SHA-256 esperado no tiene un formato válido.".to_string());
            }
            let digest = sha256_bytes(&bytes);
            if digest != expected {
                return Err(format!(
                    "El archivo descargado no coincide con el hash esperado.\n\
                     Esperado:  {}\n\
                     Obtenido:  {}\n\
                     El archivo puede estar dañado o haber sido modificado.",
                    expected, digest
                ));
            }
        }
    }

    // 3. Abrir el ZIP en memoria
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes.clone()))
        .map_err(|e| format!("El archivo descargado no es un ZIP válido: {}", e))?;

    // Límite de número de entradas
    if archive.len() > MAX_ZIP_ENTRIES {
        return Err(format!(
            "El ZIP contiene demasiadas entradas ({}, máximo {}).",
            archive.len(),
            MAX_ZIP_ENTRIES
        ));
    }

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
                if s.is_empty() {
                    s
                } else {
                    format!("{}/", s)
                }
            })
            .unwrap_or_default()
    };

    // 5. Extraer el perfil a un directorio temporal con nombre único (TempDir)
    let temp_guard = tempfile::Builder::new()
        .prefix("texis-remote-")
        .tempdir()
        .map_err(err)?;
    let temp_dir = temp_guard.path();

    let mut archive2 = zip::ZipArchive::new(Cursor::new(bytes)).map_err(err)?;
    let mut uncompressed_total: u64 = 0;

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

        // Rechazar rutas vacías, absolutas o con path traversal
        if relative.starts_with('/') || relative.split('/').any(|seg| seg == ".." || seg.is_empty())
        {
            continue;
        }

        // Límite de tamaño descomprimido (defensa contra ZIP bombs)
        uncompressed_total += file.size();
        if uncompressed_total > MAX_UNCOMPRESSED_BYTES {
            return Err(format!(
                "El contenido descomprimido supera el límite de {} MB.",
                MAX_UNCOMPRESSED_BYTES / 1024 / 1024
            ));
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
        return Err("No se encontró profile.yaml en el ZIP descargado.".to_string());
    }

    let loader = ProfileLoader;
    let profile = loader
        .load_from_file(&temp_yaml)
        .map_err(|e| format!("profile.yaml inválido: {}", e))?;

    // 7. Verificar que el perfil no esté ya instalado
    let profiles_root = profiles_dir(&app);
    let dest_dir = profiles_root.join(&profile.id);

    if dest_dir.exists() {
        return Err(format!(
            "El perfil '{}' ya está instalado. Elimínalo primero para reinstalarlo.",
            profile.id
        ));
    }

    // 8. Copiar al directorio de perfiles (recursivo para subdirectorios)
    std::fs::create_dir_all(&dest_dir).map_err(err)?;
    if let Err(e) = copy_dir_recursive(temp_dir, &dest_dir) {
        let _ = std::fs::remove_dir_all(&dest_dir);
        return Err(e);
    }
    // temp_guard se limpia automáticamente al salir del scope

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

/// Devuelve el digest SHA-256 de `data` como cadena hexadecimal en minúsculas.
fn sha256_bytes(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(data))
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
