// Cliente OpenAlex — búsqueda por título/autor/DOI y enriquecimiento de metadatos.
// API: https://api.openalex.org/works
// Sin autenticación. Polite pool: incluir mailto en User-Agent.

use chrono::Utc;
use serde::Deserialize;
use std::time::Duration;
use texis_core::bibliography::model::{provider, BibliographicRecord, PersonName, RecordType};
use texis_core::bibliography::normalization::{
    clean_title, map_openalex_type, normalize_doi, parse_date_str,
};

const OPENALEX_BASE: &str = "https://api.openalex.org/works";
const USER_AGENT: &str = concat!(
    "TeXisStudio/",
    env!("CARGO_PKG_VERSION"),
    " (https://github.com/GonzaloAndDev/TeXisStudio; mailto:gaelsd25@gmail.com)"
);
const TIMEOUT_SECS: u64 = 15;

// ── Response types ────────────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Deserialize)]
struct OpenAlexWork {
    id: Option<String>,
    doi: Option<String>,
    title: Option<String>,
    #[serde(rename = "type")]
    work_type: Option<String>,
    publication_year: Option<i32>,
    publication_date: Option<String>,
    authorships: Option<Vec<Authorship>>,
    primary_location: Option<Location>,
    biblio: Option<Biblio>,
    #[serde(rename = "abstract_inverted_index")]
    abstract_inverted_index: Option<std::collections::HashMap<String, Vec<usize>>>,
    language: Option<String>,
    cited_by_count: Option<u32>,
    open_access: Option<OpenAccess>,
    concepts: Option<Vec<Concept>>,
}

#[derive(Deserialize)]
struct Authorship {
    author: Option<AuthorInfo>,
    #[serde(rename = "author_position")]
    position: Option<String>,
}

#[derive(Deserialize)]
struct AuthorInfo {
    id: Option<String>,
    display_name: Option<String>,
    orcid: Option<String>,
}

#[derive(Deserialize)]
struct Location {
    source: Option<Source>,
    #[serde(rename = "pdf_url")]
    pdf_url: Option<String>,
}

#[derive(Deserialize)]
struct Source {
    display_name: Option<String>,
    issn_l: Option<String>,
    publisher: Option<String>,
}

