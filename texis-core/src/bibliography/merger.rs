use super::model::{BibliographicRecord, RecordType};
use chrono::Utc;
use std::collections::HashMap;

/// Prioridad de campos por proveedor.
/// El índice menor = mayor prioridad.
pub struct FieldPriorityRules {
    rules: HashMap<String, Vec<String>>,
}

impl Default for FieldPriorityRules {
    fn default() -> Self {
        let mut rules = HashMap::new();
        // (campo → [proveedores en orden de prioridad])
        let defaults: &[(&str, &[&str])] = &[
            ("title",          &["Crossref", "DataCite", "OpenAlex", "SemanticScholar", "Zotero"]),
            ("authors",        &["Crossref", "DataCite", "OpenAlex", "SemanticScholar", "Zotero"]),
            ("editors",        &["Crossref", "DataCite", "OpenAlex"]),
            ("doi",            &["Crossref", "DataCite", "OpenAlex"]),
            ("isbn",           &["Crossref", "DataCite"]),
            ("issn",           &["Crossref", "OpenAlex"]),
            ("year",           &["Crossref", "DataCite", "OpenAlex", "SemanticScholar"]),
            ("date",           &["Crossref", "DataCite", "OpenAlex"]),
            ("journal",        &["Crossref", "OpenAlex", "SemanticScholar"]),
            ("booktitle",      &["Crossref", "OpenAlex"]),
            ("publisher",      &["Crossref", "DataCite"]),
            ("volume",         &["Crossref", "OpenAlex"]),
            ("issue",          &["Crossref", "OpenAlex"]),
            ("pages",          &["Crossref", "OpenAlex"]),
            ("abstract_text",  &["SemanticScholar", "OpenAlex", "Crossref", "DataCite"]),
            ("language",       &["Crossref", "OpenAlex", "DataCite"]),
            ("license",        &["Crossref", "DataCite", "OpenAlex"]),
            ("url",            &["Crossref", "DataCite", "OpenAlex", "SemanticScholar"]),
            ("citation_count", &["OpenAlex", "SemanticScholar"]),
            ("keywords",       &["OpenAlex", "Crossref"]),
        ];
        for (field, providers) in defaults {
            rules.insert(
                field.to_string(),
                providers.iter().map(|s| s.to_string()).collect(),
            );
        }
        Self { rules }
    }
}

impl FieldPriorityRules {
    /// Retorna el proveedor de mayor prioridad para un campo dado,
    /// dado que el candidato tiene ese proveedor disponible.
    pub fn preferred_provider<'a>(&self, field: &str, available: &[&'a str]) -> Option<&'a str> {
        let priority = self.rules.get(field)?;
        for preferred in priority {
            if let Some(&avail) = available.iter().find(|&&p| p == preferred.as_str()) {
                return Some(avail);
            }
        }
        available.first().copied()
    }
}

/// Combina registros de múltiples proveedores en uno solo con trazabilidad.
pub struct RecordMerger {
    #[allow(dead_code)]
    field_priority: FieldPriorityRules,
}

impl Default for RecordMerger {
    fn default() -> Self {
        Self {
            field_priority: FieldPriorityRules::default(),
        }
    }
}

impl RecordMerger {
    pub fn new() -> Self {
        Self::default()
    }

    /// Fusiona registros de múltiples proveedores.
    /// `records` es una lista de (provider_name, record).
    /// El primer registro es el primario (mayor confianza base).
    pub fn merge(&self, records: Vec<(String, BibliographicRecord)>) -> BibliographicRecord {
        if records.is_empty() {
            return BibliographicRecord::new("unknown", RecordType::Unknown);
        }
        if records.len() == 1 {
            let (provider, mut record) = records.into_iter().next().unwrap();
            record.provenance.primary_provider = Some(provider.clone());
            record.provenance.confidence_score = self.base_confidence_for_provider(&provider);
            return record;
        }

        let primary_provider = records[0].0.clone();
        let mut base = records[0].1.clone();
        base.provenance.primary_provider = Some(primary_provider.clone());

        // Guardar raw_payloads del primario (si los tiene)
        // Los demás proveedores enriquecen campo a campo

        // Enriquecer campos con fuentes secundarias
        for (provider, record) in &records[1..] {
            let prov = provider.as_str();

            // Title: solo si el primario no lo tiene
            if base.title.is_none() && record.title.is_some() {
                base.title = record.title.clone();
                base.provenance.set_field_source("title", prov, Utc::now());
            }
            // Abstract: SemanticScholar y OpenAlex tienen mejores abstracts
            if base.abstract_text.is_none() && record.abstract_text.is_some() {
                let should_take = match prov {
                    "SemanticScholar" | "OpenAlex" => true,
                    _ => false,
                };
                if should_take {
                    base.abstract_text = record.abstract_text.clone();
                    base.provenance.set_field_source("abstract_text", prov, Utc::now());
                }
            }
            // Citation count: solo OpenAlex y SemanticScholar
            if base.citation_count.is_none() && record.citation_count.is_some() {
                base.citation_count = record.citation_count;
                base.provenance
                    .set_field_source("citation_count", prov, Utc::now());
            }
            // License
            if base.license.is_none() && record.license.is_some() {
                base.license = record.license.clone();
                base.provenance.set_field_source("license", prov, Utc::now());
            }
            // Keywords (enriquecer con más keywords)
            if base.keywords.is_empty() && !record.keywords.is_empty() {
                base.keywords = record.keywords.clone();
                base.provenance.set_field_source("keywords", prov, Utc::now());
            }
            // URL de acceso abierto
            if base.url.is_none() && record.url.is_some() {
                base.url = record.url.clone();
                base.provenance.set_field_source("url", prov, Utc::now());
            }

            // Guardar raw_payload de este proveedor
            // (los payloads se almacenan externamente al hacer la consulta)
        }

        // Calcular confianza global
        base.provenance.confidence_score = self.calculate_confidence(&records);
        base.updated_at = Utc::now();
        base
    }

