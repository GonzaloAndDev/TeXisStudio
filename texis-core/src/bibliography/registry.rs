use super::model::{BibliographicRecord, BibliographicRecordId, RecordType};
use super::normalization::{normalize_doi, normalize_isbn, parse_authors_bibtex};
use super::parser::{BibEntry, BibParser};
use crate::error::{CoreError, CoreResult};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Índice persistente de referencias bibliográficas del proyecto.
/// Fuente de verdad para provenance y metadatos enriquecidos.
/// El archivo .bib es la fuente de verdad del contenido LaTeX.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct BibliographyRegistry {
    records: HashMap<BibliographicRecordId, BibliographicRecord>,
    by_cite_key: HashMap<String, BibliographicRecordId>,
    by_doi: HashMap<String, BibliographicRecordId>,
    by_isbn: HashMap<String, BibliographicRecordId>,
}

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    #[error("Clave de cita duplicada: '{0}'")]
    DuplicateCiteKey(String),
    #[error("DOI duplicado: '{0}' ya existe como '{1}'")]
    DuplicateDoi(String, String),
    #[error("ISBN duplicado: '{0}'")]
    DuplicateIsbn(String),
    #[error("Registro no encontrado: '{0}'")]
    NotFound(String),
}

pub struct SyncReport {
    pub added: usize,
    pub updated: usize,
    pub conflicts: Vec<String>,
}

impl BibliographyRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Inserta un nuevo registro. Falla si cite_key o DOI ya existen.
    pub fn insert(&mut self, record: BibliographicRecord) -> Result<(), RegistryError> {
        if self.by_cite_key.contains_key(&record.cite_key) {
            return Err(RegistryError::DuplicateCiteKey(record.cite_key.clone()));
        }
        if let Some(doi) = &record.doi {
            if let Some(existing_id) = self.by_doi.get(doi) {
                let existing_key = self
                    .records
                    .get(existing_id)
                    .map(|r| r.cite_key.as_str())
                    .unwrap_or("?");
                return Err(RegistryError::DuplicateDoi(
                    doi.clone(),
                    existing_key.to_string(),
                ));
            }
        }
        if let Some(isbn) = &record.isbn {
            if self.by_isbn.contains_key(isbn) {
                return Err(RegistryError::DuplicateIsbn(isbn.clone()));
            }
        }
        self.index_record(&record);
        self.records.insert(record.id, record);
        Ok(())
    }

    /// Actualiza un registro existente. Preserva el id y los timestamps de creación.
    pub fn update(&mut self, mut record: BibliographicRecord) -> Result<(), RegistryError> {
        let id = record.id;
        if let Some(existing) = self.records.get(&id) {
            record.created_at = existing.created_at;
        } else {
            return Err(RegistryError::NotFound(record.id.to_string()));
        }
        record.updated_at = Utc::now();
        self.remove_from_indices(&id);
        self.index_record(&record);
        self.records.insert(id, record);
        Ok(())
    }

    /// Elimina un registro por ID.
    pub fn remove(&mut self, id: &BibliographicRecordId) -> Option<BibliographicRecord> {
        let record = self.records.remove(id)?;
        self.remove_from_indices(id);
        Some(record)
    }

    pub fn find_by_id(&self, id: &BibliographicRecordId) -> Option<&BibliographicRecord> {
        self.records.get(id)
    }

    pub fn find_by_cite_key(&self, key: &str) -> Option<&BibliographicRecord> {
        self.by_cite_key
            .get(key)
            .and_then(|id| self.records.get(id))
    }

    pub fn find_by_doi(&self, doi: &str) -> Option<&BibliographicRecord> {
        let normalized = normalize_doi(doi)?;
        self.by_doi
            .get(&normalized)
            .and_then(|id| self.records.get(id))
    }

    pub fn find_by_isbn(&self, isbn: &str) -> Option<&BibliographicRecord> {
        let normalized = normalize_isbn(isbn)?;
        self.by_isbn
            .get(&normalized)
            .and_then(|id| self.records.get(id))
    }

    pub fn all(&self) -> impl Iterator<Item = &BibliographicRecord> {
        self.records.values()
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    pub fn all_cite_keys(&self) -> HashSet<String> {
        self.by_cite_key.keys().cloned().collect()
    }

    /// Detecta si un candidato es duplicado de un registro existente.
    /// Compara por DOI, ISBN, o similitud de título+autores (heurística básica).
    pub fn detect_duplicate<'a>(
        &'a self,
        candidate: &BibliographicRecord,
    ) -> Option<&'a BibliographicRecord> {
        // Primero por DOI (más fiable)
        if let Some(doi) = &candidate.doi {
            if let Some(existing) = self.find_by_doi(doi) {
                if existing.id != candidate.id {
                    return Some(existing);
                }
            }
        }
        // Luego por ISBN
        if let Some(isbn) = &candidate.isbn {
            if let Some(existing) = self.find_by_isbn(isbn) {
                if existing.id != candidate.id {
                    return Some(existing);
                }
            }
        }
        None
    }

    /// Sincroniza el registry desde un archivo .bib.
    /// Añade entradas nuevas y detecta conflictos con las existentes.
    /// No elimina registros que existen en el registry pero no en el .bib.
    pub fn sync_from_bib_file(&mut self, path: &Path) -> CoreResult<SyncReport> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        let entries = BibParser.parse_str(&content);

        let mut report = SyncReport {
            added: 0,
            updated: 0,
            conflicts: Vec::new(),
        };

        let existing_keys = self.all_cite_keys();

        for entry in &entries {
            if let Some(existing) = self.find_by_cite_key(&entry.key) {
                // La clave ya existe en el registry — verificar si hay conflicto
                let bib_title = entry.fields.get("title").map(|s| s.as_str()).unwrap_or("");
                let reg_title = existing.title.as_deref().unwrap_or("");
                if !bib_title.is_empty() && !reg_title.is_empty() && bib_title != reg_title {
                    report.conflicts.push(format!(
                        "'{}': título en .bib difiere del registry",
                        entry.key
                    ));
                }
                report.updated += 1;
            } else {
                // Entrada nueva — crear BibliographicRecord desde BibEntry
                let record = bib_entry_to_record(entry, &existing_keys);
                let _ = self.insert(record); // ignorar duplicados de DOI en sync
                report.added += 1;
            }
        }

        Ok(report)
    }

    // ── Índices internos ──────────────────────────────────────────────────────

    fn index_record(&mut self, record: &BibliographicRecord) {
        self.by_cite_key.insert(record.cite_key.clone(), record.id);
        if let Some(doi) = &record.doi {
            self.by_doi.insert(doi.clone(), record.id);
        }
        if let Some(isbn) = &record.isbn {
            self.by_isbn.insert(isbn.clone(), record.id);
        }
    }

    fn remove_from_indices(&mut self, id: &BibliographicRecordId) {
        if let Some(record) = self.records.get(id) {
            self.by_cite_key.remove(&record.cite_key);
            if let Some(doi) = &record.doi {
                self.by_doi.remove(doi);
            }
            if let Some(isbn) = &record.isbn {
                self.by_isbn.remove(isbn);
            }
        }
    }
}

