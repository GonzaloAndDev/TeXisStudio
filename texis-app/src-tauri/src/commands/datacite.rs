// Cliente DataCite — DOIs de datasets, software, tesis y repositorios científicos.
// API: https://api.datacite.org/dois/{doi}
// No requiere autenticación. Accept: application/vnd.api+json

use serde::Deserialize;
use std::time::Duration;
use texis_core::bibliography::model::{
    BibliographicRecord, PersonName, RecordType, provider,
};
use texis_core::bibliography::normalization::{
    clean_title, map_datacite_type, normalize_doi, normalize_isbn, parse_date_str,
};
use chrono::Utc;

const DATACITE_BASE: &str = "https://api.datacite.org/dois/";
const USER_AGENT: &str = concat!(
    "TeXisStudio/", env!("CARGO_PKG_VERSION"),
    " (https://github.com/GonzaloAndDev/TeXisStudio; mailto:gaelsd25@gmail.com)"
);
const TIMEOUT_SECS: u64 = 15;

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct DataCiteResponse {
    data: DataCiteData,
}

#[derive(Deserialize)]
struct DataCiteData {
    attributes: DataCiteAttributes,
}

#[derive(Deserialize)]
struct DataCiteAttributes {
    doi: Option<String>,
    titles: Option<Vec<DataCiteTitle>>,
    creators: Option<Vec<DataCiteCreator>>,
    contributors: Option<Vec<DataCiteContributor>>,
    #[serde(rename = "publicationYear")]
    publication_year: Option<i32>,
    dates: Option<Vec<DataCiteDate>>,
    publisher: Option<serde_json::Value>,
    #[serde(rename = "resourceTypeGeneral")]
    resource_type_general: Option<String>,
    url: Option<String>,
    descriptions: Option<Vec<DataCiteDescription>>,
    #[serde(rename = "rightsList")]
    rights_list: Option<Vec<DataCiteRights>>,
    language: Option<String>,
    #[serde(rename = "identifiers")]
    identifiers: Option<Vec<DataCiteIdentifier>>,
    container: Option<DataCiteContainer>,
}

