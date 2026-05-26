// Validaciones técnicas: archivos referenciados, labels duplicados, etc.

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::project::model::{ContentBlock, ProjectModel};
use std::collections::HashSet;
use std::path::Path;

pub fn validate(model: &ProjectModel, project_dir: &Path) -> ValidationReport {
    let mut issues = Vec::new();

    check_missing_figures(model, project_dir, &mut issues);
    check_unsafe_figure_paths(model, &mut issues);
    check_missing_bib(model, project_dir, &mut issues);
    check_duplicate_labels(model, &mut issues);
    check_invalid_label_format(model, &mut issues);
    check_invalid_citation_keys(model, &mut issues);
    check_unconfirmed_raw_latex(model, &mut issues);

    ValidationReport::new(issues)
}

fn check_missing_figures(model: &ProjectModel, project_dir: &Path, issues: &mut Vec<ValidationIssue>) {
    let figures_dir = project_dir.join("content").join("figures");

    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Figure(fig) = block {
                let file_path = figures_dir.join(&fig.file);
                if !file_path.exists() {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Error,
                        code: "E_MISSING_IMAGE".to_string(),
                        message: format!(
                            "Imagen '{}' referenciada en la sección '{}' no encontrada.",
                            fig.file, section.id
                        ),
                        suggestion: Some(format!(
                            "Agrega el archivo de imagen en content/figures/{} o corrige el nombre en el bloque de figura.",
                            fig.file
                        )),
                        section_id: Some(section.id.clone()),
                        automated: Some(true),
                        ..Default::default()
                    });
                }
            }
        }
    }
}

fn check_missing_bib(model: &ProjectModel, project_dir: &Path, issues: &mut Vec<ValidationIssue>) {
    let bib_path = project_dir
        .join("content")
        .join("bibliography")
        .join("references.bib");

    // Solo alertar si hay sección de references y no existe el .bib
    let has_references = model
        .sections
        .iter()
        .any(|s| s.element_id == "references");

    if has_references && !bib_path.exists() {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_MISSING_BIB".to_string(),
            message: "Archivo de bibliografía 'content/bibliography/references.bib' no encontrado.".to_string(),
            suggestion: Some(
                "Crea el archivo content/bibliography/references.bib con las referencias en formato BibTeX."
                    .to_string(),
            ),
            automated: Some(true),
            ..Default::default()
        });
    }
}

/// Detecta rutas de figura con path traversal o absolutas.
fn check_unsafe_figure_paths(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Figure(fig) = block {
                let path = &fig.file;
                let is_unsafe = path.is_empty()
                    || path.contains("..")
                    || path.starts_with('/')
                    || path.starts_with('\\')
                    || (path.len() > 1 && path.chars().nth(1) == Some(':'));

                if is_unsafe {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Error,
                        code: "E_UNSAFE_FIGURE_PATH".to_string(),
                        message: format!(
                            "Ruta de figura insegura o vacía '{}' en la sección '{}'.",
                            path, section.id
                        ),
                        suggestion: Some(
                            "Usa solo nombres de archivo relativos sin '..' ni rutas absolutas, p.ej. 'grafica.png'.".to_string()
                        ),
                        section_id: Some(section.id.clone()),
                        automated: Some(true),
                        ..Default::default()
                    });
                }
            }
        }
    }
}

/// Valida que los labels de figuras, tablas y ecuaciones solo contengan
/// caracteres permitidos por LaTeX: letras, números, `:`, `_`, `-` y `.`.
fn check_invalid_label_format(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    let is_valid_label = |s: &str| -> bool {
        !s.is_empty()
            && s.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false)
            && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '_' | '-' | '.'))
    };

    for section in &model.sections {
        for block in &section.blocks {
            let (label_opt, block_type) = match block {
                ContentBlock::Figure(f)   => (Some(f.label.as_str()), "figura"),
                ContentBlock::Table(t)    => (Some(t.label.as_str()), "tabla"),
                ContentBlock::Equation(e) => (e.label.as_deref(), "ecuación"),
                _ => (None, ""),
            };
            if let Some(label) = label_opt {
                if !label.is_empty() && !is_valid_label(label) {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Warning,
                        code: "W_INVALID_LABEL".to_string(),
                        message: format!(
                            "Label '{}' en {} de sección '{}' contiene caracteres no permitidos por LaTeX.",
                            label, block_type, section.id
                        ),
                        suggestion: Some(
                            "Los labels solo pueden contener letras, números, ':', '_', '-' y '.', y deben empezar por letra.".to_string()
                        ),
                        section_id: Some(section.id.clone()),
                        automated: Some(true),
                        ..Default::default()
                    });
                }
            }
        }
    }
}