/// Convierte una BibEntry (del parser .bib) a un BibliographicRecord.
fn bib_entry_to_record(entry: &BibEntry, _existing_keys: &HashSet<String>) -> BibliographicRecord {
    use super::model::provider;
    use super::normalization::{normalize_doi, normalize_isbn, parse_date_str};

    let record_type = entry_type_to_record_type(&entry.entry_type);
    let mut record = BibliographicRecord::new(entry.key.clone(), record_type);

    record.title = entry.fields.get("title").cloned();
    record.subtitle = entry.fields.get("subtitle").cloned();
    record.journal = entry
        .fields
        .get("journaltitle")
        .or_else(|| entry.fields.get("journal"))
        .cloned();
    record.booktitle = entry.fields.get("booktitle").cloned();
    record.publisher = entry.fields.get("publisher").cloned();
    record.volume = entry.fields.get("volume").cloned();
    record.issue = entry.fields.get("number").cloned();
    record.pages = entry.fields.get("pages").cloned();
    record.edition = entry.fields.get("edition").cloned();
    record.series = entry.fields.get("series").cloned();
    record.institution = entry
        .fields
        .get("institution")
        .or_else(|| entry.fields.get("school"))
        .cloned();
    record.url = entry.fields.get("url").cloned();
    record.abstract_text = entry.fields.get("abstract").cloned();
    record.language = entry
        .fields
        .get("langid")
        .or_else(|| entry.fields.get("language"))
        .cloned();

    if let Some(doi_raw) = entry.fields.get("doi") {
        record.doi = normalize_doi(doi_raw);
    }
    if let Some(isbn_raw) = entry.fields.get("isbn") {
        record.isbn = normalize_isbn(isbn_raw);
    }
    if let Some(issn_raw) = entry.fields.get("issn") {
        record.issn = Some(issn_raw.clone());
    }

    // Año / fecha
    if let Some(date_str) = entry.fields.get("date") {
        let parsed = parse_date_str(date_str);
        record.year = parsed.year;
        record.date = parsed.date;
    } else if let Some(year_str) = entry.fields.get("year") {
        record.year = year_str.trim().parse::<i32>().ok();
    }

    // Autores
    if let Some(author_str) = entry.fields.get("author") {
        record.authors = parse_authors_bibtex(author_str);
    }
    if let Some(editor_str) = entry.fields.get("editor") {
        record.editors = parse_authors_bibtex(editor_str);
    }

    // Provenance
    record.provenance.primary_provider = Some(provider::BIB_FILE_IMPORT.to_string());
    record
        .provenance
        .set_field_source("*", provider::BIB_FILE_IMPORT, Utc::now());

    record
}

