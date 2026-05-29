use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub type BibliographicRecordId = Uuid;

/// Modelo interno canónico de una referencia bibliográfica.
/// No es BibTeX — BibTeX es un formato de salida, no de almacenamiento.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographicRecord {
    pub id: BibliographicRecordId,
    pub cite_key: String,
    pub record_type: RecordType,

    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub authors: Vec<PersonName>,
    pub editors: Vec<PersonName>,
    pub translators: Vec<PersonName>,
    pub year: Option<i32>,
    pub date: Option<NaiveDate>,
    pub doi: Option<String>,
    pub isbn: Option<String>,
    pub issn: Option<String>,
    pub url: Option<String>,
    pub publisher: Option<String>,
    pub journal: Option<String>,
    pub booktitle: Option<String>,
    pub institution: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub edition: Option<String>,
    pub series: Option<String>,
    pub language: Option<String>,
    pub abstract_text: Option<String>,
    pub keywords: Vec<String>,
    pub license: Option<String>,
    pub citation_count: Option<u32>,

    pub provenance: RecordProvenance,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_verified_at: Option<DateTime<Utc>>,
}

impl BibliographicRecord {
    pub fn new(cite_key: impl Into<String>, record_type: RecordType) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            cite_key: cite_key.into(),
            record_type,
            title: None,
            subtitle: None,
            authors: Vec::new(),
            editors: Vec::new(),
            translators: Vec::new(),
            year: None,
            date: None,
            doi: None,
            isbn: None,
            issn: None,
            url: None,
            publisher: None,
            journal: None,
            booktitle: None,
            institution: None,
            volume: None,
            issue: None,
            pages: None,
            edition: None,
            series: None,
            language: None,
            abstract_text: None,
            keywords: Vec::new(),
            license: None,
            citation_count: None,
            provenance: RecordProvenance::default(),
            created_at: now,
            updated_at: now,
            last_verified_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonName {
    pub family: String,
    pub given: Option<String>,
    pub suffix: Option<String>,
    pub orcid: Option<String>,
    pub is_organization: bool,
}

impl PersonName {
    pub fn new_person(family: impl Into<String>, given: impl Into<String>) -> Self {
        Self {
            family: family.into(),
            given: Some(given.into()),
            suffix: None,
            orcid: None,
            is_organization: false,
        }
    }

    pub fn new_organization(name: impl Into<String>) -> Self {
        Self {
            family: name.into(),
            given: None,
            suffix: None,
            orcid: None,
            is_organization: true,
        }
    }

    /// Formato BibTeX: "Family, Given"
    pub fn to_bibtex(&self) -> String {
        match &self.given {
            Some(given) if !given.is_empty() => format!("{}, {}", self.family, given),
            _ => self.family.clone(),
        }
    }

    /// Formato display: "Given Family"
    pub fn to_display(&self) -> String {
        match &self.given {
            Some(given) if !given.is_empty() => format!("{} {}", given, self.family),
            _ => self.family.clone(),
        }
    }