    fn base_confidence_for_provider(&self, provider: &str) -> f32 {
        match provider {
            "Crossref" => 0.9,
            "DataCite" => 0.85,
            "OpenAlex" => 0.8,
            "SemanticScholar" => 0.75,
            "Zotero" => 0.7,
            "BibFileImport" => 0.6,
            "UserManual" => 1.0, // el usuario tiene razón siempre
            _ => 0.5,
        }
    }

    fn calculate_confidence(&self, records: &[(String, BibliographicRecord)]) -> f32 {
        if records.is_empty() {
            return 0.0;
        }

        let base = self.base_confidence_for_provider(&records[0].0);

        // Bonus por cada proveedor adicional que confirma el mismo DOI
        let doi = records[0].1.doi.as_deref();
        let confirmations = if let Some(doi) = doi {
            records[1..]
                .iter()
                .filter(|(_, r)| r.doi.as_deref() == Some(doi))
                .count()
        } else {
            0
        };

        // Bonus por título consistente entre proveedores
        let title = records[0].1.title.as_deref().unwrap_or("");
        let title_matches = records[1..]
            .iter()
            .filter(|(_, r)| {
                r.title
                    .as_deref()
                    .map(|t| title_similarity(t, title) > 0.85)
                    .unwrap_or(false)
            })
            .count();

        let confidence =
            base + (confirmations as f32 * 0.04) + (title_matches as f32 * 0.03);

        confidence.min(1.0)
    }
}

/// Similitud simple de títulos (basada en palabras en común / total palabras).
fn title_similarity(a: &str, b: &str) -> f32 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let a_words: std::collections::HashSet<&str> =
        a.split_whitespace().collect();
    let b_words: std::collections::HashSet<&str> =
        b.split_whitespace().collect();
    let intersection = a_words.intersection(&b_words).count();
    let union = a_words.union(&b_words).count();
    if union == 0 {
        0.0
    } else {
        intersection as f32 / union as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bibliography::model::BibliographicRecord;

    fn make(cite_key: &str, provider: &str, doi: Option<&str>, abstract_: Option<&str>) -> (String, BibliographicRecord) {
        let mut r = BibliographicRecord::new(cite_key, RecordType::Article);
        r.doi = doi.map(|s| s.to_string());
        r.abstract_text = abstract_.map(|s| s.to_string());
        (provider.to_string(), r)
    }

    #[test]
    fn merge_single_record_returns_it() {
        let merger = RecordMerger::new();
        let (_, r) = make("smith2024", "Crossref", Some("10.1145/111"), None);
        let records = vec![("Crossref".to_string(), r)];
        let merged = merger.merge(records);
        assert_eq!(merged.doi, Some("10.1145/111".to_string()));
    }

    #[test]
    fn merge_abstract_from_semanticscholar() {
        let merger = RecordMerger::new();
        let crossref = make("smith2024", "Crossref", Some("10.1145/111"), None);
        let mut ss_record = BibliographicRecord::new("smith2024", RecordType::Article);
        ss_record.doi = Some("10.1145/111".to_string());
        ss_record.abstract_text = Some("A great abstract from S2.".to_string());
        let records = vec![crossref, ("SemanticScholar".to_string(), ss_record)];
        let merged = merger.merge(records);
        assert_eq!(
            merged.abstract_text,
            Some("A great abstract from S2.".to_string())
        );
        assert_eq!(
            merged.provenance.field_sources.get("abstract_text").map(|s| s.provider.as_str()),
            Some("SemanticScholar")
        );
    }

    #[test]
    fn confidence_increases_with_doi_confirmation() {
        let merger = RecordMerger::new();
        let r1 = make("smith2024", "Crossref", Some("10.1145/111"), None);
        let r2 = make("smith2024", "OpenAlex", Some("10.1145/111"), None);
        let records_one = vec![r1.clone()];
        let records_two = vec![r1, r2];
        let single = merger.merge(records_one);
        let merged = merger.merge(records_two);
        assert!(merged.provenance.confidence_score > single.provenance.confidence_score);
    }

    #[test]
    fn title_similarity_identical() {
        assert!((title_similarity("Deep Learning", "Deep Learning") - 1.0).abs() < 0.01);
    }

    #[test]
    fn title_similarity_disjoint() {
        assert_eq!(title_similarity("foo bar", "baz qux"), 0.0);
    }
}
