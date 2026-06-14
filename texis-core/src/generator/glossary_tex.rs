// Genera build/configuracion/glossary.tex con las entradas de glosario y acrónimos
// declaradas en los bloques del proyecto.
//
// Formato generado:
//   \newglossaryentry{id}{name={Término}, description={Definición}}
//   \newacronym{id}{SIGLA}{Forma larga}
//
// El archivo se incluye desde el preámbulo del main.tex DESPUÉS de \makeglossaries.
// Las referencias \gls{id}, \gls{id}, \acrshort{id} en bloques verbatim funcionan
// porque las entradas están definidas antes de \begin{document}.

use crate::error::{CoreError, CoreResult};
use crate::project::model::{ContentBlock, ProjectModel};
use crate::template::escape::latex_escape;
use std::path::Path;

/// Devuelve true si el modelo contiene al menos un GlossaryEntry o AcronymEntry.
pub fn has_glossary_content(model: &ProjectModel) -> bool {
    model.sections.iter().any(|s| {
        s.blocks.iter().any(|b| {
            matches!(
                b,
                ContentBlock::GlossaryEntry(_) | ContentBlock::AcronymEntry(_)
            )
        })
    })
}

/// Genera el archivo `build/configuracion/glossary.tex`.
/// Solo lo escribe si hay entradas; de lo contrario crea un archivo vacío con comentario.
pub fn generate(model: &ProjectModel, build_dir: &Path) -> CoreResult<()> {
    let content = render_to_string(model);
    let path = build_dir.join("configuracion").join("glossary.tex");
    std::fs::write(&path, &content).map_err(CoreError::Io)
}

/// Renderiza el contenido de glossary.tex como String. Usable en tests sin disco.
pub fn render_to_string(model: &ProjectModel) -> String {
    let mut entries: Vec<String> = Vec::new();
    let mut acronyms: Vec<String> = Vec::new();
    let mut seen_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    for section in &model.sections {
        for block in &section.blocks {
            match block {
                ContentBlock::GlossaryEntry(g) => {
                    let key = sanitize_key(&g.id);
                    if seen_keys.insert(key.clone()) {
                        let name = latex_escape(&g.term);
                        let desc = if g.verbatim {
                            g.definition.clone()
                        } else {
                            latex_escape(&g.definition)
                        };
                        entries.push(format!(
                            "\\newglossaryentry{{{key}}}{{name={{{name}}}, description={{{desc}}}}}"
                        ));
                    }
                }
                ContentBlock::AcronymEntry(a) => {
                    let key = sanitize_key(&a.id);
                    if seen_keys.insert(key.clone()) {
                        let short = latex_escape(&a.acronym);
                        let long = latex_escape(&a.full_form);
                        if let Some(desc) = &a.description {
                            if !desc.trim().is_empty() {
                                let desc_escaped = latex_escape(desc);
                                acronyms.push(format!(
                                    "\\newacronym[description={{{desc_escaped}}}]{{{key}}}{{{short}}}{{{long}}}"
                                ));
                            } else {
                                acronyms
                                    .push(format!("\\newacronym{{{key}}}{{{short}}}{{{long}}}"));
                            }
                        } else {
                            acronyms.push(format!("\\newacronym{{{key}}}{{{short}}}{{{long}}}"));
                        }
                    }
                }
                _ => {}
            }
        }
    }

    if entries.is_empty() && acronyms.is_empty() {
        return "% Sin entradas de glosario o acrónimos en este proyecto.\n".to_string();
    }

    let mut out = String::from("% Glosario y acrónimos — generado automáticamente\n");
    out.push_str("% Referenciar con \\gls{key}, \\Gls{key}, \\acrshort{key}, \\acrlong{key}\n\n");

    if !entries.is_empty() {
        out.push_str("% ── Términos ─────────────────────────────────────────────\n");
        for e in &entries {
            out.push_str(e);
            out.push('\n');
        }
        out.push('\n');
    }

    if !acronyms.is_empty() {
        out.push_str("% ── Acrónimos ────────────────────────────────────────────\n");
        for a in &acronyms {
            out.push_str(a);
            out.push('\n');
        }
        out.push('\n');
    }

    out
}

/// Convierte un id de bloque a una clave LaTeX válida para el paquete glossaries.
/// Permite letras, números y guiones. Reemplaza espacios y caracteres no válidos por '-'.
fn sanitize_key(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == ':' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_model_with_glossary() -> ProjectModel {
        use crate::project::model::*;
        ProjectModel {
            id: "test".to_string(),
            schema_version: "1.0".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            metadata: ProjectMetadata {
                title: "Test".to_string(),
                subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Maestria,
                language: "es".to_string(),
                city: "CDMX".to_string(),
                year: 2026,
                keywords: vec![],
                funding: None,
            },
            institution: InstitutionData {
                name: "UNAM".to_string(),
                faculty: None,
                department: None,
                logo_path: None,
                country: "MX".to_string(),
            },
            student: StudentData {
                full_name: "Ana García".to_string(),
                student_id: None,
                email: None,
                advisor: None,
                advisors: vec![],
                co_authors: vec![],
                co_advisor: None,
                committee: vec![],
                orcid: None,
            },
            profile_id: "mx_unam_apa7".to_string(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig {
                    name: "book".to_string(),
                    options: vec!["12pt".to_string()],
                },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".to_string(),
                packages_required: vec![],
                packages_with_options: vec![],
                typography: LatexTypography::default(),
                page_layout: None,
                preamble_config: PreambleConfig::default(),
            },
            sections: vec![ProjectSection {
                id: "glosario".to_string(),
                element_id: "glossary_section".to_string(),
                title: Some("Glosario".to_string()),
                label: None,
                placement: SectionPlacement::BackMatter,
                required: false,
                enabled: true,
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![
                    ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                        id: "ontologia".to_string(),
                        term: "Ontología".to_string(),
                        definition: "Rama de la filosofía que estudia el ser.".to_string(),
                        verbatim: false,
                    }),
                    ContentBlock::AcronymEntry(AcronymEntryBlock {
                        id: "api".to_string(),
                        acronym: "API".to_string(),
                        full_form: "Application Programming Interface".to_string(),
                        description: None,
                    }),
                ],
                fields: Default::default(),
                children: vec![],
            }],
            file_states: Default::default(),
        }
    }

    #[test]
    fn genera_newglossaryentry_para_terminos() {
        let model = make_model_with_glossary();
        let out = render_to_string(&model);
        assert!(out.contains("\\newglossaryentry{ontologia}"));
        assert!(out.contains("name={Ontolog"));
        assert!(out.contains("description={Rama de la filosof"));
    }

    #[test]
    fn genera_newacronym_para_acronimos() {
        let model = make_model_with_glossary();
        let out = render_to_string(&model);
        assert!(out.contains("\\newacronym{api}{API}{Application Programming Interface}"));
    }

    #[test]
    fn has_glossary_content_true_con_entradas() {
        let model = make_model_with_glossary();
        assert!(has_glossary_content(&model));
    }

    #[test]
    fn sanitize_key_reemplaza_espacios() {
        assert_eq!(sanitize_key("mi termino"), "mi-termino");
        assert_eq!(sanitize_key("API v2"), "API-v2");
        assert_eq!(sanitize_key("sec:intro"), "sec:intro");
    }

    #[test]
    fn sin_entradas_genera_comentario() {
        let mut model = make_model_with_glossary();
        model.sections[0].blocks.clear();
        let out = render_to_string(&model);
        assert!(out.starts_with('%'));
        assert!(!out.contains("\\newglossaryentry"));
    }
}
