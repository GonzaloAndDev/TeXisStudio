// Validación cruzada entre citas usadas en el contenido y el archivo .bib,
// más validación de campos requeridos por tipo de entrada BibTeX.
//
// E_CITATION_KEY_NOT_IN_BIB  — cita con key inexistente en references.bib
// E_BIB_MISSING_FIELD        — campo obligatorio ausente para ese tipo de entrada
// W_UNUSED_REFERENCE         — entry en .bib no citada en ningún bloque
// W_BIB_INVALID_YEAR         — año con formato inválido (no es número 4 dígitos)
// W_BIB_ARTICLE_NO_DOI       — artículo sin DOI ni URL (recomendación APA7/IEEE)
// W_BIB_UNKNOWN_TYPE         — tipo de entrada no reconocido
// W_BIB_PARSE_ERROR          — .bib con formato inválido

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::bibliography::parser::{BibEntry, BibParser};
use crate::project::model::{ContentBlock, ProjectModel};
use std::collections::HashSet;
use std::path::Path;

pub fn validate(model: &ProjectModel, project_dir: &Path) -> ValidationReport {
    let mut issues = Vec::new();

    let bib_path = project_dir
        .join("content")
        .join("bibliography")
        .join("references.bib");

    // Sin .bib no hay nada que cruzar — el validador técnico ya avisa de su ausencia.
    if !bib_path.exists() {
        return ValidationReport::new(issues);
    }

    let entries = match BibParser.parse_file(&bib_path) {
        Ok(e) => e,
        Err(_) => {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Warning,
                code: "W_BIB_PARSE_ERROR".to_string(),
                message: "No se pudo leer el archivo references.bib para validar las citas."
                    .to_string(),
                suggestion: Some(
                    "Verifica que el archivo .bib tenga formato BibTeX válido.".to_string(),
                ),
                section_id: None,
            });
            return ValidationReport::new(issues);
        }
    };

    // Validar campos requeridos y formato de cada entrada
    for entry in &entries {
        issues.extend(validate_entry_fields(entry));
    }

    let bib_keys: HashSet<String> = entries.into_iter().map(|e| e.key).collect();

    // Recolectar todas las keys citadas en el documento
    let mut cited_keys: HashSet<String> = HashSet::new();
    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Citation(cit) = block {
                let key = cit.citation_key.trim().to_string();
                if !key.is_empty() {
                    if !bib_keys.contains(&key) {
                        issues.push(ValidationIssue {
                            severity: IssueSeverity::Error,
                            code: "E_CITATION_KEY_NOT_IN_BIB".to_string(),
                            message: format!(
                                "La cita '{}' en la sección '{}' no existe en references.bib.",
                                key, section.id
                            ),
                            suggestion: Some(format!(
                                "Agrega la entrada '{}' al archivo references.bib o corrige la citation key.",
                                key
                            )),
                            section_id: Some(section.id.clone()),
                        });
                    }
                    cited_keys.insert(key);
                }
            }
        }
    }

    // Referencias definidas en .bib pero no citadas en el documento.
    // Solo si hay al menos alguna cita — sin citas el warning sería ruido prematuro.
    if !cited_keys.is_empty() {
        for bib_key in &bib_keys {
            if !cited_keys.contains(bib_key.as_str()) {
                issues.push(ValidationIssue {
                    severity: IssueSeverity::Warning,
                    code: "W_UNUSED_REFERENCE".to_string(),
                    message: format!(
                        "La referencia '{}' está en references.bib pero no se cita en el documento.",
                        bib_key
                    ),
                    suggestion: Some(
                        "Cita la referencia en el texto o elimínala del .bib para mantener la bibliografía limpia."
                            .to_string(),
                    ),
                    section_id: None,
                });
            }
        }
    }

    ValidationReport::new(issues)
}

// ── Validación de campos por tipo ─────────────────────────────────────────────

