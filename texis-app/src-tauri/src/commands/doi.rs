// Importador bibliográfico vía DOI usando la API pública de Crossref.
//
// Endpoint: https://api.crossref.org/works/{doi}
// No requiere autenticación. User-Agent recomendado por la política de cortesía.
//
// Retorna una cadena con la entrada BibTeX lista para pegar en references.bib.

use serde::Deserialize;
use std::time::Duration;

const CROSSREF_BASE: &str = "https://api.crossref.org/works/";
const USER_AGENT: &str = concat!(
    "TeXisStudio/",
    env!("CARGO_PKG_VERSION"),
    " (https://github.com/GonzaloAndDev/TeXisStudio; mailto:gaelsd25@gmail.com)"
);
const TIMEOUT_SECS: u64 = 15;

// ── Crossref response types ───────────────────────────────────────────────────

#[derive(Deserialize)]
struct CrossrefResponse {
    message: CrossrefWork,
}

#[derive(Deserialize)]
struct CrossrefWork {
    #[serde(rename = "type")]
    work_type: Option<String>,
    title: Option<Vec<String>>,
    author: Option<Vec<Author>>,
    #[serde(rename = "container-title")]
    container_title: Option<Vec<String>>,
    publisher: Option<String>,
    #[serde(rename = "published")]
    published: Option<DateField>,
    #[serde(rename = "published-print")]
    published_print: Option<DateField>,
    #[serde(rename = "published-online")]
    published_online: Option<DateField>,
    volume: Option<String>,
    issue: Option<String>,
    page: Option<String>,
    #[serde(rename = "DOI")]
    doi: Option<String>,
    #[serde(rename = "URL")]
    url: Option<String>,
    #[serde(rename = "ISBN")]
    isbn: Option<Vec<String>>,
    #[serde(rename = "ISSN")]
    issn: Option<Vec<String>>,
    #[serde(rename = "event")]
    event: Option<EventField>,
    edition_number: Option<String>,
    #[serde(rename = "number")]
    report_number: Option<String>,
    #[serde(rename = "institution")]
    institution: Option<Vec<InstitutionField>>,
    subtitle: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct Author {
    given: Option<String>,
    family: Option<String>,
    name: Option<String>, // para organizaciones
}

#[derive(Deserialize)]
struct DateField {
    #[serde(rename = "date-parts")]
    date_parts: Option<Vec<Vec<i32>>>,
}

#[derive(Deserialize)]
struct EventField {
    name: Option<String>,
}

#[derive(Deserialize)]
struct InstitutionField {
    name: Option<String>,
}

// ── Utilidades ────────────────────────────────────────────────────────────────

/// Convierte un carácter Unicode a su equivalente ASCII minúsculo, cubriendo los
/// diacríticos más comunes del latín. Devuelve None para scripts no latinos.
fn to_ascii_alpha(c: char) -> Option<char> {
    match c {
        'a'..='z' => Some(c),
        'A'..='Z' => Some(c.to_ascii_lowercase()),
        'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' | 'Å' => {
            Some('a')
        }
        'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => Some('e'),
        'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => Some('i'),
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => Some('o'),
        'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => Some('u'),
        'ý' | 'ÿ' | 'Ý' => Some('y'),
        'ñ' | 'Ñ' => Some('n'),
        'ç' | 'Ç' => Some('c'),
        'ß' => Some('s'),
        'æ' | 'Æ' => Some('a'),
        'ø' | 'Ø' => Some('o'),
        'ð' | 'Ð' => Some('d'),
        'þ' | 'Þ' => Some('t'),
        _ => None,
    }
}

/// Sanitiza un valor BibTeX proveniente de Crossref:
/// 1. Normaliza espacios en blanco (colapsa saltos de línea y tabs).
/// 2. Decodifica entidades HTML comunes (&amp;, &lt;, &gt;, etc.).
/// 3. Elimina etiquetas HTML (<i>, <sub>, <sup>…).
/// 4. Elimina llaves desbalanceadas para no romper el parser BibTeX.
fn sanitize_bibtex_value(s: &str) -> String {
    // 1. Normalizar espacios
    let s = s.split_whitespace().collect::<Vec<_>>().join(" ");

    // 2. Decodificar entidades HTML
    let s = s
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");

    // 3. Eliminar etiquetas HTML (no recursivo; suficiente para Crossref)
    let mut stripped = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => stripped.push(c),
            _ => {}
        }
    }

    // 4. Verificar llaves balanceadas; si están desbalanceadas, eliminarlas todas
    let mut depth: i32 = 0;
    let mut balanced = String::with_capacity(stripped.len());
    for c in stripped.chars() {
        match c {
            '{' => {
                depth += 1;
                balanced.push(c);
            }
            '}' => {
                if depth > 0 {
                    depth -= 1;
                    balanced.push(c);
                }
                // llave de cierre sin apertura → se descarta
            }
            c => balanced.push(c),
        }
    }
    if depth != 0 {
        // Llaves abiertas sin cerrar → eliminar todas las llaves del valor
        balanced.chars().filter(|&c| c != '{' && c != '}').collect()
    } else {
        balanced
    }
}

