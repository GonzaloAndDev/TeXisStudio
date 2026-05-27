// Validación estructural basada en perfil (P5A).
//
// Comprueba que el documento tenga las secciones requeridas por el perfil
// institucional activo. Va más allá de la validación académica genérica:
// verifica element_ids específicos que el perfil exige.
//
// Códigos emitidos:
//   E_PROFILE_SECTION_MISSING  — sección requerida por el perfil no encontrada
//   W_PROFILE_SECTION_DISABLED — sección requerida existe pero está desactivada
//   W_PROFILE_SECTION_EMPTY    — sección requerida existe y está activa pero sin contenido
//   W_MISSING_ABSTRACT_EN      — perfil requiere abstract_en y no existe/está vacío
//   W_MISSING_ORIGINALITY_DECL — perfil requiere declaración de originalidad y falta
//   W_SECTION_DRAFT_COMPLETE   — el documento contiene secciones aún en borrador

use super::report::{IssueSeverity, ValidationIssue, ValidationReport};
use crate::profile::model::{Profile, ProfileSectionDef};
use crate::project::model::{ContentBlock, ProjectModel, SectionStatus};

pub fn validate(model: &ProjectModel, profile: &Profile) -> ValidationReport {
    let mut issues = Vec::new();

    check_profile_required_sections(model, profile, &mut issues);
    check_abstract_en(model, profile, &mut issues);
    check_originality_declaration(model, profile, &mut issues);
    check_draft_sections(model, &mut issues);

    ValidationReport::new(issues)
}

// ── Secciones requeridas por el perfil ───────────────────────────────────────

const AUTO_GENERATED_ELEMENTS: &[&str] = &[
    "title_page", "table_of_contents", "list_of_figures",
    "list_of_tables", "list_of_algorithms", "references",
];

fn check_profile_required_sections(
    model: &ProjectModel,
    profile: &Profile,
    issues: &mut Vec<ValidationIssue>,
) {
    for profile_sec in profile.sections.iter().filter(|s| s.required) {
        // Las auto-generadas se saltan — su "contenido" lo produce LaTeX
        if AUTO_GENERATED_ELEMENTS.contains(&profile_sec.element_id.as_str()) {
            continue;
        }

        let found = model.sections.iter().find(|s| s.element_id == profile_sec.element_id);

        match found {
            None => {
                issues.push(ValidationIssue {
                    severity: IssueSeverity::Error,
                    code: "E_PROFILE_SECTION_MISSING".to_string(),
                    message: format!(
                        "El perfil '{}' requiere la sección '{}' pero no existe en el documento.",
                        profile.id, profile_sec.element_id
                    ),
                    suggestion: Some(format!(
                        "Agrega la sección '{}' desde el panel de secciones del editor.",
                        label_for(profile_sec)
                    )),
                    rule_id: Some("profile.required_sections".to_string()),
                    profile_id: Some(profile.id.clone()),
                    automated: Some(true),
                    ..Default::default()
                });
            }
            Some(model_sec) if !model_sec.enabled => {
                issues.push(ValidationIssue {
                    severity: IssueSeverity::Warning,
                    code: "W_PROFILE_SECTION_DISABLED".to_string(),
                    message: format!(
                        "La sección '{}' es requerida por el perfil '{}' pero está desactivada.",
                        label_for(profile_sec), profile.id
                    ),
                    suggestion: Some("Activa la sección en el árbol de secciones del editor.".to_string()),
                    section_id: Some(model_sec.id.clone()),
                    rule_id: Some("profile.required_sections".to_string()),
                    profile_id: Some(profile.id.clone()),
                    automated: Some(true),
                    ..Default::default()
                });
            }
            Some(model_sec) if model_sec.blocks.is_empty() => {
                issues.push(ValidationIssue {
                    severity: IssueSeverity::Warning,
                    code: "W_PROFILE_SECTION_EMPTY".to_string(),
                    message: format!(
                        "La sección '{}' (requerida por el perfil '{}') está vacía.",
                        label_for(profile_sec), profile.id
                    ),
                    suggestion: Some("Agrega contenido en esta sección antes de la entrega final.".to_string()),
                    section_id: Some(model_sec.id.clone()),
                    rule_id: Some("profile.required_sections".to_string()),
                    profile_id: Some(profile.id.clone()),
                    automated: Some(true),
                    ..Default::default()
                });
            }
            _ => {}
        }
    }
}