/// Campos requeridos por tipo de entrada BibTeX.
/// Los elementos con `|` son OR — basta con que uno esté presente.
fn required_fields_for(entry_type: &str) -> &'static [&'static str] {
    match entry_type {
        "article"                        => &["author", "title", "journal", "year"],
        "book"                           => &["author|editor", "title", "publisher", "year"],
        "booklet"                        => &["title"],
        "inbook"                         => &["author|editor", "title", "chapter|pages", "publisher", "year"],
        "incollection"                   => &["author", "title", "booktitle", "publisher", "year"],
        "inproceedings" | "conference"   => &["author", "title", "booktitle", "year"],
        "manual"                         => &["title"],
        "mastersthesis"                  => &["author", "title", "school", "year"],
        "phdthesis"                      => &["author", "title", "school", "year"],
        "proceedings"                    => &["title", "year"],
        "techreport"                     => &["author", "title", "institution", "year"],
        "unpublished"                    => &["author", "title", "note"],
        // misc / online / software / dataset: no required fields in BibTeX spec
        _ => &[],
    }
}

const KNOWN_ENTRY_TYPES: &[&str] = &[
    "article", "book", "booklet", "conference", "inbook", "incollection",
    "inproceedings", "manual", "mastersthesis", "misc", "phdthesis",
    "proceedings", "techreport", "unpublished", "online", "software", "dataset",
];

fn validate_entry_fields(entry: &BibEntry) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    // Tipo desconocido
    if !KNOWN_ENTRY_TYPES.contains(&entry.entry_type.as_str()) {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_BIB_UNKNOWN_TYPE".to_string(),
            message: format!(
                "La entrada '{}' usa el tipo '@{}' que no es un tipo BibTeX estándar.",
                entry.key, entry.entry_type
            ),
            suggestion: Some(
                "Usa tipos estándar: @article, @book, @inproceedings, @mastersthesis, @phdthesis, @misc…"
                    .to_string(),
            ),
            section_id: None,
        });
    }

    // Campos requeridos según el tipo
    for req in required_fields_for(&entry.entry_type) {
        let alternatives: Vec<&str> = req.split('|').collect();
        let present = alternatives.iter().any(|f| {
            entry.fields.get(*f).map(|v| !v.trim().is_empty()).unwrap_or(false)
        });
        if !present {
            let field_desc = alternatives.join(" o ");
            issues.push(ValidationIssue {
                severity: IssueSeverity::Error,
                code: "E_BIB_MISSING_FIELD".to_string(),
                message: format!(
                    "La entrada '{}' (@{}) no tiene el campo obligatorio '{}'.",
                    entry.key, entry.entry_type, field_desc
                ),
                suggestion: Some(format!(
                    "Agrega '{}' a la entrada '{}' en references.bib.",
                    field_desc, entry.key
                )),
                section_id: None,
            });
        }
    }

    // Formato del año: debe ser número de 4 dígitos entre 1000 y 2100
    let year = entry.year();
    if !year.is_empty() {
        let valid = year.parse::<u32>().map(|y| (1000..=2100).contains(&y)).unwrap_or(false);
        if !valid {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Warning,
                code: "W_BIB_INVALID_YEAR".to_string(),
                message: format!(
                    "La entrada '{}' tiene un año con formato inválido: '{}'.",
                    entry.key, year
                ),
                suggestion: Some("El año debe ser un número de 4 dígitos (ej. 2023).".to_string()),
                section_id: None,
            });
        }
    }

    // Los artículos sin DOI ni URL tienen menor trazabilidad (recomendación APA7 e IEEE)
    if entry.entry_type == "article" {
        let has_doi = entry.fields.get("doi").map(|v| !v.trim().is_empty()).unwrap_or(false);
        let has_url = entry.fields.get("url").map(|v| !v.trim().is_empty()).unwrap_or(false);
        if !has_doi && !has_url {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Warning,
                code: "W_BIB_ARTICLE_NO_DOI".to_string(),
                message: format!(
                    "El artículo '{}' no tiene DOI ni URL.",
                    entry.key
                ),
                suggestion: Some(
                    "APA 7 e IEEE recomiendan incluir el DOI. Agrega: doi = {10.xxxx/...}".to_string(),
                ),
                section_id: None,
            });
        }
    }

    issues
}

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{
        AcademicLevel, BibliographyBackend, CitationBlock, CitationType, CompilerKind,
        ContentBlock, DocumentClassConfig, DocumentKind, InstitutionData,
        LatexConfig, LatexEngine, ProjectMetadata, ProjectModel, ProjectSection,
        SectionPlacement, StudentData,
    };
    use std::collections::HashMap;
    use tempfile::TempDir;

    fn make_model(sections: Vec<ProjectSection>) -> ProjectModel {
        ProjectModel {
            id: "test".to_string(),
            schema_version: "1.0.0".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
            metadata: ProjectMetadata {
                title: "T".to_string(), subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Licenciatura,
                language: "es".to_string(),
                city: "x".to_string(), year: 2026, keywords: vec![],
                funding: None,
            },
            institution: InstitutionData {
                name: "U".to_string(), faculty: None, department: None,
                logo_path: None, country: "MX".to_string(),
            },
            student: StudentData {
                full_name: "A".to_string(), student_id: None, email: None,
                advisor: None, co_advisor: None, advisors: vec![], co_authors: vec![],
                committee: vec![], orcid: None,
            },
            profile_id: "generic.thesis".to_string(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig { name: "book".to_string(), options: vec![] },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".to_string(),
                packages_required: vec![],
                typography: Default::default(),
            },
            sections,
            file_states: HashMap::new(),
        }
    }

    fn section_with_citations(id: &str, keys: &[&str]) -> ProjectSection {
        let blocks = keys.iter().map(|k| {
            ContentBlock::Citation(CitationBlock {
                id: k.to_string(),
                citation_key: k.to_string(),
                citation_type: CitationType::Parenthetical,
                page: None, prefix: None, suffix: None,
            })
        }).collect();
        ProjectSection {
            id: id.to_string(),
            element_id: id.to_string(),
            title: None,
            placement: SectionPlacement::Body,
            required: false,
            enabled: true,
            label: None,
            status: Default::default(),
            notes: None,
            blocks,
            fields: HashMap::new(),
            children: vec![],
        }
    }

    fn write_bib(dir: &TempDir, content: &str) {
        let bib_dir = dir.path().join("content").join("bibliography");
        std::fs::create_dir_all(&bib_dir).unwrap();
        std::fs::write(bib_dir.join("references.bib"), content).unwrap();
    }

    const BIB_SIMPLE: &str = r#"