/// Escapa los caracteres especiales de LaTeX en campos de texto plano.
/// Solo para campos como `title`, `author`, `journal`, `publisher`, etc.
/// NO aplicar a `doi`, `url`, `issn`, `isbn` — son verbatim y `\&` rompería una URL.
fn escape_latex_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '%' => out.push_str("\\%"),
            '&' => out.push_str("\\&"),
            '#' => out.push_str("\\#"),
            '$' => out.push_str("\\$"),
            '_' => out.push_str("\\_"),
            '\\' => out.push_str("\\textbackslash{}"),
            '~' => out.push_str("\\textasciitilde{}"),
            '^' => out.push_str("\\textasciicircum{}"),
            c => out.push(c),
        }
    }
    out
}

/// Percent-encodes un path de DOI preservando los caracteres seguros en URLs
/// (RFC 3986 unreserved + `/` y `:` que son estructurales en DOIs).
/// Alias público para que otros módulos de comandos puedan usarlo.
pub fn percent_encode_doi(doi: &str) -> String {
    percent_encode_doi_path(doi)
}

fn percent_encode_doi_path(doi: &str) -> String {
    let mut out = String::with_capacity(doi.len() * 2);
    for c in doi.chars() {
        if c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | '~' | '/' | ':') {
            out.push(c);
        } else {
            let mut buf = [0u8; 4];
            let encoded = c.encode_utf8(&mut buf);
            for byte in encoded.bytes() {
                out.push('%');
                out.push(
                    char::from_digit((byte >> 4) as u32, 16)
                        .unwrap_or('0')
                        .to_ascii_uppercase(),
                );
                out.push(
                    char::from_digit((byte & 0xF) as u32, 16)
                        .unwrap_or('0')
                        .to_ascii_uppercase(),
                );
            }
        }
    }
    out
}

// ── Conversión a BibTeX ───────────────────────────────────────────────────────

fn crossref_type_to_bibtex(work_type: &str) -> &'static str {
    match work_type {
        "journal-article" => "article",
        "book" => "book",
        "monograph" => "book",
        "edited-book" => "book",
        "book-chapter" => "incollection",
        "proceedings-article" => "inproceedings",
        "proceedings" => "proceedings",
        "report" => "techreport",
        "report-component" => "techreport",
        "dataset" => "misc",
        "posted-content" => "misc", // preprints
        "peer-review" => "misc",
        "dissertation" => "phdthesis",
        _ => "misc",
    }
}

fn extract_year(work: &CrossrefWork) -> Option<String> {
    let date = work
        .published
        .as_ref()
        .or(work.published_print.as_ref())
        .or(work.published_online.as_ref())?;
    let parts = date.date_parts.as_ref()?;
    let year = parts.first()?.first()?;
    Some(year.to_string())
}

