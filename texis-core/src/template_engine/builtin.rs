use super::model::{
    GeneratorKind, ProjectMetadataTemplate, ProjectTemplate, TemplateBuildConfig, TemplateContent,
    TemplateFile,
};
use crate::texis_project::model::DocumentTypeHint;
use std::path::PathBuf;

/// Retorna todas las plantillas integradas en la app.
pub fn builtin_templates() -> Vec<ProjectTemplate> {
    vec![
        template_thesis_es(),
        template_thesis_en(),
        template_article(),
        template_book(),
        template_technical_manual(),
        template_report(),
        template_cv(),
    ]
}

pub fn find_builtin(id: &str) -> Option<ProjectTemplate> {
    builtin_templates().into_iter().find(|t| t.id == id)
}

// ── Plantilla: Tesis (Español) ────────────────────────────────────────────────

fn template_thesis_es() -> ProjectTemplate {
    ProjectTemplate {
        id: "thesis_es".to_string(),
        name: "Tesis (Español)".to_string(),
        description: "Documento de tesis académica en español. Incluye portada, resumen, \
                      capítulos, bibliografía, glosario y apéndices."
            .to_string(),
        version: "1.0.0".to_string(),
        document_type: DocumentTypeHint::Thesis,
        compatible_profiles: vec![
            "mx_unam_apa7".to_string(),
            "mx_ipn_ieee".to_string(),
            "generic_thesis".to_string(),
        ],
        required_files: vec![
            managed(PathBuf::from("main.tex"), GeneratorKind::MainTex),
            managed(PathBuf::from("preamble.tex"), GeneratorKind::PreambleTex),
            managed(PathBuf::from("metadata.tex"), GeneratorKind::MetadataTex),
            placeholder(
                PathBuf::from("front/portada.tex"),
                "Portada del documento. Personaliza con los datos de tu institución.",
            ),
            placeholder(
                PathBuf::from("front/dedicatoria.tex"),
                "Dedicatoria (opcional).",
            ),
            placeholder(
                PathBuf::from("front/agradecimientos.tex"),
                "Agradecimientos.",
            ),
            placeholder(
                PathBuf::from("front/resumen.tex"),
                "Resumen en español (máx. 250 palabras).",
            ),
            placeholder(
                PathBuf::from("front/abstract.tex"),
                "Abstract in English (max. 250 words).",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-01-introduccion.tex"),
                "Capítulo 1: Introducción.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-02-marco-teorico.tex"),
                "Capítulo 2: Marco teórico.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-03-metodologia.tex"),
                "Capítulo 3: Metodología.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-04-resultados.tex"),
                "Capítulo 4: Resultados.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-05-conclusiones.tex"),
                "Capítulo 5: Conclusiones.",
            ),
            placeholder(
                PathBuf::from("back/apendice-a.tex"),
                "Apéndice A (opcional).",
            ),
            managed(
                PathBuf::from("bibliography/references.bib"),
                GeneratorKind::BibFile,
            ),
            managed(
                PathBuf::from("glossary/glossary.tex"),
                GeneratorKind::GlossaryFile,
            ),
            static_file(PathBuf::from("assets/images/.gitkeep"), "", false),
        ],
        default_metadata: ProjectMetadataTemplate {
            title_placeholder: "Título de la tesis".to_string(),
            suggested_language: "es".to_string(),
            required_metadata_fields: vec![
                "title".to_string(),
                "authors".to_string(),
                "institution".to_string(),
            ],
        },
        default_build_config: TemplateBuildConfig {
            engine: "xelatex".to_string(),
            bibliography_tool: "biber".to_string(),
            output_dir: "build".to_string(),
        },
        default_packages: vec![
            "fontspec".to_string(),
            "polyglossia".to_string(),
            "biblatex".to_string(),
            "csquotes".to_string(),
            "graphicx".to_string(),
            "booktabs".to_string(),
            "hyperref".to_string(),
            "cleveref".to_string(),
            "glossaries".to_string(),
        ],
    }
}

// ── Plantilla: Thesis (English) ───────────────────────────────────────────────

fn template_thesis_en() -> ProjectTemplate {
    ProjectTemplate {
        id: "thesis_en".to_string(),
        name: "Thesis (English)".to_string(),
        description: "Academic thesis document in English.".to_string(),
        version: "1.0.0".to_string(),
        document_type: DocumentTypeHint::Thesis,
        compatible_profiles: vec!["generic_thesis".to_string()],
        required_files: vec![
            managed(PathBuf::from("main.tex"), GeneratorKind::MainTex),
            managed(PathBuf::from("preamble.tex"), GeneratorKind::PreambleTex),
            managed(PathBuf::from("metadata.tex"), GeneratorKind::MetadataTex),
            placeholder(
                PathBuf::from("front/abstract.tex"),
                "Abstract (max. 300 words).",
            ),
            placeholder(
                PathBuf::from("front/acknowledgments.tex"),
                "Acknowledgments.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-01-introduction.tex"),
                "Chapter 1: Introduction.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-02-background.tex"),
                "Chapter 2: Background.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-03-methodology.tex"),
                "Chapter 3: Methodology.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-04-results.tex"),
                "Chapter 4: Results.",
            ),
            placeholder(
                PathBuf::from("chapters/chapter-05-conclusion.tex"),
                "Chapter 5: Conclusion.",
            ),
            managed(
                PathBuf::from("bibliography/references.bib"),
                GeneratorKind::BibFile,
            ),
        ],
        default_metadata: ProjectMetadataTemplate {
            title_placeholder: "Thesis Title".to_string(),
            suggested_language: "en".to_string(),
            required_metadata_fields: vec!["title".to_string(), "authors".to_string()],
        },
        default_build_config: TemplateBuildConfig::default(),
        default_packages: vec![
            "fontspec".to_string(),
            "biblatex".to_string(),
            "graphicx".to_string(),
            "booktabs".to_string(),
            "hyperref".to_string(),
            "cleveref".to_string(),
        ],
    }
}