#[derive(Deserialize)]
struct DataCiteTitle {
    title: Option<String>,
    #[serde(rename = "titleType")]
    title_type: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteCreator {
    name: Option<String>,
    #[serde(rename = "givenName")]
    given_name: Option<String>,
    #[serde(rename = "familyName")]
    family_name: Option<String>,
    #[serde(rename = "nameType")]
    name_type: Option<String>,
    #[serde(rename = "nameIdentifiers")]
    name_identifiers: Option<Vec<DataCiteNameId>>,
}

#[derive(Deserialize)]
struct DataCiteContributor {
    name: Option<String>,
    #[serde(rename = "givenName")]
    given_name: Option<String>,
    #[serde(rename = "familyName")]
    family_name: Option<String>,
    #[serde(rename = "contributorType")]
    contributor_type: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteNameId {
    #[serde(rename = "nameIdentifier")]
    identifier: Option<String>,
    #[serde(rename = "nameIdentifierScheme")]
    scheme: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteDate {
    date: Option<String>,
    #[serde(rename = "dateType")]
    date_type: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteDescription {
    description: Option<String>,
    #[serde(rename = "descriptionType")]
    description_type: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteRights {
    #[serde(rename = "rightsUri")]
    rights_uri: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteIdentifier {
    identifier: Option<String>,
    #[serde(rename = "identifierType")]
    identifier_type: Option<String>,
}

#[derive(Deserialize)]
struct DataCiteContainer {
    title: Option<String>,
}

// ── Conversión a BibliographicRecord ──────────────────────────────────────────

fn attrs_to_record(attrs: &DataCiteAttributes, doi_normalized: &str) -> BibliographicRecord {
    let record_type = attrs
        .resource_type_general
        .as_deref()
        .map(map_datacite_type)
        .unwrap_or(RecordType::Unknown);

    // Título principal (sin titleType o titleType = null)
    let title = attrs
        .titles
        .as_deref()
        .and_then(|ts| {
            ts.iter()
                .find(|t| t.title_type.is_none())
                .or_else(|| ts.first())
        })
        .and_then(|t| t.title.as_deref())
        .map(clean_title);

    // Subtítulo
    let subtitle = attrs
        .titles
        .as_deref()
        .and_then(|ts| {
            ts.iter()
                .find(|t| t.title_type.as_deref() == Some("Subtitle"))
        })
        .and_then(|t| t.title.clone());

    // Generar cite_key base (se deduplicará en el registry)
    let first_family = attrs
        .creators
        .as_deref()
        .and_then(|cs| cs.first())
        .and_then(|c| {
            c.family_name.as_deref().or_else(|| {
                c.name.as_deref().and_then(|n| n.split(',').next())
            })
        })
        .unwrap_or("unknown");

    let year = attrs.publication_year;
    let cite_key = texis_core::bibliography::normalization::generate_cite_key(
        first_family,
        year,
        Some(doi_normalized),
        &std::collections::HashSet::new(),
    );

    let mut record = BibliographicRecord::new(cite_key, record_type);
    record.title = title;
    record.subtitle = subtitle;
    record.doi = Some(doi_normalized.to_string());
    record.year = year;
    record.language = attrs.language.clone();
    record.url = attrs.url.clone();

    // Publisher (puede ser string o objeto)
    record.publisher = attrs.publisher.as_ref().and_then(|p| {
        if let Some(s) = p.as_str() {
            Some(s.to_string())
        } else if let Some(name) = p.get("name").and_then(|n| n.as_str()) {
            Some(name.to_string())
        } else {
            None
        }
    });

    // Autores
    if let Some(creators) = &attrs.creators {
        record.authors = creators
            .iter()
            .map(|c| {
                let is_org = c.name_type.as_deref() == Some("Organizational");
                if is_org {
                    PersonName::new_organization(c.name.as_deref().unwrap_or(""))
                } else if let (Some(family), Some(given)) =
                    (&c.family_name, &c.given_name)
                {
                    let mut p = PersonName::new_person(family, given);
                    // ORCID
                    p.orcid = c.name_identifiers.as_deref().and_then(|ids| {
                        ids.iter()
                            .find(|id| id.scheme.as_deref() == Some("ORCID"))
                            .and_then(|id| id.identifier.clone())
                    });
                    p
                } else {
                    texis_core::bibliography::normalization::parse_datacite_name(
                        c.name.as_deref().unwrap_or(""),
                    )
                }
            })
            .collect();
    }

    // Editores (contributors con contributorType = Editor)
    if let Some(contribs) = &attrs.contributors {
        record.editors = contribs
            .iter()
            .filter(|c| c.contributor_type.as_deref() == Some("Editor"))
            .map(|c| {
                if let (Some(family), Some(given)) = (&c.family_name, &c.given_name) {
                    PersonName::new_person(family, given)
                } else {
                    texis_core::bibliography::normalization::parse_datacite_name(
                        c.name.as_deref().unwrap_or(""),
                    )
                }
            })
            .collect();
    }

    // Fecha más específica disponible
    if let Some(dates) = &attrs.dates {
        let issued = dates
            .iter()
            .find(|d| d.date_type.as_deref() == Some("Issued"))
            .or_else(|| dates.first());
        if let Some(d) = issued {
            if let Some(date_str) = &d.date {
                let parsed = parse_date_str(date_str);
                record.date = parsed.date;
                if record.year.is_none() {
                    record.year = parsed.year;
                }
            }
        }
    }

    // Abstract
    record.abstract_text = attrs
        .descriptions
        .as_deref()
        .and_then(|ds| {
            ds.iter()
                .find(|d| d.description_type.as_deref() == Some("Abstract"))
                .or_else(|| ds.first())
        })
        .and_then(|d| d.description.clone());

    // Licencia
    record.license = attrs
        .rights_list
        .as_deref()
        .and_then(|rs| rs.first())
        .and_then(|r| r.rights_uri.clone());

    // ISBN desde identifiers
    record.isbn = attrs
        .identifiers
        .as_deref()
        .and_then(|ids| {
            ids.iter()
                .find(|id| id.identifier_type.as_deref() == Some("ISBN"))
                .and_then(|id| id.identifier.as_deref())
                .and_then(normalize_isbn)
        });

    // Container (journal/booktitle)
    if let Some(container) = &attrs.container {
        record.journal = container.title.clone();
    }

    // Provenance
    record
        .provenance
        .set_field_source("*", provider::DATACITE, Utc::now());
    record.provenance.primary_provider = Some(provider::DATACITE.to_string());

    record
}

// ── Función de fetch ──────────────────────────────────────────────────────────

async fn fetch_from_datacite(doi_normalized: &str) -> Result<BibliographicRecord, String> {
    let url = format!(
        "{}{}",
        DATACITE_BASE,
        crate::commands::doi::percent_encode_doi(doi_normalized)
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Error al crear cliente HTTP: {e}"))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/vnd.api+json")
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar DataCite: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("DOI no encontrado en DataCite: {doi_normalized}"));
    }
    if !resp.status().is_success() {
        return Err(format!("DataCite respondió con error HTTP {}", resp.status()));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta de DataCite: {e}"))?;

    let response: DataCiteResponse = serde_json::from_value(raw.clone())
        .map_err(|e| format!("Error al deserializar respuesta de DataCite: {e}"))?;

    let mut record = attrs_to_record(&response.data.attributes, doi_normalized);
    record.provenance.set_raw_payload(provider::DATACITE, raw);
    Ok(record)
}

// ── Comandos Tauri ────────────────────────────────────────────────────────────

/// Importa una referencia desde DataCite por DOI.
/// Retorna un BibliographicRecord serializado como JSON.
#[tauri::command]
pub async fn import_doi_datacite(doi: String) -> Result<serde_json::Value, String> {
    if doi.trim().is_empty() {
        return Err("El DOI no puede estar vacío.".to_string());
    }
    let normalized = normalize_doi(doi.trim())
        .ok_or_else(|| format!("DOI inválido: '{}'", doi))?;

    let record = fetch_from_datacite(&normalized).await?;
    serde_json::to_value(&record)
        .map_err(|e| format!("Error al serializar registro: {e}"))
}

// ── Función pública para uso desde el motor bibliográfico ─────────────────────

pub async fn fetch_record(doi_normalized: &str) -> Result<BibliographicRecord, String> {
    fetch_from_datacite(doi_normalized).await
}