    /// Iniciales del nombre dado: "John Andrew" → "J. A."
    pub fn given_initials(&self) -> String {
        match &self.given {
            None => String::new(),
            Some(given) => given
                .split_whitespace()
                .map(|part| {
                    let mut chars = part.chars();
                    match chars.next() {
                        Some(c) => format!("{}.", c.to_uppercase()),
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" "),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RecordType {
    Article,
    Book,
    BookChapter,
    ConferencePaper,
    Proceedings,
    Thesis,
    TechReport,
    Dataset,
    Software,
    Preprint,
    Webpage,
    Patent,
    Standard,
    Unknown,
}

impl RecordType {
    /// Tipo BibLaTeX canónico.
    pub fn to_bibtex_type(&self) -> &'static str {
        match self {
            RecordType::Article => "article",
            RecordType::Book => "book",
            RecordType::BookChapter => "incollection",
            RecordType::ConferencePaper => "inproceedings",
            RecordType::Proceedings => "proceedings",
            RecordType::Thesis => "thesis",
            RecordType::TechReport => "techreport",
            RecordType::Dataset => "dataset",
            RecordType::Software => "software",
            RecordType::Preprint => "misc",
            RecordType::Webpage => "online",
            RecordType::Patent => "patent",
            RecordType::Standard => "misc",
            RecordType::Unknown => "misc",
        }
    }

    /// Tipo CSL-JSON.
    pub fn to_csl_type(&self) -> &'static str {
        match self {
            RecordType::Article => "article-journal",
            RecordType::Book => "book",
            RecordType::BookChapter => "chapter",
            RecordType::ConferencePaper => "paper-conference",
            RecordType::Proceedings => "book",
            RecordType::Thesis => "thesis",
            RecordType::TechReport => "report",
            RecordType::Dataset => "dataset",
            RecordType::Software => "software",
            RecordType::Preprint => "article",
            RecordType::Webpage => "webpage",
            RecordType::Patent => "patent",
            RecordType::Standard => "document",
            RecordType::Unknown => "document",
        }
    }

    /// Tipo RIS TY.
    pub fn to_ris_type(&self) -> &'static str {
        match self {
            RecordType::Article => "JOUR",
            RecordType::Book => "BOOK",
            RecordType::BookChapter => "CHAP",
            RecordType::ConferencePaper => "CONF",
            RecordType::Proceedings => "BOOK",
            RecordType::Thesis => "THES",
            RecordType::TechReport => "RPRT",
            RecordType::Dataset => "DATA",
            RecordType::Software => "COMP",
            RecordType::Preprint => "JOUR",
            RecordType::Webpage => "ELEC",
            RecordType::Patent => "PAT",
            RecordType::Standard => "GEN",
            RecordType::Unknown => "GEN",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RecordProvenance {
    pub field_sources: HashMap<String, FieldSource>,
    pub raw_payloads: HashMap<String, serde_json::Value>,
    pub confidence_score: f32,
    pub primary_provider: Option<String>,
    pub fetched_at: HashMap<String, DateTime<Utc>>,
}

impl RecordProvenance {
    pub fn set_field_source(&mut self, field: &str, provider: &str, fetched_at: DateTime<Utc>) {
        self.field_sources.insert(
            field.to_string(),
            FieldSource {
                provider: provider.to_string(),
                fetched_at,
            },
        );
    }

    pub fn set_raw_payload(&mut self, provider: &str, payload: serde_json::Value) {
        self.raw_payloads.insert(provider.to_string(), payload);
        self.fetched_at.insert(provider.to_string(), Utc::now());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSource {
    pub provider: String,
    pub fetched_at: DateTime<Utc>,
}

/// Proveedor bibliográfico conocido.
pub mod provider {
    pub const CROSSREF: &str = "Crossref";
    pub const DATACITE: &str = "DataCite";
    pub const OPENALEX: &str = "OpenAlex";
    pub const SEMANTIC_SCHOLAR: &str = "SemanticScholar";
    pub const ZOTERO: &str = "Zotero";
    pub const USER_MANUAL: &str = "UserManual";
    pub const BIB_FILE_IMPORT: &str = "BibFileImport";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn person_name_bibtex_format() {
        let p = PersonName::new_person("García", "María Elena");
        assert_eq!(p.to_bibtex(), "García, María Elena");
    }

    #[test]
    fn person_name_display_format() {
        let p = PersonName::new_person("Smith", "John");
        assert_eq!(p.to_display(), "John Smith");
    }

    #[test]
    fn person_name_initials() {
        let p = PersonName::new_person("Smith", "John Andrew");
        assert_eq!(p.given_initials(), "J. A.");
    }

    #[test]
    fn record_type_bibtex_mapping() {
        assert_eq!(RecordType::Article.to_bibtex_type(), "article");
        assert_eq!(RecordType::BookChapter.to_bibtex_type(), "incollection");
        assert_eq!(RecordType::Webpage.to_bibtex_type(), "online");
    }

    #[test]
    fn record_type_csl_mapping() {
        assert_eq!(RecordType::Article.to_csl_type(), "article-journal");
        assert_eq!(
            RecordType::ConferencePaper.to_csl_type(),
            "paper-conference"
        );
    }

    #[test]
    fn record_type_ris_mapping() {
        assert_eq!(RecordType::Article.to_ris_type(), "JOUR");
        assert_eq!(RecordType::Dataset.to_ris_type(), "DATA");
    }

    #[test]
    fn record_new_has_uuid() {
        let r1 = BibliographicRecord::new("smith2024", RecordType::Article);
        let r2 = BibliographicRecord::new("jones2024", RecordType::Book);
        assert_ne!(r1.id, r2.id);
    }

    #[test]
    fn provenance_set_field_source() {
        let mut prov = RecordProvenance::default();
        prov.set_field_source("title", provider::CROSSREF, Utc::now());
        assert!(prov.field_sources.contains_key("title"));
        assert_eq!(prov.field_sources["title"].provider, provider::CROSSREF);
    }
}