#[derive(Deserialize)]
struct Biblio {
    volume: Option<String>,
    issue: Option<String>,
    first_page: Option<String>,
    last_page: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct OpenAccess {
    is_oa: Option<bool>,
    oa_url: Option<String>,
    license: Option<String>,
}

#[derive(Deserialize)]
struct Concept {
    display_name: Option<String>,
    level: Option<u8>,
    score: Option<f32>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct OpenAlexListResponse {
    results: Vec<OpenAlexWork>,
    meta: Option<OpenAlexMeta>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct OpenAlexMeta {
    count: Option<u64>,
}

// ── Reconstrucción del abstract desde inverted index ─────────────────────────

fn rebuild_abstract(inverted_index: &std::collections::HashMap<String, Vec<usize>>) -> String {
    let mut positions: Vec<(usize, &str)> = inverted_index
        .iter()
        .flat_map(|(word, pos_list)| pos_list.iter().map(move |&p| (p, word.as_str())))
        .collect();
    positions.sort_by_key(|(p, _)| *p);
    positions
        .iter()
        .map(|(_, word)| *word)
        .collect::<Vec<_>>()
        .join(" ")
}

// ── Conversión a BibliographicRecord ──────────────────────────────────────────

fn work_to_record(work: &OpenAlexWork) -> BibliographicRecord {
    let record_type = work
        .work_type
        .as_deref()
        .map(map_openalex_type)
        .unwrap_or(RecordType::Unknown);

    let doi_normalized = work.doi.as_deref().and_then(normalize_doi);

    // Citation key
    let first_family = work
        .authorships
        .as_deref()
        .and_then(|as_| as_.first())
        .and_then(|a| a.author.as_ref())
        .and_then(|a| a.display_name.as_deref())
        .and_then(|name| name.split_whitespace().last())
        .unwrap_or("unknown");

    let year = work.publication_year;
    let cite_key = texis_core::bibliography::normalization::generate_cite_key(
        first_family,
        year,
        doi_normalized.as_deref(),
        &std::collections::HashSet::new(),
    );

    let mut record = BibliographicRecord::new(cite_key, record_type);
    record.title = work.title.as_deref().map(clean_title);
    record.doi = doi_normalized;
    record.year = year;
    record.language = work.language.clone();
    record.citation_count = work.cited_by_count;

    // Fecha completa
    if let Some(date_str) = &work.publication_date {
        let parsed = parse_date_str(date_str);
        record.date = parsed.date;
    }

    // Autores (desde authorships, ordenados por position)
    if let Some(authorships) = &work.authorships {
        let sorted = authorships.clone_sorted_by_position();
        record.authors = sorted
            .iter()
            .filter_map(|a| a.author.as_ref())
            .filter_map(|a| a.display_name.as_deref())
            .map(|name| {
                // OpenAlex da "Given Family" — necesitamos invertir
                let parts: Vec<&str> = name.split_whitespace().collect();
                if parts.len() >= 2 {
                    let family = parts[parts.len() - 1].to_string();
                    let given = parts[..parts.len() - 1].join(" ");
                    PersonName::new_person(family, given)
                } else {
                    PersonName::new_organization(name)
                }
            })
            .collect();

        // ORCID de autores
        for (i, authorship) in sorted.iter().enumerate() {
            if let Some(author) = &authorship.author {
                if let Some(orcid) = &author.orcid {
                    if let Some(person) = record.authors.get_mut(i) {
                        person.orcid = Some(orcid.clone());
                    }
                }
            }
        }
    }

    // Journal / publisher desde primary_location
    if let Some(loc) = &work.primary_location {
        if let Some(source) = &loc.source {
            record.journal = source.display_name.clone();
            record.issn = source.issn_l.clone();
            record.publisher = source.publisher.clone();
        }
        // URL del PDF en OA
        if record.url.is_none() {
            record.url = loc.pdf_url.clone();
        }
    }

    // Biblio
    if let Some(b) = &work.biblio {
        record.volume = b.volume.clone();
        record.issue = b.issue.clone();
        if let (Some(first), Some(last)) = (&b.first_page, &b.last_page) {
            record.pages = Some(format!("{}-{}", first, last));
        } else if let Some(first) = &b.first_page {
            record.pages = Some(first.clone());
        }
    }

    // Abstract desde inverted index
    if let Some(index) = &work.abstract_inverted_index {
        let abstract_text = rebuild_abstract(index);
        if !abstract_text.is_empty() {
            record.abstract_text = Some(abstract_text);
        }
    }

    // Open access
    if let Some(oa) = &work.open_access {
        record.license = oa.license.clone();
        if record.url.is_none() {
            record.url = oa.oa_url.clone();
        }
    }

    // Keywords desde concepts (score > 0.3, level <= 2)
    if let Some(concepts) = &work.concepts {
        record.keywords = concepts
            .iter()
            .filter(|c| c.score.unwrap_or(0.0) > 0.3 && c.level.unwrap_or(99) <= 2)
            .filter_map(|c| c.display_name.clone())
            .take(10)
            .collect();
    }

    // Provenance
    record
        .provenance
        .set_field_source("*", provider::OPENALEX, Utc::now());
    record.provenance.primary_provider = Some(provider::OPENALEX.to_string());

    record
}

// Helper para ordenar authorships
trait SortedByPosition {
    fn clone_sorted_by_position(&self) -> Vec<Authorship>;
}

impl SortedByPosition for Vec<Authorship> {
    fn clone_sorted_by_position(&self) -> Vec<Authorship> {
        let mut sorted: Vec<&Authorship> = self.iter().collect();
        sorted.sort_by_key(|a| match a.position.as_deref() {
            Some("first") => 0,
            Some("middle") => 1,
            Some("last") => 2,
            _ => 3,
        });
        // Clonar: Authorship no implementa Clone por el HashMap, así que reconstruimos
        sorted
            .into_iter()
            .map(|a| Authorship {
                author: a.author.as_ref().map(|au| AuthorInfo {
                    id: au.id.clone(),
                    display_name: au.display_name.clone(),
                    orcid: au.orcid.clone(),
                }),
                position: a.position.clone(),
            })
            .collect()
    }
}

// ── Funciones de fetch ────────────────────────────────────────────────────────

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .expect("Failed to build HTTP client")
}

pub async fn fetch_by_doi(doi_normalized: &str) -> Result<BibliographicRecord, String> {
    let encoded = crate::commands::doi::percent_encode_doi(doi_normalized);
    let url = format!("{}/https://doi.org/{}", OPENALEX_BASE, encoded);

    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar OpenAlex: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("DOI no encontrado en OpenAlex: {doi_normalized}"));
    }
    if !resp.status().is_success() {
        return Err(format!(
            "OpenAlex respondió con error HTTP {}",
            resp.status()
        ));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta de OpenAlex: {e}"))?;

    let work: OpenAlexWork = serde_json::from_value(raw.clone())
        .map_err(|e| format!("Error al deserializar respuesta de OpenAlex: {e}"))?;

    let mut record = work_to_record(&work);
    record.provenance.set_raw_payload(provider::OPENALEX, raw);
    Ok(record)
}

/// Búsqueda por título. Retorna hasta `limit` resultados.
pub async fn search_by_title(query: &str, limit: u8) -> Result<Vec<BibliographicRecord>, String> {
    let url = format!(
        "{}?filter=title.search:{}&per-page={}",
        OPENALEX_BASE,
        urlencoding::encode(query),
        limit.min(25)
    );

    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red al buscar en OpenAlex: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "OpenAlex respondió con error HTTP {}",
            resp.status()
        ));
    }

    let list: OpenAlexListResponse = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear resultados de OpenAlex: {e}"))?;

    Ok(list.results.iter().map(work_to_record).collect())
}

// ── Comandos Tauri ────────────────────────────────────────────────────────────

/// Busca trabajos en OpenAlex por título.
#[tauri::command]
pub async fn search_openalex(
    query: String,
    limit: Option<u8>,
) -> Result<Vec<serde_json::Value>, String> {
    if query.trim().is_empty() {
        return Err("La consulta no puede estar vacía.".to_string());
    }
    let records = search_by_title(&query, limit.unwrap_or(10)).await?;
    records
        .iter()
        .map(|r| serde_json::to_value(r).map_err(|e| format!("Error al serializar: {e}")))
        .collect()
}

/// Enriquece un registro existente con datos de OpenAlex (abstract, citation_count, keywords).
#[tauri::command]
pub async fn enrich_from_openalex(doi: String) -> Result<serde_json::Value, String> {
    let normalized = normalize_doi(doi.trim()).ok_or_else(|| format!("DOI inválido: '{}'", doi))?;
    let record = fetch_by_doi(&normalized).await?;
    serde_json::to_value(&record).map_err(|e| format!("Error al serializar: {e}"))
}