fn label_for(sec: &ProfileSectionDef) -> &str {
    sec.title.as_deref()
        .or(sec.label.as_deref())
        .unwrap_or(sec.element_id.as_str())
}

// ── Abstract en inglés ────────────────────────────────────────────────────────

fn check_abstract_en(
    model: &ProjectModel,
    profile: &Profile,
    issues: &mut Vec<ValidationIssue>,
) {
    // Solo verificar si el perfil declara abstract_en como sección requerida
    let profile_requires = profile
        .sections
        .iter()
        .any(|s| s.element_id == "abstract_en" && s.required);

    if !profile_requires {
        return;
    }

    let has_content = model.sections.iter().any(|s| {
        s.enabled && s.element_id == "abstract_en" && has_text_content(s)
    });

    if !has_content {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_MISSING_ABSTRACT_EN".to_string(),
            message: format!(
                "El perfil '{}' requiere un abstract en inglés (abstract_en) pero está ausente o vacío.",
                profile.id
            ),
            suggestion: Some(
                "Activa la sección 'Abstract (English)' y redacta el resumen en inglés.".to_string()
            ),
            rule_id: Some("profile.abstract_en".to_string()),
            profile_id: Some(profile.id.clone()),
            automated: Some(true),
            ..Default::default()
        });
    }
}

// ── Declaración de originalidad ───────────────────────────────────────────────

const ORIGINALITY_ELEMENT_IDS: &[&str] = &[
    "declaration_of_originality",
    "originality_statement",
    "integrity_declaration",
    "academic_integrity",
];

fn check_originality_declaration(
    model: &ProjectModel,
    profile: &Profile,
    issues: &mut Vec<ValidationIssue>,
) {
    let profile_requires = profile.sections.iter().any(|s| {
        s.required && ORIGINALITY_ELEMENT_IDS.contains(&s.element_id.as_str())
    });

    if !profile_requires {
        return;
    }

    let has_declaration = model.sections.iter().any(|s| {
        s.enabled && ORIGINALITY_ELEMENT_IDS.contains(&s.element_id.as_str())
    });

    if !has_declaration {
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_MISSING_ORIGINALITY_DECL".to_string(),
            message: format!(
                "El perfil '{}' requiere una declaración de originalidad que no está presente.",
                profile.id
            ),
            suggestion: Some(
                "Agrega la sección de declaración de originalidad/integridad académica requerida por tu institución."
                    .to_string()
            ),
            rule_id: Some("profile.originality_declaration".to_string()),
            profile_id: Some(profile.id.clone()),
            automated: Some(true),
            ..Default::default()
        });
    }
}

// ── Secciones en borrador en documento finalizado ─────────────────────────────