@article{smith2020,
  author  = {Smith, John},
  title   = {A Study},
  year    = {2020},
  journal = {Journal of Things},
  doi     = {10.1000/xyz123},
}
@book{jones2019,
  author    = {Jones, Alice},
  title     = {A Book},
  year      = {2019},
  publisher = {Publisher},
}
"#;

    // ── Tests de validación de campos requeridos ───────────────────

    #[test]
    fn article_sin_journal_produce_error() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@article{bad2020,
  author = {Perez, Luis},
  title  = {Sin revista},
  year   = {2020},
  doi    = {10.1000/x},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            report.issues.iter().any(|i| i.code == "E_BIB_MISSING_FIELD" && i.message.contains("bad2020")),
            "debe detectar campo 'journal' ausente en @article"
        );
    }

    #[test]
    fn article_completo_no_produce_error_de_campos() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@article{good2020,
  author  = {Lopez, Ana},
  title   = {Un estudio},
  journal = {Revista X},
  year    = {2020},
  doi     = {10.1000/x},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            !report.issues.iter().any(|i| i.code == "E_BIB_MISSING_FIELD"),
            "artículo completo no debe emitir error de campo"
        );
    }

    #[test]
    fn book_con_editor_en_lugar_de_author_es_valido() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@book{handbook2021,
  editor    = {Garcia, Maria},
  title     = {Handbook},
  publisher = {Editorial},
  year      = {2021},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            !report.issues.iter().any(|i| i.code == "E_BIB_MISSING_FIELD"),
            "@book con editor (sin author) debe ser válido"
        );
    }

    #[test]
    fn year_invalido_produce_warning() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@misc{web,
  author = {Alguien},
  title  = {Algo},
  year   = {s.f.},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            report.issues.iter().any(|i| i.code == "W_BIB_INVALID_YEAR"),
            "año no numérico debe producir W_BIB_INVALID_YEAR"
        );
    }

    #[test]
    fn article_sin_doi_produce_warning() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@article{nodoi2022,
  author  = {Ramos, Pedro},
  title   = {Sin DOI},
  journal = {Revista Y},
  year    = {2022},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            report.issues.iter().any(|i| i.code == "W_BIB_ARTICLE_NO_DOI"),
            "artículo sin DOI ni URL debe producir W_BIB_ARTICLE_NO_DOI"
        );
    }

    #[test]
    fn article_con_url_no_produce_warning_doi() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@article{withurl2022,
  author  = {Torres, Eva},
  title   = {Con URL},
  journal = {Revista Z},
  year    = {2022},
  url     = {https://example.com/paper},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            !report.issues.iter().any(|i| i.code == "W_BIB_ARTICLE_NO_DOI"),
            "artículo con URL (sin DOI) no debe producir W_BIB_ARTICLE_NO_DOI"
        );
    }

    #[test]
    fn tipo_desconocido_produce_warning() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, r#"
