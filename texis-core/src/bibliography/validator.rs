// Validación de referencias bibliográficas — P4.1
//
// Orden de implementación (roadmap P4.1):
// 1. ✅ Citas sin referencia en .bib          (en validator/bibliography.rs)
// 2. ✅ Referencias no citadas                (en validator/bibliography.rs)
// 3. ✅ Duplicados por DOI y citation key
// 4. ✅ DOI con formato inválido
// 5. ✅ Campos obligatorios por entry type    (en validator/bibliography.rs)
// 6.    DOI check remoto contra Crossref      (opcional, requiere conexión — P4 futuro)

#[allow(deprecated)]
use super::manager::BibManager;
use super::parser::BibEntry;
use crate::project::model::{ContentBlock, ProjectModel};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct BibValidationResult {
    pub missing_keys: Vec<String>,
    pub duplicate_keys: Vec<String>,
    pub duplicate_dois: Vec<(String, String)>,
    pub invalid_dois: Vec<(String, String)>,
}

impl BibValidationResult {
    pub fn has_errors(&self) -> bool {
        !self.missing_keys.is_empty()
            || !self.duplicate_keys.is_empty()
            || !self.duplicate_dois.is_empty()
    }
}

#[allow(deprecated)]
pub fn validate_citations(model: &ProjectModel, bib: &BibManager) -> BibValidationResult {
    let mut missing_keys = Vec::new();

    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Citation(c) = block {
                if bib.find_by_key(&c.citation_key).is_none() {
                    missing_keys.push(c.citation_key.clone());
                }
            }
        }
    }

    BibValidationResult {
        missing_keys,
        duplicate_keys: vec![],
        duplicate_dois: vec![],
        invalid_dois: vec![],
    }
}

/// Validación profunda sobre las entradas del .bib: duplicados y DOI.
pub fn validate_entries(entries: &[BibEntry]) -> BibValidationResult {
    let missing_keys = vec![];
    let mut duplicate_keys = vec![];
    let mut duplicate_dois = vec![];
    let mut invalid_dois = vec![];

    // Detectar citation keys duplicadas
    let mut seen_keys: HashMap<String, usize> = HashMap::new();
    for (i, entry) in entries.iter().enumerate() {
        if let Some(prev) = seen_keys.insert(entry.key.clone(), i) {
            duplicate_keys.push(format!(
                "'{}' aparece en entradas {} y {}",
                entry.key, prev + 1, i + 1
            ));
        }
    }

    // Detectar DOIs duplicados
    let mut seen_dois: HashMap<String, String> = HashMap::new();
    for entry in entries {
        let doi = entry.fields.get("doi").map(|s| s.trim().to_lowercase());
        if let Some(doi) = doi {
            if doi.is_empty() { continue; }
            if let Some(prev_key) = seen_dois.insert(doi.clone(), entry.key.clone()) {
                if prev_key != entry.key {
                    duplicate_dois.push((entry.key.clone(), prev_key.clone()));
                }
            }
        }
    }

    // Validar formato DOI
    for entry in entries {
        if let Some(doi) = entry.fields.get("doi") {
            let doi = doi.trim();
            if !doi.is_empty() && !is_valid_doi(doi) {
                invalid_dois.push((entry.key.clone(), doi.to_string()));
            }
        }
    }

    BibValidationResult {
        missing_keys,
        duplicate_keys,
        duplicate_dois,
        invalid_dois,
    }
}

/// Valida el formato básico de un DOI.
/// Un DOI válido empieza con "10." seguido de dígitos, "/" y sufijo.
/// También acepta URLs https://doi.org/10.xxx/yyy.
fn is_valid_doi(doi: &str) -> bool {
    let normalized = doi
        .trim()
        .trim_start_matches("https://doi.org/")
        .trim_start_matches("http://doi.org/")
        .trim_start_matches("https://dx.doi.org/")
        .trim_start_matches("doi:");

    if !normalized.starts_with("10.") {
        return false;
    }
    // Debe tener al menos "10.XXXX/suffix"
    let parts: Vec<&str> = normalized.splitn(2, '/').collect();
    if parts.len() < 2 { return false; }
    // El registrant (partes[0] = "10.XXXX") debe tener al menos 4 dígitos tras "10."
    let registrant = parts[0].trim_start_matches("10.");
    if registrant.len() < 4 || !registrant.chars().all(|c| c.is_ascii_digit() || c == '.') {
        return false;
    }
    // El sufijo (parts[1]) debe ser no vacío
    !parts[1].trim().is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bibliography::parser::BibEntry;

    fn entry(key: &str, doi: Option<&str>) -> BibEntry {
        let mut fields = std::collections::HashMap::new();
        if let Some(d) = doi { fields.insert("doi".to_string(), d.to_string()); }
        BibEntry { key: key.to_string(), entry_type: "article".to_string(), fields }
    }

    #[test]
    fn doi_valido() {
        assert!(is_valid_doi("10.1145/359545.359563"));
        assert!(is_valid_doi("https://doi.org/10.1145/359545.359563"));
        assert!(is_valid_doi("doi:10.1016/j.jocs.2020.101234"));
    }

    #[test]
    fn doi_invalido() {
        assert!(!is_valid_doi("not-a-doi"));
        assert!(!is_valid_doi("10.abc/invalid"));
        assert!(!is_valid_doi("10.123"));
        assert!(!is_valid_doi(""));
    }

    #[test]
    fn duplicados_doi_detectados() {
        let entries = vec![
            entry("smith2020", Some("10.1145/111.222")),
            entry("jones2021", Some("10.1145/111.222")),
        ];
        let result = validate_entries(&entries);
        assert!(!result.duplicate_dois.is_empty(), "debe detectar DOI duplicado");
    }

    #[test]
    fn duplicados_key_detectados() {
        let entries = vec![
            entry("smith2020", None),
            entry("smith2020", None),
        ];
        let result = validate_entries(&entries);
        assert!(!result.duplicate_keys.is_empty(), "debe detectar key duplicada");
    }

    #[test]
    fn doi_invalido_detectado() {
        let entries = vec![entry("bad2020", Some("not-a-doi"))];
        let result = validate_entries(&entries);
        assert!(!result.invalid_dois.is_empty(), "debe detectar DOI inválido");
    }

    #[test]
    fn entradas_limpias_sin_errores() {
        let entries = vec![
            entry("smith2020", Some("10.1145/359545.359563")),
            entry("jones2021", Some("10.1016/j.jocs.2020.101234")),
        ];
        let result = validate_entries(&entries);
        assert!(result.duplicate_keys.is_empty());
        assert!(result.duplicate_dois.is_empty());
        assert!(result.invalid_dois.is_empty());
    }
}