/// Valida que las citation keys de bloques de cita solo usen caracteres
/// permitidos en BibTeX: letras, dígitos y los símbolos `_`, `-`, `.`, `:`.
fn check_invalid_citation_keys(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    let is_valid_key = |s: &str| -> bool {
        !s.is_empty()
            && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | ':'))
            // Ningún espacio ni carácter de control
            && !s.contains(char::is_whitespace)
    };

    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Citation(cit) = block {
                if !is_valid_key(&cit.citation_key) {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Error,
                        code: "E_INVALID_CITATION_KEY".to_string(),
                        message: format!(
                            "Citation key '{}' en sección '{}' no es válida para BibTeX.",
                            cit.citation_key, section.id
                        ),
                        suggestion: Some(
                            "Las citation keys solo pueden contener letras, números, '_', '-', '.' y ':' sin espacios.".to_string()
                        ),
                        section_id: Some(section.id.clone()),
                        automated: Some(true),
                        ..Default::default()
                    });
                }
            }
        }
    }
}

/// Advierte cuando hay bloques RawLatex sin confirmar por el usuario.
/// El generador los omite, pero el usuario puede no darse cuenta.
fn check_unconfirmed_raw_latex(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::RawLatex(r) = block {
                if !r.user_confirmed {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Warning,
                        code: "W_UNCONFIRMED_RAW_LATEX".to_string(),
                        message: format!(
                            "Bloque LaTeX directo en sección '{}' no ha sido confirmado y no se incluirá en la compilación.",
                            section.id
                        ),
                        suggestion: Some(
                            "Confirma el bloque desde el editor para que se incluya en el documento generado.".to_string()
                        ),
                        section_id: Some(section.id.clone()),
                        automated: Some(true),
                        ..Default::default()
                    });
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{
        AcademicLevel, BibliographyBackend, CitationBlock, CitationType, CompilerKind,
        ContentBlock, DocumentClassConfig, DocumentKind, FigureBlock,
        FigureWidth, InstitutionData, LatexConfig, LatexEngine, ProjectMetadata, ProjectModel,
        ProjectSection, RawLatexBlock, SectionPlacement, StudentData,
    };
    use std::collections::HashMap;

    /// Construye una sección mínima con los bloques dados.
    fn section_with(id: &str, blocks: Vec<ContentBlock>) -> ProjectSection {
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

    fn model_with_sections(sections: Vec<ProjectSection>) -> ProjectModel {
        ProjectModel {
            id: "t".to_string(),
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

    fn fig(id: &str, file: &str, label: &str) -> ContentBlock {
        ContentBlock::Figure(FigureBlock {
            id: id.to_string(), file: file.to_string(),
            caption: "".to_string(), source: None,
            width: FigureWidth::Full, label: label.to_string(),
            include_in_list: false,
        })
    }

    fn citation(id: &str, key: &str) -> ContentBlock {
        ContentBlock::Citation(CitationBlock {
            id: id.to_string(), citation_key: key.to_string(),
            citation_type: CitationType::Parenthetical,
            page: None, prefix: None, suffix: None,
        })
    }

    fn raw_latex(id: &str, confirmed: bool) -> ContentBlock {
        ContentBlock::RawLatex(RawLatexBlock {
            id: id.to_string(),
            content: "\\textbf{x}".to_string(),
            user_confirmed: confirmed,
        })
    }

    // ── Rutas de figura ───────────────────────────────────────────
    #[test]
    fn figura_con_traversal_produce_error() {
        let model = model_with_sections(vec![
            section_with("intro", vec![fig("f1", "../secret.png", "fig:ok")])
        ]);
        let mut issues = Vec::new();
        check_unsafe_figure_paths(&model, &mut issues);
        assert!(issues.iter().any(|i| i.code == "E_UNSAFE_FIGURE_PATH"), "debe detectar '../'");
    }

    #[test]
    fn figura_con_ruta_absoluta_produce_error() {
        let model = model_with_sections(vec![
            section_with("intro", vec![fig("f1", "/etc/passwd", "fig:ok")])
        ]);
        let mut issues = Vec::new();
        check_unsafe_figure_paths(&model, &mut issues);
        assert!(issues.iter().any(|i| i.code == "E_UNSAFE_FIGURE_PATH"));
    }

    #[test]
    fn figura_con_ruta_segura_no_produce_error() {
        let model = model_with_sections(vec![
            section_with("intro", vec![fig("f1", "grafica.png", "fig:g1")])
        ]);
        let mut issues = Vec::new();
        check_unsafe_figure_paths(&model, &mut issues);
        assert!(issues.is_empty());
    }

    // ── Formato de labels ─────────────────────────────────────────
    #[test]
    fn label_con_espacio_produce_warning() {
        let model = model_with_sections(vec![
            section_with("intro", vec![fig("f1", "img.png", "fig mi figura")])
        ]);
        let mut issues = Vec::new();
        check_invalid_label_format(&model, &mut issues);
        assert!(issues.iter().any(|i| i.code == "W_INVALID_LABEL"));
    }

    #[test]
    fn label_que_empieza_con_numero_produce_warning() {
        let model = model_with_sections(vec![
            section_with("intro", vec![fig("f1", "img.png", "1fig")])
        ]);
        let mut issues = Vec::new();
        check_invalid_label_format(&model, &mut issues);
        assert!(issues.iter().any(|i| i.code == "W_INVALID_LABEL"));
    }

    #[test]
    fn label_valido_no_produce_warning() {
        let model = model_with_sections(vec![
            section_with("intro", vec![fig("f1", "img.png", "fig:mi-grafica.1")])
        ]);
        let mut issues = Vec::new();
        check_invalid_label_format(&model, &mut issues);
        assert!(issues.is_empty());
    }

    // ── Citation keys ─────────────────────────────────────────────
    #[test]
    fn citation_key_con_espacio_produce_error() {
        let model = model_with_sections(vec![
            section_with("intro", vec![citation("c1", "smith 2020")])
        ]);
        let mut issues = Vec::new();
        check_invalid_citation_keys(&model, &mut issues);
        assert!(issues.iter().any(|i| i.code == "E_INVALID_CITATION_KEY"));
    }

    #[test]
    fn citation_key_valida_no_produce_error() {
        let model = model_with_sections(vec![
            section_with("intro", vec![citation("c1", "smith2020")])
        ]);
        let mut issues = Vec::new();
        check_invalid_citation_keys(&model, &mut issues);
        assert!(issues.is_empty());
    }

    // ── raw_latex sin confirmar ───────────────────────────────────
    #[test]
    fn raw_latex_sin_confirmar_produce_warning() {
        let model = model_with_sections(vec![
            section_with("intro", vec![raw_latex("r1", false)])
        ]);
        let mut issues = Vec::new();
        check_unconfirmed_raw_latex(&model, &mut issues);
        assert!(issues.iter().any(|i| i.code == "W_UNCONFIRMED_RAW_LATEX"));
    }

    #[test]
    fn raw_latex_confirmado_no_produce_warning() {
        let model = model_with_sections(vec![
            section_with("intro", vec![raw_latex("r1", true)])
        ]);
        let mut issues = Vec::new();
        check_unconfirmed_raw_latex(&model, &mut issues);
        assert!(issues.is_empty());
    }
}

fn check_duplicate_labels(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    let mut seen: HashSet<String> = HashSet::new();

    for section in &model.sections {
        for block in &section.blocks {
            let label = match block {
                ContentBlock::Figure(f) => Some(f.label.clone()),
                ContentBlock::Table(t) => Some(t.label.clone()),
                ContentBlock::Equation(e) => e.label.clone(),
                _ => None,
            };
            if let Some(label) = label {
                if !label.is_empty() && !seen.insert(label.clone()) {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Error,
                        code: "E_DUPLICATE_LABEL".to_string(),
                        message: format!("Label '{}' duplicado en la sección '{}'.", label, section.id),
                        suggestion: Some(format!(
                            "Cambia el label '{}' para que sea único en todo el proyecto.",
                            label
                        )),
                        section_id: Some(section.id.clone()),
                        automated: Some(true),
                        ..Default::default()
                    });
                }
            }
        }
    }
}