@webpage{sitio2023,
  author = {Alguien},
  title  = {Una pagina},
  year   = {2023},
}
"#);
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            report.issues.iter().any(|i| i.code == "W_BIB_UNKNOWN_TYPE"),
            "@webpage desconocido debe producir W_BIB_UNKNOWN_TYPE"
        );
    }

    #[test]
    fn cita_existente_no_produce_error() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, BIB_SIMPLE);
        let model = make_model(vec![section_with_citations("intro", &["smith2020"])]);
        let report = validate(&model, tmp.path());
        assert!(!report.has_errors(), "no debe haber errores para cita válida");
    }

    #[test]
    fn cita_inexistente_produce_error() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, BIB_SIMPLE);
        let model = make_model(vec![section_with_citations("intro", &["nosuchkey2099"])]);
        let report = validate(&model, tmp.path());
        assert!(
            report.issues.iter().any(|i| i.code == "E_CITATION_KEY_NOT_IN_BIB"),
            "debe detectar cita inexistente"
        );
    }

    #[test]
    fn referencia_no_citada_produce_warning() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, BIB_SIMPLE);
        // Citar solo smith2020; jones2019 queda sin citar
        let model = make_model(vec![section_with_citations("intro", &["smith2020"])]);
        let report = validate(&model, tmp.path());
        assert!(
            report.issues.iter().any(|i| i.code == "W_UNUSED_REFERENCE" && i.message.contains("jones2019")),
            "debe advertir sobre referencia no citada"
        );
    }

    #[test]
    fn sin_bib_no_produce_issues() {
        let tmp = TempDir::new().unwrap();
        // NO creamos el .bib
        let model = make_model(vec![section_with_citations("intro", &["smith2020"])]);
        let report = validate(&model, tmp.path());
        // El validador de bibliografía no emite nada — el validador técnico ya emite W_MISSING_BIB
        assert!(report.issues.is_empty(), "sin .bib no debe emitir issues de bib-cross");
    }

    #[test]
    fn sin_citas_en_documento_no_advierte_no_citadas() {
        let tmp = TempDir::new().unwrap();
        write_bib(&tmp, BIB_SIMPLE);
        // Ninguna cita en el modelo
        let model = make_model(vec![]);
        let report = validate(&model, tmp.path());
        assert!(
            !report.issues.iter().any(|i| i.code == "W_UNUSED_REFERENCE"),
            "sin citas en el documento, no debe advertir sobre referencias no usadas"
        );
    }
}
