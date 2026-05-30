// Validación de referencias cruzadas (P5A).
//
// Comprueba que las figuras, tablas y ecuaciones con etiqueta (\label)
// sean efectivamente citadas en el texto mediante \ref{}, \autoref{},
// \cref{} u otro comando que use la etiqueta entre llaves {label}.
//
// Códigos emitidos:
//   W_FIGURE_NOT_CITED   — figura con label sin ninguna referencia en el texto
//   W_TABLE_NOT_CITED    — tabla con label sin ninguna referencia en el texto
//   W_EQUATION_NOT_CITED — ecuación con label sin ninguna referencia en el texto

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::project::model::{ContentBlock, ProjectModel};
use std::collections::HashSet;

pub fn validate(model: &ProjectModel) -> ValidationReport {
    let mut issues = Vec::new();

    let text_corpus = collect_text_corpus(model);

    check_figures(model, &text_corpus, &mut issues);
    check_tables(model, &text_corpus, &mut issues);
    check_equations(model, &text_corpus, &mut issues);

    ValidationReport::new(issues)
}

// ── Corpus de texto ───────────────────────────────────────────────────────────

/// Recopila todo el texto narrativo del proyecto en un único String
/// para buscar etiquetas en él eficientemente.
fn collect_text_corpus(model: &ProjectModel) -> String {
    let mut corpus = String::new();
    for section in &model.sections {
        if !section.enabled {
            continue;
        }
        for block in &section.blocks {
            match block {
                ContentBlock::Paragraph(b) => {
                    corpus.push(' ');
                    corpus.push_str(&b.content);
                }
                ContentBlock::Heading(b) => {
                    corpus.push(' ');
                    corpus.push_str(&b.content);
                }
                ContentBlock::RawLatex(b) => {
                    corpus.push(' ');
                    corpus.push_str(&b.content);
                }
                ContentBlock::Theorem(b) => {
                    corpus.push(' ');
                    corpus.push_str(&b.content);
                }
                ContentBlock::Code(b) => {
                    corpus.push(' ');
                    corpus.push_str(&b.content);
                }
                ContentBlock::Algorithm(b) => {
                    corpus.push(' ');
                    corpus.push_str(&b.caption);
                    corpus.push(' ');
                    corpus.push_str(&b.body);
                }
                _ => {}
            }
        }
    }
    corpus
}

/// Devuelve `true` si `label` aparece en el corpus dentro de llaves `{label}`,
/// lo que captura `\ref{label}`, `\autoref{label}`, `\cref{label}`, etc.
fn label_cited(corpus: &str, label: &str) -> bool {
    if label.is_empty() {
        return true;
    }
    let pattern = format!("{{{}}}", label);
    corpus.contains(&pattern)
}

// ── Figuras ───────────────────────────────────────────────────────────────────