// ── Plantilla: Artículo académico ─────────────────────────────────────────────

fn template_article() -> ProjectTemplate {
    ProjectTemplate {
        id: "article_academic".to_string(),
        name: "Artículo académico".to_string(),
        description: "Artículo para revista científica. Abstract, introducción, metodología, \
                      resultados, discusión y referencias."
            .to_string(),
        version: "1.0.0".to_string(),
        document_type: DocumentTypeHint::Article,
        compatible_profiles: vec!["generic_article".to_string()],
        required_files: vec![
            managed(PathBuf::from("main.tex"), GeneratorKind::MainTex),
            managed(PathBuf::from("preamble.tex"), GeneratorKind::PreambleTex),
            placeholder(
                PathBuf::from("sections/abstract.tex"),
                "Abstract / Resumen.",
            ),
            placeholder(PathBuf::from("sections/introduction.tex"), "Introducción."),
            placeholder(PathBuf::from("sections/methodology.tex"), "Metodología."),
            placeholder(PathBuf::from("sections/results.tex"), "Resultados."),
            placeholder(PathBuf::from("sections/discussion.tex"), "Discusión."),
            placeholder(PathBuf::from("sections/conclusion.tex"), "Conclusión."),
            managed(
                PathBuf::from("bibliography/references.bib"),
                GeneratorKind::BibFile,
            ),
        ],
        default_metadata: ProjectMetadataTemplate {
            title_placeholder: "Título del artículo".to_string(),
            suggested_language: "es".to_string(),
            required_metadata_fields: vec!["title".to_string(), "authors".to_string()],
        },
        default_build_config: TemplateBuildConfig::default(),
        default_packages: vec![
            "biblatex".to_string(),
            "graphicx".to_string(),
            "booktabs".to_string(),
            "hyperref".to_string(),
        ],
    }
}

// ── Plantillas adicionales (estructura reducida) ──────────────────────────────

fn template_book() -> ProjectTemplate {
    make_simple(
        "book",
        "Libro / Monografía",
        DocumentTypeHint::Book,
        &[
            "chapters/chapter-01.tex",
            "chapters/chapter-02.tex",
            "chapters/chapter-03.tex",
        ],
        "Capítulo",
    )
}

fn template_technical_manual() -> ProjectTemplate {
    make_simple(
        "technical_manual",
        "Manual técnico",
        DocumentTypeHint::TechnicalManual,
        &[
            "sections/overview.tex",
            "sections/installation.tex",
            "sections/usage.tex",
            "sections/reference.tex",
        ],
        "Sección",
    )
}

fn template_report() -> ProjectTemplate {
    make_simple(
        "professional_report",
        "Reporte profesional",
        DocumentTypeHint::Report,
        &[
            "sections/executive-summary.tex",
            "sections/background.tex",
            "sections/findings.tex",
            "sections/recommendations.tex",
        ],
        "Sección",
    )
}

fn template_cv() -> ProjectTemplate {
    make_simple(
        "cv",
        "Curriculum Vitae",
        DocumentTypeHint::Cv,
        &[
            "sections/education.tex",
            "sections/experience.tex",
            "sections/skills.tex",
            "sections/publications.tex",
        ],
        "Sección del CV",
    )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_simple(
    id: &str,
    name: &str,
    doc_type: DocumentTypeHint,
    sections: &[&str],
    section_hint: &str,
) -> ProjectTemplate {
    let mut files = vec![
        managed(PathBuf::from("main.tex"), GeneratorKind::MainTex),
        managed(PathBuf::from("preamble.tex"), GeneratorKind::PreambleTex),
    ];
    for s in sections {
        let hint = format!(
            "{}: {}.",
            section_hint,
            PathBuf::from(s)
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or(s)
        );
        files.push(placeholder(PathBuf::from(s), &hint));
    }
    files.push(managed(
        PathBuf::from("bibliography/references.bib"),
        GeneratorKind::BibFile,
    ));

    ProjectTemplate {
        id: id.to_string(),
        name: name.to_string(),
        description: format!("Plantilla para {}.", name.to_lowercase()),
        version: "1.0.0".to_string(),
        document_type: doc_type,
        compatible_profiles: vec!["generic".to_string()],
        required_files: files,
        default_metadata: ProjectMetadataTemplate::default(),
        default_build_config: TemplateBuildConfig::default(),
        default_packages: vec![
            "biblatex".to_string(),
            "graphicx".to_string(),
            "hyperref".to_string(),
        ],
    }
}

fn managed(path: PathBuf, generator: GeneratorKind) -> TemplateFile {
    TemplateFile {
        relative_path: path,
        content: TemplateContent::Generated { generator },
        is_app_managed: true,
    }
}

fn placeholder(path: PathBuf, hint: &str) -> TemplateFile {
    TemplateFile {
        relative_path: path,
        content: TemplateContent::Placeholder {
            hint: hint.to_string(),
        },
        is_app_managed: false,
    }
}

fn static_file(path: PathBuf, content: &str, app_managed: bool) -> TemplateFile {
    TemplateFile {
        relative_path: path,
        content: TemplateContent::Static(content.to_string()),
        is_app_managed: app_managed,
    }
}