fn check_draft_sections(model: &ProjectModel, issues: &mut Vec<ValidationIssue>) {
    let draft_sections: Vec<_> = model
        .sections
        .iter()
        .filter(|s| s.enabled && !s.blocks.is_empty() && s.status == SectionStatus::Draft)
        .collect();

    if draft_sections.len() > 3 {
        // Solo emitir si hay muchas secciones en borrador — evitar ruido temprano
        issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            code: "W_MANY_DRAFT_SECTIONS".to_string(),
            message: format!(
                "{} secciones del documento están en estado 'Borrador'.",
                draft_sections.len()
            ),
            suggestion: Some(
                "Marca las secciones revisadas como 'En revisión' o 'Aprobado' en el panel de progreso."
                    .to_string()
            ),
            automated: Some(true),
            ..Default::default()
        });
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn has_text_content(section: &crate::project::model::ProjectSection) -> bool {
    section.blocks.iter().any(|b| match b {
        ContentBlock::Paragraph(p) => !p.content.trim().is_empty(),
        ContentBlock::Heading(h)   => !h.content.trim().is_empty(),
        _ => !section.blocks.is_empty(),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::model::{Profile, ProfileDocumentClass, ProfileSectionDef};
    use crate::project::model::{
        AcademicLevel, BibliographyBackend, CompilerKind, ContentBlock,
        DocumentClassConfig, DocumentKind, InstitutionData, LatexConfig, LatexEngine,
        ParagraphBlock, ProjectMetadata, ProjectModel, ProjectSection, SectionPlacement,
        StudentData,
    };
    use std::collections::HashMap;

    fn bare_model(sections: Vec<ProjectSection>) -> ProjectModel {
        ProjectModel {
            id: "test".into(), schema_version: "1.0.0".into(),
            created_at: "".into(), updated_at: "".into(),
            metadata: ProjectMetadata {
                title: "T".into(), subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Maestria,
                language: "es".into(), city: "x".into(), year: 2024,
                keywords: vec![], funding: None,
            },
            institution: InstitutionData {
                name: "U".into(), faculty: None, department: None,
                logo_path: None, country: "MX".into(),
            },
            student: StudentData {
                full_name: "A".into(), student_id: None, email: None,
                advisor: None, co_advisor: None, advisors: vec![], co_authors: vec![],
                committee: vec![], orcid: None,
            },
            profile_id: "test.profile".into(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig { name: "book".into(), options: vec![] },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".into(),
                packages_required: vec![],
                typography: Default::default(),
            },
            sections,
            file_states: HashMap::new(),
        }
    }

    fn profile_with_sections(required_element_ids: &[&str]) -> Profile {
        let mut p = Profile::new_draft(
            "test.profile".into(),
            "Test Profile".into(),
            ProfileDocumentClass { name: "book".into(), options: vec![] },
            "xelatex".into(),
            "biber".into(),
            "apa".into(),
        );
        p.sections = required_element_ids
            .iter()
            .map(|eid| ProfileSectionDef {
                id: eid.to_string(),
                element_id: eid.to_string(),
                required: true,
                title: None, label: None, placement: "body".to_string(),
                guidance: None,
            })
            .collect();
        p
    }

    fn model_section(element_id: &str, enabled: bool, with_content: bool) -> ProjectSection {
        let blocks = if with_content {
            vec![ContentBlock::Paragraph(ParagraphBlock { id: "p".into(), content: "Texto de ejemplo.".into() })]
        } else { vec![] };
        ProjectSection {
            id: element_id.into(), element_id: element_id.into(), title: None,
            placement: SectionPlacement::Body, required: true, enabled,
            label: None, status: Default::default(), notes: None, blocks,
            fields: HashMap::new(), children: vec![],
        }
    }

    #[test]
    fn seccion_requerida_presente_y_con_contenido_ok() {
        let profile = profile_with_sections(&["methodology"]);
        let model = bare_model(vec![model_section("methodology", true, true)]);
        let report = validate(&model, &profile);
        assert!(!report.issues.iter().any(|i| i.code == "E_PROFILE_SECTION_MISSING"));
        assert!(!report.issues.iter().any(|i| i.code == "W_PROFILE_SECTION_EMPTY"));
    }

    #[test]
    fn seccion_requerida_ausente_produce_error() {
        let profile = profile_with_sections(&["methodology"]);
        let model = bare_model(vec![]);
        let report = validate(&model, &profile);
        assert!(report.issues.iter().any(|i| i.code == "E_PROFILE_SECTION_MISSING"),
            "debe emitir error por sección ausente");
    }

    #[test]
    fn seccion_requerida_desactivada_produce_warning() {
        let profile = profile_with_sections(&["methodology"]);
        let model = bare_model(vec![model_section("methodology", false, false)]);
        let report = validate(&model, &profile);
        assert!(report.issues.iter().any(|i| i.code == "W_PROFILE_SECTION_DISABLED"));
    }

    #[test]
    fn seccion_requerida_vacia_produce_warning() {
        let profile = profile_with_sections(&["methodology"]);
        let model = bare_model(vec![model_section("methodology", true, false)]);
        let report = validate(&model, &profile);
        assert!(report.issues.iter().any(|i| i.code == "W_PROFILE_SECTION_EMPTY"));
    }

    #[test]
    fn abstract_en_requerido_pero_ausente() {
        let profile = profile_with_sections(&["abstract_en"]);
        let model = bare_model(vec![]);
        let report = validate(&model, &profile);
        assert!(report.issues.iter().any(|i| i.code == "W_MISSING_ABSTRACT_EN"),
            "debe advertir ausencia de abstract_en");
    }
}
