// Validaciones académicas: estructura mínima, metadatos requeridos, etc.

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::project::model::ProjectModel;

pub fn validate(model: &ProjectModel) -> ValidationReport {
    let mut issues = Vec::new();

    check_title_not_empty(model, &mut issues);
    check_student_name(model, &mut issues);
    check_placeholder_metadata(model, &mut issues);
    check_institution_name(model, &mut issues);
    check_has_body_sections(model, &mut issues);
    check_required_sections_have_content(model, &mut issues);
    check_has_advisor(model, &mut issues);
    check_posgrado_committee(model, &mut issues);
    check_posgrado_abstract(model, &mut issues);

    ValidationReport::new(issues)
}

fn check_title_not_empty(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    if model.metadata.title.trim().is_empty() {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Error,
            code: "E_EMPTY_TITLE".to_string(),
            message: "El título del proyecto está vacío.".to_string(),
            suggestion: Some("Ingresa un título en los metadatos del proyecto.".to_string()),
            section_id: None,
        });
    }
}

fn check_student_name(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    if model.student.full_name.trim().is_empty() {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Error,
            code: "E_EMPTY_STUDENT_NAME".to_string(),
            message: "El nombre del autor está vacío.".to_string(),
            suggestion: Some("Ingresa el nombre completo del autor en los datos del estudiante.".to_string()),
            section_id: None,
        });
    }
}

fn check_institution_name(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    if model.institution.name.trim().is_empty() {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_EMPTY_INSTITUTION".to_string(),
            message: "El nombre de la institución está vacío.".to_string(),
            suggestion: Some("Ingresa el nombre de la institución en los datos institucionales.".to_string()),
            section_id: None,
        });
    }
}

fn check_has_body_sections(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    use crate::project::model::SectionPlacement;

    let has_body = model
        .sections
        .iter()
        .any(|s| s.enabled && matches!(s.placement, SectionPlacement::Body));

    if !has_body {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_NO_BODY_SECTIONS".to_string(),
            message: "El proyecto no tiene secciones de cuerpo principal habilitadas.".to_string(),
            suggestion: Some("Agrega al menos un capítulo (introducción, marco teórico, etc.).".to_string()),
            section_id: None,
        });
    }
}

fn check_posgrado_committee(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    use crate::project::model::AcademicLevel;

    if matches!(model.metadata.academic_level, AcademicLevel::Doctorado)
        && model.student.committee.is_empty()
    {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_PHD_NO_COMMITTEE".to_string(),
            message: "Una tesis de doctorado generalmente requiere un comité sinodal o jurado.".to_string(),
            suggestion: Some("Agrega los miembros del comité en el panel de metadatos del proyecto.".to_string()),
            section_id: None,
        });
    }
}

/// Detecta metadatos que siguen siendo los valores por defecto de la plantilla.
fn check_placeholder_metadata(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    if model.student.full_name.trim() == "Autor" {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Error,
            code: "E_PLACEHOLDER_STUDENT_NAME".to_string(),
            message: "El nombre del autor sigue siendo el valor predeterminado ('Autor').".to_string(),
            suggestion: Some("Actualiza el nombre completo del autor en los metadatos del proyecto.".to_string()),
            section_id: None,
        });
    }
    if model.institution.name.trim() == "Universidad" {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_PLACEHOLDER_INSTITUTION".to_string(),
            message: "El nombre de la institución sigue siendo el valor predeterminado ('Universidad').".to_string(),
            suggestion: Some("Actualiza el nombre de tu institución en los metadatos.".to_string()),
            section_id: None,
        });
    }
}

/// Error si una sección obligatoria está habilitada pero no tiene ningún bloque de contenido.
/// Las secciones auto-generadas (portada, índice, referencias, listas) se omiten.
fn check_required_sections_have_content(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    const AUTO_GENERATED: &[&str] = &[
        "title_page", "table_of_contents", "list_of_figures",
        "list_of_tables", "list_of_algorithms", "references",
    ];

    for section in &model.sections {
        if !section.required || !section.enabled {
            continue;
        }
        if AUTO_GENERATED.contains(&section.element_id.as_str()) {
            continue;
        }
        if section.blocks.is_empty() {
            let title = section.title.as_deref().unwrap_or(section.id.as_str());
            issues.push(ValidationIssue {
                severity: IssueSeverity::Error,
                code: "E_EMPTY_REQUIRED_SECTION".to_string(),
                message: format!("La sección obligatoria '{}' está vacía.", title),
                suggestion: Some(format!(
                    "Agrega contenido en la sección '{}' antes de exportar.",
                    title
                )),
                section_id: Some(section.id.clone()),
            });
        }
    }
}

/// Avisa si no se ha asignado ningún director de tesis.
fn check_has_advisor(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    let has_advisor = model.student.advisor
        .as_deref()
        .map(|a| !a.trim().is_empty())
        .unwrap_or(false)
        || !model.student.advisors.is_empty();

    if !has_advisor {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_NO_ADVISOR".to_string(),
            message: "No se ha especificado un director de tesis.".to_string(),
            suggestion: Some("Ingresa el nombre del director en el panel de metadatos.".to_string()),
            section_id: None,
        });
    }
}

fn check_posgrado_abstract(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    use crate::project::model::AcademicLevel;

    let is_posgrado = matches!(
        model.metadata.academic_level,
        AcademicLevel::Maestria | AcademicLevel::Doctorado
    );
    if !is_posgrado {
        return;
    }

    let has_en_abstract = model.sections.iter().any(|s| {
        s.enabled && s.element_id == "abstract_en" && !s.blocks.is_empty()
    });

    if !has_en_abstract {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_POSGRADO_NO_ABSTRACT_EN".to_string(),
            message: "Las tesis de posgrado generalmente requieren un abstract en inglés.".to_string(),
            suggestion: Some("Activa y completa la sección 'Abstract' en el árbol de secciones.".to_string()),
            section_id: None,
        });
    }
}
