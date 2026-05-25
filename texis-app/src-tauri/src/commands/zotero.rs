// Integración con Zotero + Better BibTeX (BBT).
//
// Zotero con el plugin Better BibTeX expone una API local en:
//   http://localhost:23119/better-bibtex/
//
// Esta integración NO requiere que el usuario configure nada — simplemente
// detecta si Zotero está corriendo y ofrece importar referencias.
//
// Endpoints utilizados:
//   GET  /better-bibtex/cayw?probe=true        → verifica disponibilidad
//   POST /better-bibtex/json-rpc               → API JSON-RPC (búsqueda, exportación)

use serde::{Deserialize, Serialize};
use std::time::Duration;

const BBT_BASE: &str = "http://localhost:23119/better-bibtex";
const TIMEOUT_SECS: u64 = 5;

// ── Tipos de respuesta ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ZoteroStatus {
    pub available: bool,
    pub version: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZoteroItem {
    pub key: String,
    pub title: String,
    pub author: String,
    pub year: String,
    pub item_type: String,
    pub cite_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZoteroImportResult {
    pub key: String,
    pub bibtex: Option<String>,
    pub cite_key: Option<String>,
    pub error: Option<String>,
}

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

#[derive(Serialize)]
struct RpcRequest<'a, P: Serialize> {
    jsonrpc: &'a str,
    method: &'a str,
    params: P,
    id: u32,
}

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    message: String,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build()
        .expect("failed to build HTTP client")
}

// ── Comandos Tauri ───────────────────────────────────────────────────────────

/// Verifica si Zotero con Better BibTeX está corriendo localmente.
#[tauri::command]
pub async fn check_zotero_status() -> Result<ZoteroStatus, String> {
    let url = format!("{BBT_BASE}/cayw?probe=true");
    match client().get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await.unwrap_or_default();
            let available = body.trim() == "ready" || body.trim().contains("ready");
            // Obtener versión desde la respuesta de ping
            let version = if available {
                fetch_bbt_version().await
            } else {
                None
            };
            Ok(ZoteroStatus { available, version, message: None })
        }
        Ok(resp) => Ok(ZoteroStatus {
            available: false,
            version: None,
            message: Some(format!("Zotero respondió con estado {}", resp.status())),
        }),
        Err(_) => Ok(ZoteroStatus {
            available: false,
            version: None,
            message: Some(
                "Zotero no está en ejecución o Better BibTeX no está instalado.".to_string(),
            ),
        }),
    }
}

async fn fetch_bbt_version() -> Option<String> {
    // BBT expone la versión en la respuesta de búsqueda vacía o en headers.
    // Alternativa: parsear la página de about si está disponible.
    // Por ahora devolvemos None — la versión no es crítica para la integración.
    None
}

/// Busca ítems en la librería de Zotero usando Better BibTeX.
///
/// Retorna hasta 50 resultados. Si `query` está vacío, retorna los últimos 50
/// ítems añadidos a la librería.
#[tauri::command]
pub async fn search_zotero(query: String) -> Result<Vec<ZoteroItem>, String> {
    let request = RpcRequest {
        jsonrpc: "2.0",
        method: "item.search",
        params: vec![query.as_str()],
        id: 1,
    };

    let resp = client()
        .post(format!("{BBT_BASE}/json-rpc"))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con Zotero: {e}"))?;

    let rpc: RpcResponse<serde_json::Value> = resp
        .json()
        .await
        .map_err(|e| format!("Respuesta inesperada de Zotero: {e}"))?;

    if let Some(err) = rpc.error {
        return Err(format!("Zotero error: {}", err.message));
    }

    let items = rpc.result.unwrap_or(serde_json::Value::Array(vec![]));
    let items_arr = items.as_array().cloned().unwrap_or_default();

    let mut result = Vec::new();
    for item in items_arr.iter().take(50) {
        let key = item["key"].as_str().unwrap_or("").to_string();
        if key.is_empty() {
            continue;
        }
        let title = item["title"].as_str().unwrap_or("(sin título)").to_string();
        let item_type = item["itemType"].as_str().unwrap_or("unknown").to_string();
        let year = item["date"]
            .as_str()
            .and_then(|d| d.split('-').next())
            .unwrap_or("")
            .to_string();

        let author = extract_first_author(item);
        let cite_key = item["citekey"].as_str().map(|s| s.to_string());

        result.push(ZoteroItem { key, title, author, year, item_type, cite_key });
    }

    Ok(result)
}

