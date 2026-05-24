// Validaciones académicas: estructura mínima, metadatos requeridos, etc.

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::project::model::ProjectModel;

pub fn validate(model: &ProjectModel) -> ValidationReport {
    let mut issues = Vec::new();

    check_title_not_empty(model, &mut issues);
    check_student_name(model, &mut issues);
    check_institution_name(model, &mut issues);
    check_has_body_sections(model, &mut issues);
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
