// Validaciones técnicas: archivos referenciados, labels duplicados, etc.

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::project::model::{ContentBlock, ProjectModel};
use std::collections::HashSet;
use std::path::Path;

pub fn validate(model: &ProjectModel, project_dir: &Path) -> ValidationReport {
    let mut issues = Vec::new();

    check_missing_figures(model, project_dir, &mut issues);
    check_missing_bib(model, project_dir, &mut issues);
    check_duplicate_labels(model, &mut issues);

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
            section_id: None,
        });
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
                    });
                }
            }
        }
    }
}