fn format_authors(authors: &[Author]) -> String {
    authors
        .iter()
        .map(|a| {
            if let (Some(family), Some(given)) = (&a.family, &a.given) {
                format!("{}, {}", family, given)
            } else if let Some(family) = &a.family {
                family.clone()
            } else if let Some(name) = &a.name {
                name.clone()
            } else {
                String::new()
            }
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" and ")
}

/// Genera una citation key estilo "smith2023".
/// Transliteración ASCII para apellidos con diacríticos (García → garcia).
/// Fallback al DOI si el apellido no tiene caracteres ASCII válidos (e.g. 李).
fn make_citation_key(work: &CrossrefWork) -> String {
    let first_family = work
        .author
        .as_deref()
        .and_then(|authors| authors.first())
        .and_then(|a| a.family.as_deref())
        .unwrap_or("");

    let year = extract_year(work).unwrap_or_else(|| "xxxx".to_string());

    let family_slug: String = first_family.chars().filter_map(to_ascii_alpha).collect();

    let slug = if family_slug.is_empty() {
        // Apellido sin representación ASCII (p.ej. 李) → usar primeros 8 chars del DOI
        let doi_slug: String = work
            .doi
            .as_deref()
            .unwrap_or("anon")
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
            .take(8)
            .collect::<String>()
            .to_lowercase();
        if doi_slug.is_empty() {
            "anon".to_string()
        } else {
            doi_slug
        }
    } else {
        family_slug
    };

    format!("{}{}", slug, year)
}

/// `fields`: tuplas `(nombre, valor, es_texto)`.
/// - `es_texto = true`  → aplica HTML clean + balance braces + escape LaTeX.
/// - `es_texto = false` → aplica HTML clean + balance braces (sin escape LaTeX).
///   Usar `false` para `doi`, `url`, `issn`, `isbn`, `year`, `volume`, `pages`, etc.
fn render_bibtex(entry_type: &str, key: &str, fields: &[(&str, String, bool)]) -> String {
    let mut out = format!("@{}{{{},\n", entry_type, key);
    let max_name = fields.iter().map(|(k, _, _)| k.len()).max().unwrap_or(0);
    for (name, value, is_text) in fields {
        let html_clean = sanitize_bibtex_value(value);
        let clean = if *is_text {
            escape_latex_text(&html_clean)
        } else {
            html_clean
        };
        if clean.is_empty() {
            continue;
        }
        out.push_str(&format!(
            "  {:<width$} = {{{}}},\n",
            name,
            clean,
            width = max_name
        ));
    }
    out.push('}');
    out
}

fn work_to_bibtex(work: &CrossrefWork) -> String {
    let work_type = work.work_type.as_deref().unwrap_or("misc");
    let entry_type = crossref_type_to_bibtex(work_type);
    let key = make_citation_key(work);

    let title = work
        .title
        .as_deref()
        .and_then(|t| t.first().cloned())
        .unwrap_or_default();
    // Incluir subtítulo si existe
    let full_title = if let Some(subs) = work.subtitle.as_deref() {
        if let Some(sub) = subs.first() {
            if !sub.is_empty() {
                format!("{}: {}", title, sub)
            } else {
                title
            }
        } else {
            title
        }
    } else {
        title
    };

    let authors = work
        .author
        .as_deref()
        .map(format_authors)
        .unwrap_or_default();
    let year = extract_year(work).unwrap_or_default();
    let doi = work.doi.as_deref().unwrap_or_default().to_string();
    let url = work.url.as_deref().unwrap_or_default().to_string();

    // (nombre, valor, es_texto)
    // es_texto=true  → HTML clean + LaTeX escape (títulos, autores, journals, editores)
    // es_texto=false → HTML clean solo (doi, url, issn, isbn, year, volume, pages)
    let fields: Vec<(&str, String, bool)> = match entry_type {
        "article" => vec![
            ("author", authors, true),
            ("title", full_title, true),
            (
                "journal",
                work.container_title
                    .as_deref()
                    .and_then(|t| t.first().cloned())
                    .unwrap_or_default(),
                true,
            ),
            ("year", year, false),
            (
                "volume",
                work.volume.as_deref().unwrap_or_default().to_string(),
                false,
            ),
            (
                "number",
                work.issue.as_deref().unwrap_or_default().to_string(),
                false,
            ),
            (
                "pages",
                work.page.as_deref().unwrap_or_default().to_string(),
                false,
            ),
            (
                "issn",
                work.issn
                    .as_deref()
                    .and_then(|v| v.first().cloned())
                    .unwrap_or_default(),
                false,
            ),
            ("doi", doi, false),
            ("url", url, false),
        ],
        "book" => vec![
            ("author", authors, true),
            ("title", full_title, true),
            (
                "publisher",
                work.publisher.as_deref().unwrap_or_default().to_string(),
                true,
            ),
            ("year", year, false),
            (
                "edition",
                work.edition_number
                    .as_deref()
                    .unwrap_or_default()
                    .to_string(),
                false,
            ),
            (
                "isbn",
                work.isbn
                    .as_deref()
                    .and_then(|v| v.first().cloned())
                    .unwrap_or_default(),
                false,
            ),
            ("doi", doi, false),
            ("url", url, false),
        ],
        "incollection" => vec![
            ("author", authors, true),
            ("title", full_title, true),
            (
                "booktitle",
                work.container_title
                    .as_deref()
                    .and_then(|t| t.first().cloned())
                    .unwrap_or_default(),
                true,
            ),
            (
                "publisher",
                work.publisher.as_deref().unwrap_or_default().to_string(),
                true,
            ),
            ("year", year, false),
            (
                "pages",
                work.page.as_deref().unwrap_or_default().to_string(),
                false,
            ),
            ("doi", doi, false),
            ("url", url, false),
        ],
        "inproceedings" => vec![
            ("author", authors, true),
            ("title", full_title, true),
            (
                "booktitle",
                work.event
                    .as_ref()
                    .and_then(|e| e.name.clone())
                    .or_else(|| {
                        work.container_title
                            .as_deref()
                            .and_then(|t| t.first().cloned())
                    })
                    .unwrap_or_default(),
                true,
            ),
            ("year", year, false),
            (
                "pages",
                work.page.as_deref().unwrap_or_default().to_string(),
                false,
            ),
            (
                "publisher",
                work.publisher.as_deref().unwrap_or_default().to_string(),
                true,
            ),
            ("doi", doi, false),
            ("url", url, false),
        ],
        "techreport" => vec![
            ("author", authors, true),
            ("title", full_title, true),
            (
                "institution",
                work.institution
                    .as_deref()
                    .and_then(|i| i.first())
                    .and_then(|i| i.name.clone())
                    .or_else(|| work.publisher.clone())
                    .unwrap_or_default(),
                true,
            ),
            ("year", year, false),
            (
                "number",
                work.report_number
                    .as_deref()
                    .unwrap_or_default()
                    .to_string(),
                false,
            ),
            ("doi", doi, false),
            ("url", url, false),
        ],
        "phdthesis" => vec![
            ("author", authors, true),
            ("title", full_title, true),
            (
                "school",
                work.institution
                    .as_deref()
                    .and_then(|i| i.first())
                    .and_then(|i| i.name.clone())
                    .or_else(|| work.publisher.clone())
                    .unwrap_or_default(),
                true,
            ),
            ("year", year, false),
            ("doi", doi, false),
            ("url", url, false),
        ],
        _ => vec![
            ("author", authors, true),
            ("title", full_title, true),
            ("year", year, false),
            ("note", format!("Tipo original: {}", work_type), true),
            ("doi", doi, false),
            ("url", url, false),
        ],
    };

    render_bibtex(entry_type, &key, &fields)
}

// ── Comandos Tauri ────────────────────────────────────────────────────────────

fn normalize_doi(raw: &str) -> String {
    raw.trim()
        .trim_start_matches("https://doi.org/")
        .trim_start_matches("http://doi.org/")
        .trim_start_matches("doi:")
        .trim_start_matches("DOI:")
        .trim()
        .to_string()
}

async fn fetch_bibtex(doi_normalized: &str) -> Result<String, String> {
    let url = format!(
        "{}{}",
        CROSSREF_BASE,
        percent_encode_doi_path(doi_normalized)
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Error al crear cliente HTTP: {e}"))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar Crossref: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("DOI no encontrado en Crossref: {doi_normalized}"));
    }
    if !resp.status().is_success() {
        return Err(format!(
            "Crossref respondió con error HTTP {}",
            resp.status()
        ));
    }

    let crossref: CrossrefResponse = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta de Crossref: {e}"))?;

    Ok(work_to_bibtex(&crossref.message))
}

/// Importa una referencia bibliográfica desde un DOI usando la API de Crossref.
/// Retorna la entrada BibTeX como cadena de texto.
#[tauri::command]
pub async fn import_doi(doi: String) -> Result<String, String> {
    if doi.trim().is_empty() {
        return Err("El DOI no puede estar vacío.".to_string());
    }
    let doi_normalized = normalize_doi(&doi);
    if doi_normalized.is_empty() {
        return Err("DOI inválido.".to_string());
    }
    fetch_bibtex(&doi_normalized).await
}

/// Resultado individual de una importación por lotes.
#[derive(serde::Serialize)]
pub struct BatchDoiResult {
    pub doi: String,
    pub bibtex: Option<String>,
    pub key: Option<String>,
    pub error: Option<String>,
}

/// Importa múltiples DOIs en paralelo (máx. 8 concurrentes para respetar la
/// política de cortesía de Crossref).
/// Acepta una lista de DOIs crudos (con o sin prefijo https://doi.org/).
/// Los DOIs vacíos o duplicados dentro del lote se ignoran silenciosamente.
/// Retorna un resultado por DOI en el mismo orden de entrada (sin duplicados).
#[tauri::command]
pub async fn import_dois_batch(dois: Vec<String>) -> Result<Vec<BatchDoiResult>, String> {
    use std::collections::HashSet;

    // Deduplicar preservando orden
    let mut seen = HashSet::new();
    let unique_dois: Vec<String> = dois
        .into_iter()
        .filter_map(|d| {
            let n = normalize_doi(&d);
            if n.is_empty() || !seen.insert(n.clone()) {
                None
            } else {
                Some(n)
            }
        })
        .collect();

    // Importar con concurrencia limitada (semáforo de 8)
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(8));
    let handles: Vec<_> = unique_dois
        .into_iter()
        .map(|doi| {
            let sem = semaphore.clone();
            tokio::spawn(async move {
                let _permit = sem.acquire().await;
                let result = fetch_bibtex(&doi).await;
                let key = result.as_ref().ok().and_then(|bib| {
                    // Extraer la key del BibTeX generado: primera línea "@tipo{key,"
                    bib.lines().next().and_then(|line| {
                        let after_brace = line.find('{').map(|i| &line[i + 1..])?;
                        let key = after_brace.trim_end_matches(',').trim().to_string();
                        if key.is_empty() {
                            None
                        } else {
                            Some(key)
                        }
                    })
                });
                BatchDoiResult {
                    doi,
                    bibtex: result.as_ref().ok().cloned(),
                    key,
                    error: result.err(),
                }
            })
        })
        .collect();

    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        match handle.await {
            Ok(r) => results.push(r),
            Err(e) => results.push(BatchDoiResult {
                doi: "?".to_string(),
                bibtex: None,
                key: None,
                error: Some(format!("Error interno: {e}")),
            }),
        }
    }
    Ok(results)
}

