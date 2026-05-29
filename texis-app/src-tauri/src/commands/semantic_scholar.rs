// Cliente Semantic Scholar — abstracts de alta calidad para CS y ciencias exactas.
// API: https://api.semanticscholar.org/graph/v1/paper/{id}
// Rate limit: 100 req/5min sin API key, 1000 req/5min con API key.

use serde::Deserialize;
use std::time::Duration;
use texis_core::bibliography::model::{
    BibliographicRecord, PersonName, RecordType, provider,
};
use texis_core::bibliography::normalization::{
    clean_title, normalize_doi,
};
use chrono::Utc;

const S2_BASE: &str = "https://api.semanticscholar.org/graph/v1/paper";
const FIELDS: &str = "paperId,externalIds,title,abstract,authors,year,publicationDate,\
                       venue,journal,publicationTypes,openAccessPdf,\
                       citationCount,influentialCitationCount,isOpenAccess,fieldsOfStudy";
const USER_AGENT: &str = concat!(
    "TeXisStudio/", env!("CARGO_PKG_VERSION"),
    " (https://github.com/GonzaloAndDev/TeXisStudio; mailto:gaelsd25@gmail.com)"
);
const TIMEOUT_SECS: u64 = 15;

// ── Response types ────────────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Deserialize)]
struct S2Paper {
    #[serde(rename = "paperId")]
    paper_id: Option<String>,
    #[serde(rename = "externalIds")]
    external_ids: Option<S2ExternalIds>,
    title: Option<String>,
    #[serde(rename = "abstract")]
    abstract_text: Option<String>,
    authors: Option<Vec<S2Author>>,
    year: Option<i32>,
    #[serde(rename = "publicationDate")]
    publication_date: Option<String>,
    venue: Option<String>,
    journal: Option<S2Journal>,
    #[serde(rename = "publicationTypes")]
    publication_types: Option<Vec<String>>,
    #[serde(rename = "openAccessPdf")]
    open_access_pdf: Option<S2OaPdf>,
    #[serde(rename = "citationCount")]
    citation_count: Option<u32>,
    #[serde(rename = "fieldsOfStudy")]
    fields_of_study: Option<Vec<String>>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct S2ExternalIds {
    #[serde(rename = "DOI")]
    doi: Option<String>,
    #[serde(rename = "ArXiv")]
    arxiv: Option<String>,
    #[serde(rename = "PubMed")]
    pubmed: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct S2Author {
    name: Option<String>,
    #[serde(rename = "authorId")]
    author_id: Option<String>,
}

#[derive(Deserialize)]
struct S2Journal {
    name: Option<String>,
    volume: Option<String>,
    pages: Option<String>,
}

#[derive(Deserialize)]
struct S2OaPdf {
    url: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct S2SearchResponse {
    data: Vec<S2Paper>,
    #[serde(rename = "total")]
    total: Option<u64>,
}

// ── Tipo de publicación ───────────────────────────────────────────────────────

fn map_s2_type(pub_types: &[String]) -> RecordType {
    for t in pub_types {
        match t.as_str() {
            "JournalArticle" | "Review" => return RecordType::Article,
            "Book" => return RecordType::Book,
            "BookSection" | "Chapter" => return RecordType::BookChapter,
            "Conference" | "ConferencePaper" => return RecordType::ConferencePaper,
            "Dataset" => return RecordType::Dataset,
            "Thesis" | "Dissertation" => return RecordType::Thesis,
            "Report" => return RecordType::TechReport,
            "Preprint" => return RecordType::Preprint,
            _ => {}
        }
    }
    RecordType::Unknown
}

// ── Conversión a BibliographicRecord ──────────────────────────────────────────

fn paper_to_record(paper: &S2Paper) -> BibliographicRecord {
    let doi_normalized = paper
        .external_ids
        .as_ref()
        .and_then(|ids| ids.doi.as_deref())
        .and_then(normalize_doi);

    let record_type = paper
        .publication_types
        .as_deref()
        .map(|types| map_s2_type(types))
        .unwrap_or(RecordType::Unknown);

    // Citation key desde primer autor
    let first_family = paper
        .authors
        .as_deref()
        .and_then(|as_| as_.first())
        .and_then(|a| a.name.as_deref())
        .and_then(|name| name.split_whitespace().last())
        .unwrap_or("unknown");

    let cite_key = texis_core::bibliography::normalization::generate_cite_key(
        first_family,
        paper.year,
        doi_normalized.as_deref(),
        &std::collections::HashSet::new(),
    );

    let mut record = BibliographicRecord::new(cite_key, record_type);
    record.title = paper.title.as_deref().map(clean_title);
    record.doi = doi_normalized;
    record.year = paper.year;
    record.abstract_text = paper.abstract_text.clone();
    record.citation_count = paper.citation_count;

    // Fecha
    if let Some(date_str) = &paper.publication_date {
        let parsed = texis_core::bibliography::normalization::parse_date_str(date_str);
        record.date = parsed.date;
    }

    // Autores (S2 da solo "First Last" — invertir)
    if let Some(authors) = &paper.authors {
        record.authors = authors
            .iter()
            .filter_map(|a| a.name.as_deref())
            .map(|name| {
                let parts: Vec<&str> = name.split_whitespace().collect();
                if parts.len() >= 2 {
                    let family = parts.last().unwrap().to_string();
                    let given = parts[..parts.len() - 1].join(" ");
                    PersonName::new_person(family, given)
                } else {
                    PersonName::new_organization(name)
                }
            })
            .collect();
    }

    // Journal
    if let Some(journal) = &paper.journal {
        record.journal = journal.name.clone();
        record.volume = journal.volume.clone();
        if let Some(pages) = &journal.pages {
            record.pages = Some(pages.clone());
        }
    } else if let Some(venue) = &paper.venue {
        record.journal = Some(venue.clone());
    }

    // URL del PDF en OA
    if let Some(oa_pdf) = &paper.open_access_pdf {
        record.url = oa_pdf.url.clone();
    }

    // Keywords desde fieldsOfStudy
    if let Some(fields) = &paper.fields_of_study {
        record.keywords = fields.clone();
    }

    // Provenance
    record
        .provenance
        .set_field_source("*", provider::SEMANTIC_SCHOLAR, Utc::now());
    record.provenance.primary_provider = Some(provider::SEMANTIC_SCHOLAR.to_string());

    record
}

// ── HTTP client ───────────────────────────────────────────────────────────────

fn client(api_key: Option<&str>) -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent(USER_AGENT);
    if let Some(key) = api_key {
        builder = builder.default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "x-api-key",
                reqwest::header::HeaderValue::from_str(key)
                    .unwrap_or_else(|_| reqwest::header::HeaderValue::from_static("")),
            );
            headers
        });
    }
    builder.build().expect("Failed to build HTTP client")
}

