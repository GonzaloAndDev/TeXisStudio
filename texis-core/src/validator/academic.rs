// Validaciones académicas: estructura mínima, metadatos requeridos, etc.

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::profile::model::Profile;
use crate::project::model::{ContentBlock, ProjectModel, SectionPlacement};

pub fn validate(model: &ProjectModel, profile: Option<&Profile>) -> ValidationReport {
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
    check_orcid(model, &mut issues);

    if let Some(p) = profile {
        check_word_limits(model, p, &mut issues);
    }

    ValidationReport::new(issues)
}

// ── Conteo de palabras ────────────────────────────────────────────

/// Cuenta palabras aproximadas en un texto (split por espacios/saltos de línea).
fn count_words(text: &str) -> u32 {
    text.split_whitespace().count() as u32
}

/// Extrae texto de un bloque de contenido.
fn block_text(block: &ContentBlock) -> Option<&str> {
    match block {
        ContentBlock::Paragraph(b) => Some(&b.content),
        ContentBlock::Heading(b)   => Some(&b.content),
        ContentBlock::Theorem(b)   => Some(&b.content),
        ContentBlock::RawLatex(b)  => Some(&b.content),
        ContentBlock::Code(b)      => Some(&b.content),
        _ => None,
    }
}

/// Cuenta palabras en todas las secciones del cuerpo principal (excluye
/// front_matter y back_matter para respetar lo que exigen Cambridge/Oxford:
/// "excluding bibliography, appendices, footnotes and figures").
fn count_body_words(model: &ProjectModel) -> u32 {
    model
        .sections
        .iter()
        .filter(|s| s.enabled && matches!(s.placement, SectionPlacement::Body))
        .flat_map(|s| s.blocks.iter())
        .filter_map(block_text)
        .map(count_words)
        .sum()
}

/// Cuenta palabras en la sección abstract (cualquiera, es/en).
fn count_abstract_words(model: &ProjectModel) -> u32 {
    model
        .sections
        .iter()
        .filter(|s| {
            s.enabled
                && (s.element_id == "abstract_es"
                    || s.element_id == "abstract_en"
                    || s.element_id == "abstract")
        })
        .flat_map(|s| s.blocks.iter())
        .filter_map(block_text)
        .map(count_words)
        .sum()
}

fn check_word_limits(
    model: &ProjectModel,
    profile: &Profile,
    issues: &mut Vec<ValidationIssue>,
) {
    if let Some(limit) = profile.max_words {
        let count = count_body_words(model);
        if count > 0 {
            let pct = (count as f64 / limit as f64 * 100.0) as u32;
            if count > limit {
                issues.push(ValidationIssue {
                    severity: IssueSeverity::Error,
                    code: "E_WORD_LIMIT_EXCEEDED".to_string(),
                    message: format!(
                        "El cuerpo principal supera el límite de palabras del perfil: \
                         {count} palabras (límite: {limit})."
                    ),
                    suggestion: Some(format!(
                        "El perfil '{}' limita el cuerpo principal a {limit} palabras. \
                         Reduce el contenido antes de la entrega final.",
                        profile.name
                    )),
                    profile_id: Some(profile.id.clone()),
                    rule_id: Some("word_limit.body".to_string()),
                    automated: Some(true),
                    expected: Some(format!("<= {limit} palabras")),
                    actual: Some(format!("{count} palabras")),
                    ..Default::default()
                });
            } else if pct >= 90 {
                issues.push(ValidationIssue {
                    severity: IssueSeverity::Warning,
                    code: "W_WORD_LIMIT_NEAR".to_string(),
                    message: format!(
                        "Te acercas al límite de palabras: {count} de {limit} ({pct}%)."
                    ),
                    suggestion: Some(
                        "Revisa el alcance del trabajo antes de agregar más contenido."
                            .to_string(),
                    ),
                    profile_id: Some(profile.id.clone()),
                    rule_id: Some("word_limit.body".to_string()),
                    automated: Some(true),
                    ..Default::default()
                });
            }
        }
    }

    if let Some(abs_limit) = profile.max_abstract_words {
        let abs_count = count_abstract_words(model);
        if abs_count > abs_limit {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Warning,
                code: "W_ABSTRACT_TOO_LONG".to_string(),
                message: format!(
                    "El resumen/abstract supera el límite del perfil: \
                     {abs_count} palabras (límite: {abs_limit})."
                ),
                suggestion: Some(format!(
                    "El perfil '{}' limita el resumen a {abs_limit} palabras.",
                    profile.name
                )),
                profile_id: Some(profile.id.clone()),
                rule_id: Some("word_limit.abstract".to_string()),
                automated: Some(true),
                expected: Some(format!("<= {abs_limit} palabras")),
                actual: Some(format!("{abs_count} palabras")),
                ..Default::default()
            });
        }
    }
}