// ── P4.2 — Preview bibliográfico por estilo ───────────────────────────────────

/// Formatea una entrada BibTeX en texto plano aproximado al estilo indicado.
/// Acepta una cadena BibTeX completa; toma la primera entrada que encuentre.
/// Retorna texto con marcadores *cursiva* y **negrita** para rendering en UI.
#[tauri::command]
pub fn preview_bib_entry(bibtex: String, style: String) -> Result<String, String> {
    use texis_core::bibliography::formatter::format_entry;
    use texis_core::bibliography::parser::BibParser;

    let entries = BibParser.parse_str(&bibtex);
    let entry = entries
        .first()
        .ok_or_else(|| "No se encontró ninguna entrada BibTeX válida.".to_string())?;
    Ok(format_entry(entry, &style))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn latex_text_escape_covers_common_special_chars() {
        let input = r#"R&D_100% #1 $x$ \path ~ caret^"#;
        let escaped = escape_latex_text(input);

        assert!(escaped.contains(r#"R\&D\_100\%"#));
        assert!(escaped.contains(r#"\#1"#));
        assert!(escaped.contains(r#"\$x\$"#));
        assert!(escaped.contains(r#"\textbackslash{}path"#));
        assert!(escaped.contains(r#"\textasciitilde{}"#));
        assert!(escaped.contains(r#"\textasciicircum{}"#));
    }

    #[test]
    fn sanitize_removes_html_and_preserves_balanced_braces() {
        let input = "  <i>Deep</i> &amp; {Learning}  ";
        assert_eq!(sanitize_bibtex_value(input), "Deep & {Learning}");
    }

    #[test]
    fn citation_key_transliterates_latin_diacritics() {
        let work = CrossrefWork {
            work_type: None,
            title: None,
            author: Some(vec![Author {
                given: Some("Ana".to_string()),
                family: Some("García".to_string()),
                name: None,
            }]),
            container_title: None,
            publisher: None,
            published: Some(DateField {
                date_parts: Some(vec![vec![2024]]),
            }),
            published_print: None,
            published_online: None,
            volume: None,
            issue: None,
            page: None,
            doi: None,
            url: None,
            isbn: None,
            issn: None,
            event: None,
            edition_number: None,
            report_number: None,
            institution: None,
            subtitle: None,
        };

        assert_eq!(make_citation_key(&work), "garcia2024");
    }

    #[test]
    fn citation_key_uses_doi_fallback_for_non_latin_family() {
        let work = CrossrefWork {
            work_type: None,
            title: None,
            author: Some(vec![Author {
                given: None,
                family: Some("李".to_string()),
                name: None,
            }]),
            container_title: None,
            publisher: None,
            published: Some(DateField {
                date_parts: Some(vec![vec![2023]]),
            }),
            published_print: None,
            published_online: None,
            volume: None,
            issue: None,
            page: None,
            doi: Some("10.1145/example".to_string()),
            url: None,
            isbn: None,
            issn: None,
            event: None,
            edition_number: None,
            report_number: None,
            institution: None,
            subtitle: None,
        };

        assert_eq!(make_citation_key(&work), "101145ex2023");
    }

    #[test]
    fn doi_path_is_percent_encoded() {
        assert_eq!(
            percent_encode_doi_path("10.1000/a b?c"),
            "10.1000/a%20b%3Fc",
        );
    }

    #[test]
    fn render_bibtex_escapes_text_but_not_url_fields() {
        let rendered = render_bibtex(
            "article",
            "smith2024",
            &[
                ("title", "R&D_100%".to_string(), true),
                ("url", "https://example.com/a_b?x=1&y=2".to_string(), false),
            ],
        );

        assert!(rendered.contains(r#"title = {R\&D\_100\%}"#));
        assert!(rendered.contains("url   = {https://example.com/a_b?x=1&y=2}"));
    }
}

// ── Capa de BibliographicRecord — motor bibliográfico unificado ───────────────
// Convierte la respuesta de Crossref al modelo interno canónico.
// La capa anterior (fetch_bibtex / work_to_bibtex) se mantiene para compatibilidad
// con la UI existente; esta capa nueva alimenta el BibliographyRegistry.

use chrono::Utc;
use std::collections::HashSet;
use texis_core::bibliography::model::{provider, BibliographicRecord, PersonName, RecordType};
use texis_core::bibliography::normalization::{
    clean_title, generate_cite_key, map_crossref_type, normalize_doi as norm_doi, normalize_isbn,
    parse_crossref_date_parts,
};

fn work_to_record(work: &CrossrefWork, doi_normalized: &str) -> BibliographicRecord {
    let record_type = work
        .work_type
        .as_deref()
        .map(map_crossref_type)
        .unwrap_or(RecordType::Unknown);

    // Citation key
    let first_family = work
        .author
        .as_deref()
        .and_then(|a| a.first())
        .and_then(|a| a.family.as_deref())
        .unwrap_or("");

    let year = work
        .published
        .as_ref()
        .or(work.published_print.as_ref())
        .or(work.published_online.as_ref())
        .and_then(|d| d.date_parts.as_deref())
        .and_then(|parts| parts.first())
        .and_then(|row| row.first())
        .copied();

    let cite_key = generate_cite_key(first_family, year, Some(doi_normalized), &HashSet::new());

    let mut record = BibliographicRecord::new(cite_key, record_type);
    record.doi = Some(doi_normalized.to_string());

    // Título con subtítulo
    let title_base = work
        .title
        .as_deref()
        .and_then(|t| t.first())
        .cloned()
        .unwrap_or_default();
    let subtitle_part = work
        .subtitle
        .as_deref()
        .and_then(|s| s.first())
        .filter(|s| !s.is_empty())
        .cloned();
    record.title = Some(clean_title(&title_base));
    record.subtitle = subtitle_part.map(|s| clean_title(&s));

    // Fecha
    let date_source = work
        .published
        .as_ref()
        .or(work.published_print.as_ref())
        .or(work.published_online.as_ref());
    if let Some(date_field) = date_source {
        if let Some(parts) = &date_field.date_parts {
            let parsed = parse_crossref_date_parts(parts);
            record.year = parsed.year;
            record.date = parsed.date;
        }
    }

    // Autores
    if let Some(authors) = &work.author {
        record.authors = authors
            .iter()
            .map(|a| {
                if let (Some(family), Some(given)) = (&a.family, &a.given) {
                    PersonName::new_person(family, given)
                } else if let Some(name) = &a.name {
                    PersonName::new_organization(name)
                } else {
                    PersonName::new_organization(a.family.as_deref().unwrap_or(""))
                }
            })
            .collect();
    }

    // Journal / booktitle / institution según tipo
    let container = work
        .container_title
        .as_deref()
        .and_then(|t| t.first())
        .cloned();
    match &record.record_type {
        RecordType::Article => record.journal = container,
        RecordType::BookChapter | RecordType::ConferencePaper => {
            record.booktitle =
                container.or_else(|| work.event.as_ref().and_then(|e| e.name.clone()));
        }
        RecordType::Thesis | RecordType::TechReport => {
            record.institution = work
                .institution
                .as_deref()
                .and_then(|i| i.first())
                .and_then(|i| i.name.clone())
                .or_else(|| work.publisher.clone());
        }
        _ => {}
    }

    record.publisher = work.publisher.clone();
    record.volume = work.volume.clone();
    record.issue = work.issue.clone();
    record.pages = work.page.clone();
    record.edition = work.edition_number.clone();
    record.url = work.url.clone();

    record.isbn = work
        .isbn
        .as_deref()
        .and_then(|v| v.first())
        .and_then(|s| normalize_isbn(s));
    record.issn = work.issn.as_deref().and_then(|v| v.first()).cloned();

    // Provenance
    record
        .provenance
        .set_field_source("*", provider::CROSSREF, Utc::now());
    record.provenance.primary_provider = Some(provider::CROSSREF.to_string());

    record
}

/// Fetch interno que retorna BibliographicRecord (motor unificado).
/// Conserva también el raw payload de Crossref para trazabilidad.
pub async fn fetch_record(doi_normalized: &str) -> Result<BibliographicRecord, String> {
    let url = format!(
        "{}{}",
        CROSSREF_BASE,
        percent_encode_doi_path(doi_normalized)
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Error al crear cliente HTTP: {e}"))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar Crossref: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("DOI no encontrado en Crossref: {doi_normalized}"));
    }
    if !resp.status().is_success() {
        return Err(format!("Crossref respondió con HTTP {}", resp.status()));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta de Crossref: {e}"))?;

    let response: CrossrefResponse = serde_json::from_value(raw.clone())
        .map_err(|e| format!("Error al deserializar respuesta de Crossref: {e}"))?;

    let mut record = work_to_record(&response.message, doi_normalized);
    record.provenance.set_raw_payload(provider::CROSSREF, raw);
    Ok(record)
}

/// Importa por DOI y retorna BibliographicRecord serializado como JSON.
/// Usa el motor bibliográfico unificado (a diferencia de import_doi que retorna BibTeX).
#[tauri::command]
pub async fn import_doi_as_record(doi: String) -> Result<serde_json::Value, String> {
    if doi.trim().is_empty() {
        return Err("El DOI no puede estar vacío.".to_string());
    }
    let normalized = norm_doi(doi.trim()).ok_or_else(|| format!("DOI inválido: '{}'", doi))?;
    let record = fetch_record(&normalized).await?;
    serde_json::to_value(&record).map_err(|e| format!("Error al serializar registro: {e}"))
}

/// Búsqueda por título en Crossref.
pub async fn search_by_title(query: &str, limit: u8) -> Result<Vec<BibliographicRecord>, String> {
    let url = format!(
        "{}?query={}&rows={}",
        CROSSREF_BASE,
        urlencoding::encode(query),
        limit.min(20)
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Error al crear cliente HTTP: {e}"))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Crossref respondió con HTTP {}", resp.status()));
    }

    #[derive(serde::Deserialize)]
    struct SearchResponse {
        message: SearchMessage,
    }
    #[derive(serde::Deserialize)]
    struct SearchMessage {
        items: Vec<CrossrefWork>,
    }

    let search: SearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear resultados: {e}"))?;

    let records = search
        .message
        .items
        .iter()
        .filter_map(|work| {
            let doi_norm = work.doi.as_deref().and_then(norm_doi)?;
            Some(work_to_record(work, &doi_norm))
        })
        .collect();

    Ok(records)
}

/// Busca por título en Crossref y retorna resultados serializados.
#[tauri::command]
pub async fn search_crossref(
    query: String,
    limit: Option<u8>,
) -> Result<Vec<serde_json::Value>, String> {
    if query.trim().is_empty() {
        return Err("La consulta no puede estar vacía.".to_string());
    }
    let records = search_by_title(&query, limit.unwrap_or(10)).await?;
    records
        .iter()
        .map(|r| serde_json::to_value(r).map_err(|e| format!("{e}")))
        .collect()
}
