// Validación cruzada entre citas usadas en el contenido y el archivo .bib.
//
// E_CITATION_KEY_NOT_IN_BIB — cita que usa una key que no existe en references.bib
// W_UNUSED_REFERENCE        — entry en references.bib que no está citada en ningún bloque
// (solo se activa si el .bib existe; sin .bib el validador técnico ya emite W_MISSING_BIB)

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::bibliography::parser::BibParser;
use crate::project::model::{ContentBlock, ProjectModel};
use std::collections::HashSet;
use std::path::Path;

pub fn validate(model: &ProjectModel, project_dir: &Path) -> ValidationReport {
    let mut issues = Vec::new();

    let bib_path = project_dir
        .join("content")
        .join("bibliography")
        .join("references.bib");

    // Si no hay .bib, no hay nada que cruzar — el validador técnico ya avisa de su ausencia.
    if !bib_path.exists() {
        return ValidationReport::new(issues);
    }

    // Parsear el .bib
    let bib_keys: HashSet<String> = match BibParser.parse_file(&bib_path) {
        Ok(entries) => entries.into_iter().map(|e| e.key).collect(),
        Err(_) => {
            // Si no se puede parsear, emitir un warning de parseo y salir
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

    // Recolectar todas las keys citadas en el documento
    let mut cited_keys: HashSet<String> = HashSet::new();

    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Citation(cit) = block {
                let key = cit.citation_key.trim().to_string();
                if !key.is_empty() {
                    // Verificar si la key existe en el .bib
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

    // Detectar referencias definidas en .bib pero no citadas en el documento
    // Solo si hay al menos alguna cita — si no hay citas, es probable que el
    // estudiante todavía no empezó a citar y el warning sería ruido.
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

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{
        AcademicLevel, BibliographyBackend, CitationBlock, CitationType, CompilerKind,
        ContentBlock, DocumentClassConfig, DocumentKind, FigureWidth, InstitutionData,
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
            },
            institution: InstitutionData {
                name: "U".to_string(), faculty: None, department: None,
                logo_path: None, country: "MX".to_string(),
            },
            student: StudentData {
                full_name: "A".to_string(), student_id: None, email: None,
                advisor: None, co_advisor: None, advisors: vec![], co_authors: vec![],
            },
            profile_id: "generic.thesis".to_string(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig { name: "book".to_string(), options: vec![] },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".to_string(),
                packages_required: vec![],
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
  author = {Smith, John},
  title  = {A Study},
  year   = {2020},
  journal = {Journal of Things},
}
@book{jones2019,
  author = {Jones, Alice},
  title  = {A Book},
  year   = {2019},
  publisher = {Publisher},
}
"#;

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