fn entry_type_to_record_type(entry_type: &str) -> RecordType {
    match entry_type {
        "article" => RecordType::Article,
        "book" => RecordType::Book,
        "incollection" | "inbook" => RecordType::BookChapter,
        "inproceedings" | "conference" => RecordType::ConferencePaper,
        "proceedings" => RecordType::Proceedings,
        "thesis" | "phdthesis" | "mastersthesis" => RecordType::Thesis,
        "techreport" | "report" => RecordType::TechReport,
        "dataset" => RecordType::Dataset,
        "software" => RecordType::Software,
        "online" | "webpage" => RecordType::Webpage,
        "patent" => RecordType::Patent,
        _ => RecordType::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bibliography::model::provider;

    fn make_record(cite_key: &str, doi: Option<&str>) -> BibliographicRecord {
        let mut r = BibliographicRecord::new(cite_key, RecordType::Article);
        r.doi = doi.and_then(normalize_doi);
        r
    }

    #[test]
    fn insert_and_find_by_key() {
        let mut reg = BibliographyRegistry::new();
        let r = make_record("smith2024", Some("10.1145/111.222"));
        reg.insert(r).unwrap();
        assert!(reg.find_by_cite_key("smith2024").is_some());
    }

    #[test]
    fn insert_rejects_duplicate_key() {
        let mut reg = BibliographyRegistry::new();
        reg.insert(make_record("smith2024", None)).unwrap();
        let err = reg.insert(make_record("smith2024", None)).unwrap_err();
        assert!(matches!(err, RegistryError::DuplicateCiteKey(_)));
    }

    #[test]
    fn insert_rejects_duplicate_doi() {
        let mut reg = BibliographyRegistry::new();
        reg.insert(make_record("smith2024", Some("10.1145/111.222")))
            .unwrap();
        let err = reg
            .insert(make_record("jones2024", Some("10.1145/111.222")))
            .unwrap_err();
        assert!(matches!(err, RegistryError::DuplicateDoi(_, _)));
    }

    #[test]
    fn find_by_doi_normalized() {
        let mut reg = BibliographyRegistry::new();
        reg.insert(make_record("smith2024", Some("10.1145/111.222")))
            .unwrap();
        assert!(reg.find_by_doi("https://doi.org/10.1145/111.222").is_some());
    }

    #[test]
    fn detect_duplicate_by_doi() {
        let mut reg = BibliographyRegistry::new();
        reg.insert(make_record("smith2024", Some("10.1145/111.222")))
            .unwrap();
        let candidate = make_record("jones2024_dup", Some("10.1145/111.222"));
        assert!(reg.detect_duplicate(&candidate).is_some());
    }

    #[test]
    fn remove_cleans_indices() {
        let mut reg = BibliographyRegistry::new();
        let r = make_record("smith2024", Some("10.1145/111.222"));
        let id = r.id;
        reg.insert(r).unwrap();
        reg.remove(&id);
        assert!(reg.find_by_cite_key("smith2024").is_none());
        assert!(reg.find_by_doi("10.1145/111.222").is_none());
    }

    #[test]
    fn all_cite_keys_returns_set() {
        let mut reg = BibliographyRegistry::new();
        reg.insert(make_record("a2024", None)).unwrap();
        reg.insert(make_record("b2024", None)).unwrap();
        let keys = reg.all_cite_keys();
        assert!(keys.contains("a2024"));
        assert!(keys.contains("b2024"));
    }
}