fn extract_first_author(item: &serde_json::Value) -> String {
    if let Some(creators) = item["creators"].as_array() {
        if let Some(first) = creators.first() {
            let last = first["lastName"].as_str().unwrap_or("");
            let first_name = first["firstName"].as_str().unwrap_or("");
            if !last.is_empty() {
                return if first_name.is_empty() {
                    last.to_string()
                } else {
                    format!("{last}, {}", &first_name[..1.min(first_name.len())])
                };
            }
        }
    }
    String::new()
}

/// Importa ítems de Zotero como BibTeX usando la API Better BibTeX.
///
/// `keys` es una lista de Zotero item keys (ej. "ABCD1234").
/// Retorna el BibTeX listo para añadir al .bib del proyecto.
#[tauri::command]
pub async fn import_zotero_items(keys: Vec<String>) -> Result<Vec<ZoteroImportResult>, String> {
    if keys.is_empty() {
        return Ok(vec![]);
    }

    // BBT item.bibliography retorna BibTeX para una lista de keys
    let params = serde_json::json!([{
        "quickCopy": true,
        "contentType": "application/x-bibtex",
        "id": keys
    }]);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "item.bibliography",
        "params": params,
        "id": 1
    });

    let resp = client()
        .post(format!("{BBT_BASE}/json-rpc"))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con Zotero: {e}"))?;

    let rpc: RpcResponse<String> = resp
        .json()
        .await
        .map_err(|e| format!("Respuesta inesperada de Zotero: {e}"))?;

    if let Some(err) = rpc.error {
        return Err(format!("Zotero Better BibTeX error: {}", err.message));
    }

    let bibtex_raw = rpc.result.unwrap_or_default();

    // BBT devuelve todos los ítems en un solo string BibTeX concatenado.
    // Dividimos por entradas (@type{key,...}) para mapear cada key.
    let results = split_bibtex_entries(&bibtex_raw, &keys);
    Ok(results)
}

/// Divide un bloque BibTeX concatenado en entradas individuales.
fn split_bibtex_entries(bibtex: &str, requested_keys: &[String]) -> Vec<ZoteroImportResult> {
    let mut results: Vec<ZoteroImportResult> = requested_keys
        .iter()
        .map(|k| ZoteroImportResult {
            key: k.clone(),
            bibtex: None,
            cite_key: None,
            error: Some("No se encontró en Zotero o no se pudo exportar.".to_string()),
        })
        .collect();

    // Cada entrada empieza con @type{
    let mut current = String::new();
    let mut brace_depth = 0i32;
    let mut in_entry = false;

    for ch in bibtex.chars() {
        match ch {
            '@' if !in_entry => {
                current.clear();
                current.push(ch);
                in_entry = true;
                brace_depth = 0;
            }
            '{' if in_entry => {
                brace_depth += 1;
                current.push(ch);
            }
            '}' if in_entry => {
                brace_depth -= 1;
                current.push(ch);
                if brace_depth == 0 {
                    // Entrada completa — extraer la citekey
                    let entry = current.trim().to_string();
                    if let Some(ck) = extract_cite_key(&entry) {
                        // Buscar si coincide con alguno de los keys Zotero
                        // (BBT puede cambiar el key; usamos el índice del resultado)
                        if let Some(r) = results.iter_mut().find(|r| r.bibtex.is_none()) {
                            r.bibtex = Some(entry);
                            r.cite_key = Some(ck);
                            r.error = None;
                        }
                    }
                    current.clear();
                    in_entry = false;
                }
            }
            _ if in_entry => {
                current.push(ch);
            }
            _ => {}
        }
    }

    results
}

fn extract_cite_key(entry: &str) -> Option<String> {
    // @type{CITEKEY, ...}
    let after_at = entry.find('{')? + 1;
    let after_brace = &entry[after_at..];
    let end = after_brace.find(|c: char| c == ',' || c == '\n')?;
    let key = after_brace[..end].trim().to_string();
    if key.is_empty() { None } else { Some(key) }
}