fn check_figures(model: &ProjectModel, corpus: &str, issues: &mut Vec<ValidationIssue>) {
    // Primero recopilamos todos los labels de figuras que están en la lista de figuras
    // (include_in_list=true) — esas se espera sean citadas en el texto.
    let mut seen_labels: HashSet<String> = HashSet::new();

    for section in &model.sections {
        if !section.enabled {
            continue;
        }
        for block in &section.blocks {
            if let ContentBlock::Figure(fig) = block {
                if fig.label.is_empty() || seen_labels.contains(&fig.label) {
                    continue;
                }
                seen_labels.insert(fig.label.clone());

                if !label_cited(corpus, &fig.label) {
                    let caption_preview = if fig.caption.len() > 60 {
                        format!("{}…", &fig.caption[..60])
                    } else {
                        fig.caption.clone()
                    };
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Warning,
                        code: "W_FIGURE_NOT_CITED".to_string(),
                        message: format!(
                            "La figura '{}' (etiqueta: {}) no se cita en el texto.",
                            caption_preview, fig.label
                        ),
                        suggestion: Some(format!(
                            "Agrega \\ref{{{}}} o \\autoref{{{}}} en el párrafo donde se describe esta figura.",
                            fig.label, fig.label
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

// ── Tablas ────────────────────────────────────────────────────────────────────

fn check_tables(model: &ProjectModel, corpus: &str, issues: &mut Vec<ValidationIssue>) {
    let mut seen_labels: HashSet<String> = HashSet::new();

    for section in &model.sections {
        if !section.enabled {
            continue;
        }
        for block in &section.blocks {
            if let ContentBlock::Table(tbl) = block {
                if tbl.label.is_empty() || seen_labels.contains(&tbl.label) {
                    continue;
                }
                seen_labels.insert(tbl.label.clone());

                if !label_cited(corpus, &tbl.label) {
                    let caption_preview = if tbl.caption.len() > 60 {
                        format!("{}…", &tbl.caption[..60])
                    } else {
                        tbl.caption.clone()
                    };
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Warning,
                        code: "W_TABLE_NOT_CITED".to_string(),
                        message: format!(
                            "La tabla '{}' (etiqueta: {}) no se cita en el texto.",
                            caption_preview, tbl.label
                        ),
                        suggestion: Some(format!(
                            "Agrega \\ref{{{}}} o \\autoref{{{}}} en el párrafo donde se describe esta tabla.",
                            tbl.label, tbl.label
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

// ── Ecuaciones ────────────────────────────────────────────────────────────────

fn check_equations(model: &ProjectModel, corpus: &str, issues: &mut Vec<ValidationIssue>) {
    let mut seen_labels: HashSet<String> = HashSet::new();

    for section in &model.sections {
        if !section.enabled {
            continue;
        }
        for block in &section.blocks {
            if let ContentBlock::Equation(eq) = block {
                let label = match eq.label.as_deref() {
                    Some(l) if !l.is_empty() => l,
                    _ => continue,
                };
                if seen_labels.contains(label) {
                    continue;
                }
                seen_labels.insert(label.to_string());

                if !label_cited(corpus, label) {
                    issues.push(ValidationIssue {
                        severity: IssueSeverity::Warning,
                        code: "W_EQUATION_NOT_CITED".to_string(),
                        message: format!(
                            "La ecuación con etiqueta '{}' no se referencia en el texto.",
                            label
                        ),
                        suggestion: Some(format!(
                            "Agrega \\eqref{{{}}} o \\ref{{{}}} en el párrafo donde se explica esta ecuación.",
                            label, label
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

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{
        AcademicLevel, BibliographyBackend, CompilerKind, ContentBlock, DocumentClassConfig,
        DocumentKind, EquationBlock, FigureBlock, FigureWidth, InstitutionData, LatexConfig,
        LatexEngine, ParagraphBlock, ProjectMetadata, ProjectModel, ProjectSection,
        SectionPlacement, StudentData, TableBlock, TableStyle,
    };
    use std::collections::HashMap;

    fn bare_model(sections: Vec<ProjectSection>) -> ProjectModel {
        ProjectModel {
            id: "test".into(),
            schema_version: "1.0.0".into(),
            created_at: "".into(),
            updated_at: "".into(),
            metadata: ProjectMetadata {
                title: "T".into(),
                subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Licenciatura,
                language: "es".into(),
                city: "x".into(),
                year: 2024,
                keywords: vec![],
                funding: None,
            },
            institution: InstitutionData {
                name: "U".into(),
                faculty: None,
                department: None,
                logo_path: None,
                country: "MX".into(),
            },
            student: StudentData {
                full_name: "A".into(),
                student_id: None,
                email: None,
                advisor: None,
                co_advisor: None,
                advisors: vec![],
                co_authors: vec![],
                committee: vec![],
                orcid: None,
            },
            profile_id: "generic".into(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig {
                    name: "book".into(),
                    options: vec![],
                },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".into(),
                packages_required: vec![],
                typography: Default::default(),
                page_layout: None,
            },
            sections,
            file_states: HashMap::new(),
        }
    }

    fn section(id: &str, blocks: Vec<ContentBlock>) -> ProjectSection {
        ProjectSection {
            id: id.into(),
            element_id: id.into(),
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

    fn paragraph(content: &str) -> ContentBlock {
        ContentBlock::Paragraph(ParagraphBlock {
            id: "p1".into(),
            content: content.into(),
            verbatim: false,
        })
    }

    fn figure(label: &str, caption: &str) -> ContentBlock {
        ContentBlock::Figure(FigureBlock {
            id: "f1".into(),
            file: "img.png".into(),
            caption: caption.into(),
            source: None,
            width: FigureWidth::Full,
            label: label.into(),
            include_in_list: true,
        })
    }

    fn table_block(label: &str) -> ContentBlock {
        ContentBlock::Table(TableBlock {
            id: "t1".into(),
            caption: "Resultados".into(),
            source: None,
            label: label.into(),
            include_in_list: true,
            raw_headers: false,
            headers: vec![],
            rows: vec![],
            table_style: TableStyle::Simple,
        })
    }

    fn equation(label: Option<&str>) -> ContentBlock {
        ContentBlock::Equation(EquationBlock {
            id: "e1".into(),
            latex_content: "E=mc^2".into(),
            label: label.map(|s| s.into()),
            numbered: true,
        })
    }

    #[test]
    fn figura_citada_no_produce_warning() {
        let model = bare_model(vec![section(
            "intro",
            vec![
                paragraph("Como se muestra en la \\ref{fig:arch}, el sistema…"),
                figure("fig:arch", "Arquitectura del sistema"),
            ],
        )]);
        let report = validate(&model);
        assert!(!report.issues.iter().any(|i| i.code == "W_FIGURE_NOT_CITED"));
    }

    #[test]
    fn figura_no_citada_produce_warning() {
        let model = bare_model(vec![section(
            "intro",
            vec![
                paragraph("El sistema tiene tres módulos."),
                figure("fig:arch", "Arquitectura del sistema"),
            ],
        )]);
        let report = validate(&model);
        assert!(
            report.issues.iter().any(|i| i.code == "W_FIGURE_NOT_CITED"),
            "debe advertir figura no citada"
        );
    }

    #[test]
    fn tabla_citada_con_autoref() {
        let model = bare_model(vec![section(
            "results",
            vec![
                paragraph("Los datos aparecen en la \\autoref{tab:results}."),
                table_block("tab:results"),
            ],
        )]);
        let report = validate(&model);
        assert!(!report.issues.iter().any(|i| i.code == "W_TABLE_NOT_CITED"));
    }

    #[test]
    fn tabla_no_citada_produce_warning() {
        let model = bare_model(vec![section(
            "results",
            vec![
                paragraph("Los resultados son positivos."),
                table_block("tab:results"),
            ],
        )]);
        let report = validate(&model);
        assert!(
            report.issues.iter().any(|i| i.code == "W_TABLE_NOT_CITED"),
            "debe advertir tabla no citada"
        );
    }

    #[test]
    fn ecuacion_sin_label_ignorada() {
        let model = bare_model(vec![section("theory", vec![equation(None)])]);
        let report = validate(&model);
        assert!(!report
            .issues
            .iter()
            .any(|i| i.code == "W_EQUATION_NOT_CITED"));
    }

    #[test]
    fn ecuacion_con_label_no_citada_produce_warning() {
        let model = bare_model(vec![section(
            "theory",
            vec![
                paragraph("La energía es un concepto fundamental."),
                equation(Some("eq:energy")),
            ],
        )]);
        let report = validate(&model);
        assert!(
            report
                .issues
                .iter()
                .any(|i| i.code == "W_EQUATION_NOT_CITED"),
            "debe advertir ecuación no citada"
        );
    }

    #[test]
    fn label_vacio_no_produce_warning() {
        let model = bare_model(vec![section("intro", vec![figure("", "Sin etiqueta")])]);
        let report = validate(&model);
        assert!(!report.issues.iter().any(|i| i.code == "W_FIGURE_NOT_CITED"));
    }
}