// ── Funciones de fetch ────────────────────────────────────────────────────────

pub async fn fetch_by_doi(
    doi_normalized: &str,
    api_key: Option<&str>,
) -> Result<BibliographicRecord, String> {
    let encoded = crate::commands::doi::percent_encode_doi(doi_normalized);
    let url = format!("{}/DOI:{}?fields={}", S2_BASE, encoded, FIELDS);

    let resp = client(api_key)
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar Semantic Scholar: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("DOI no encontrado en Semantic Scholar: {doi_normalized}"));
    }
    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Semantic Scholar: límite de peticiones excedido. Intenta de nuevo en 5 minutos.".to_string());
    }
    if !resp.status().is_success() {
        return Err(format!("Semantic Scholar respondió con error HTTP {}", resp.status()));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta de S2: {e}"))?;

    let paper: S2Paper = serde_json::from_value(raw.clone())
        .map_err(|e| format!("Error al deserializar respuesta de S2: {e}"))?;

    let mut record = paper_to_record(&paper);
    record.provenance.set_raw_payload(provider::SEMANTIC_SCHOLAR, raw);
    Ok(record)
}

pub async fn search(
    query: &str,
    limit: u8,
    api_key: Option<&str>,
) -> Result<Vec<BibliographicRecord>, String> {
    let url = format!(
        "{}/search?query={}&limit={}&fields={}",
        S2_BASE,
        urlencoding::encode(query),
        limit.min(20),
        FIELDS
    );

    let resp = client(api_key)
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red al buscar en S2: {e}"))?;

    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Semantic Scholar: límite de peticiones excedido.".to_string());
    }
    if !resp.status().is_success() {
        return Err(format!("Semantic Scholar respondió con error HTTP {}", resp.status()));
    }

    let response: S2SearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear resultados de S2: {e}"))?;

    Ok(response.data.iter().map(paper_to_record).collect())
}

// ── Comandos Tauri ────────────────────────────────────────────────────────────

/// Busca papers en Semantic Scholar por título o consulta.
#[tauri::command]
pub async fn search_semantic_scholar(
    query: String,
    limit: Option<u8>,
) -> Result<Vec<serde_json::Value>, String> {
    if query.trim().is_empty() {
        return Err("La consulta no puede estar vacía.".to_string());
    }
    let records = search(&query, limit.unwrap_or(10), None).await?;
    records
        .iter()
        .map(|r| serde_json::to_value(r).map_err(|e| format!("Error al serializar: {e}")))
        .collect()
}