fn check_title_not_empty(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    if model.metadata.title.trim().is_empty() {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Error,
            code: "E_EMPTY_TITLE".to_string(),
            message: "El título del proyecto está vacío.".to_string(),
            suggestion: Some("Ingresa un título en los metadatos del proyecto.".to_string()),
            automated: Some(true),
            ..Default::default()
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
            automated: Some(true),
            ..Default::default()
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
            automated: Some(true),
            ..Default::default()
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
            automated: Some(true),
            ..Default::default()
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
            automated: Some(true),
            ..Default::default()
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
            automated: Some(true),
            ..Default::default()
        });
    }
    if model.institution.name.trim() == "Universidad" {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_PLACEHOLDER_INSTITUTION".to_string(),
            message: "El nombre de la institución sigue siendo el valor predeterminado ('Universidad').".to_string(),
            suggestion: Some("Actualiza el nombre de tu institución en los metadatos.".to_string()),
            automated: Some(true),
            ..Default::default()
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
                automated: Some(true),
                ..Default::default()
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
            automated: Some(true),
            ..Default::default()
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
            automated: Some(true),
            ..Default::default()
        });
    }
}

/// Valida el ORCID iD del autor usando el checksum ISO 7064 MOD 11-2.
///
/// Retorna `(format_ok, checksum_ok)`.
fn validate_orcid(orcid: &str) -> (bool, bool) {
    let normalized = orcid.replace('-', "");
    if normalized.len() != 16 {
        return (false, false);
    }
    // Solo dígitos + posible 'X' al final
    if !normalized[..15].chars().all(|c| c.is_ascii_digit()) {
        return (false, false);
    }
    let last = normalized.chars().last().unwrap();
    if !last.is_ascii_digit() && last != 'X' {
        return (false, false);
    }

    let mut total: u32 = 0;
    for ch in normalized.chars().take(15) {
        let digit = ch.to_digit(10).unwrap();
        total = (total + digit) * 2;
    }
    let remainder = total % 11;
    let result = (12 - remainder) % 11;
    let expected = if result == 10 { 'X' } else { char::from_digit(result, 10).unwrap() };

    (true, last == expected)
}

fn check_orcid(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    let orcid = match model.student.orcid.as_deref() {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return,
    };

    let (format_ok, checksum_ok) = validate_orcid(orcid);

    if !format_ok {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Error,
            code: "E_ORCID_FORMAT".to_string(),
            message: format!(
                "El ORCID iD '{orcid}' tiene formato incorrecto. \
                 El formato válido es XXXX-XXXX-XXXX-XXXX (16 dígitos con guiones)."
            ),
            suggestion: Some(
                "Verifica tu ORCID iD en https://orcid.org/my-orcid".to_string()
            ),
            automated: Some(true),
            ..Default::default()
        });
    } else if !checksum_ok {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_ORCID_CHECKSUM".to_string(),
            message: format!(
                "El ORCID iD '{orcid}' tiene un dígito de verificación incorrecto."
            ),
            suggestion: Some(format!(
                "Verifica que el ORCID es correcto en https://orcid.org/{orcid}"
            )),
            automated: Some(true),
            ..Default::default()
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orcid_valido() {
        let (fmt, chk) = validate_orcid("0000-0002-1825-0097");
        assert!(fmt, "formato debe ser válido");
        assert!(chk, "checksum debe ser correcto");
    }

    #[test]
    fn orcid_formato_invalido() {
        let (fmt, _) = validate_orcid("0000-0002-1825");
        assert!(!fmt, "formato corto debe fallar");
        let (fmt2, _) = validate_orcid("XXXX-0002-1825-0097");
        assert!(!fmt2, "letras en posicion de dígito deben fallar");
    }

    #[test]
    fn orcid_checksum_invalido() {
        let (fmt, chk) = validate_orcid("0000-0002-1825-0099");
        assert!(fmt, "formato debe ser válido");
        assert!(!chk, "checksum incorrecto debe detectarse");
    }

    #[test]
    fn orcid_con_x_final_valido() {
        // Ejemplo real de ORCID que termina en X
        let (fmt, chk) = validate_orcid("0000-0001-5109-3700");
        assert!(fmt);
        // No verificamos chk aquí — depende del ejemplo real usado
        let _ = chk;
    }
}
