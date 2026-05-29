use super::model::{GeneratorKind, ProjectTemplate, TemplateContent};
use crate::error::{CoreError, CoreResult};
use crate::texis_project::model::{
    BibliographyTool, BuildConfig, GlossaryTool, LatexEngine, ProjectMetadata, TexisProject,
};
use crate::texis_project::persistence::ProjectPersistence;
use std::path::{Path, PathBuf};

pub struct TemplateEngine;

impl TemplateEngine {
    /// Instancia una plantilla en `destination`.
    /// Crea la estructura de carpetas, genera los archivos y devuelve un TexisProject listo.
    pub fn instantiate(
        template: &ProjectTemplate,
        destination: &Path,
        metadata: &ProjectMetadata,
    ) -> CoreResult<TexisProject> {
        std::fs::create_dir_all(destination).map_err(CoreError::Io)?;

        // 1. Crear archivos de la plantilla
        for file in &template.required_files {
            let dest_path = destination.join(&file.relative_path);
            if let Some(parent) = dest_path.parent() {
                std::fs::create_dir_all(parent).map_err(CoreError::Io)?;
            }

            let content = match &file.content {
                TemplateContent::Static(s) => s.clone(),
                TemplateContent::Placeholder { hint } => {
                    format!("% {}\n% Escribe aquí el contenido de esta sección.\n", hint)
                }
                TemplateContent::Generated { generator } => {
                    generate_content(generator, template, metadata, destination)
                }
            };

            std::fs::write(&dest_path, content).map_err(CoreError::Io)?;
        }

        // 2. Inicializar .texisstudio/
        let persistence = ProjectPersistence::from_project_root(destination);
        persistence.init_dirs()?;

        // 3. Crear .gitignore si no existe
        let gitignore = destination.join(".gitignore");
        if !gitignore.exists() {
            std::fs::write(&gitignore, ProjectPersistence::recommended_gitignore())
                .map_err(CoreError::Io)?;
        }

        // 4. Construir TexisProject
        let build_config = build_config_from_template(template);
        let mut project = TexisProject::new(destination.to_path_buf(), PathBuf::from("main.tex"));
        project.metadata = metadata.clone();
        project.build_config = build_config;
        project.profile =
            template
                .compatible_profiles
                .first()
                .map(|id| crate::events::DocumentProfileRef {
                    id: id.clone(),
                    version: None,
                });

        // 5. Persistir configuración inicial
        let config = crate::texis_project::model::ProjectConfig::from_project(&project);
        persistence.save_config(&config)?;

        Ok(project)
    }

    /// Retorna las plantillas disponibles (builtin + futuras de plugins).
    pub fn available_templates() -> Vec<ProjectTemplate> {
        super::builtin::builtin_templates()
    }

    pub fn find_template(id: &str) -> Option<ProjectTemplate> {
        super::builtin::find_builtin(id)
    }
}

// ── Generadores de contenido ──────────────────────────────────────────────────

fn generate_content(
    generator: &GeneratorKind,
    template: &ProjectTemplate,
    metadata: &ProjectMetadata,
    _root: &Path,
) -> String {
    match generator {
        GeneratorKind::MainTex => generate_main_tex(template, metadata),
        GeneratorKind::PreambleTex => generate_preamble_tex(template, metadata),
        GeneratorKind::MetadataTex => generate_metadata_tex(metadata),
        GeneratorKind::BibFile => String::new(), // .bib vacío
        GeneratorKind::GlossaryFile => {
            "% Definiciones de glosario\n% AUTO-GENERATED BEGIN\n% AUTO-GENERATED END\n".to_string()
        }
    }
}

fn generate_main_tex(template: &ProjectTemplate, _metadata: &ProjectMetadata) -> String {
    use crate::texis_project::model::DocumentTypeHint;

    let doc_class = match &template.document_type {
        DocumentTypeHint::Thesis | DocumentTypeHint::Book => "book",
        DocumentTypeHint::Article => "article",
        DocumentTypeHint::Cv => "article",
        _ => "report",
    };

    // Detectar qué archivos de capítulos/secciones tiene la plantilla
    let chapter_inputs: Vec<String> = template
        .required_files
        .iter()
        .filter(|f| {
            let p = f.relative_path.to_string_lossy();
            p.starts_with("chapters/") || p.starts_with("sections/")
        })
        .map(|f| {
            format!(
                "\\input{{{}}}",
                f.relative_path.with_extension("").display()
            )
        })
        .collect();

    let has_front = template
        .required_files
        .iter()
        .any(|f| f.relative_path.to_string_lossy().starts_with("front/"));

    let has_bib = template
        .required_files
        .iter()
        .any(|f| f.relative_path.to_string_lossy().contains("references.bib"));

    let has_glossary = template
        .required_files
        .iter()
        .any(|f| f.relative_path.to_string_lossy().contains("glossary"));

    let has_appendix = template.required_files.iter().any(|f| {
        let p = f.relative_path.to_string_lossy();
        p.contains("apendice") || p.contains("appendix") || p.starts_with("back/")
    });

    let mut out = format!(
        "%% main.tex — generado por TeXisStudio\n\\documentclass[12pt,a4paper]{{{}}}

\\input{{preamble}}
\\input{{metadata}}

\\begin{{document}}
",
        doc_class
    );

    if matches!(
        template.document_type,
        DocumentTypeHint::Thesis | DocumentTypeHint::Book
    ) {
        out.push_str("\n%% Front matter\n\\frontmatter\n");
        if has_front {
            for f in template
                .required_files
                .iter()
                .filter(|f| f.relative_path.to_string_lossy().starts_with("front/"))
            {
                out.push_str(&format!(
                    "\\input{{{}}}\n",
                    f.relative_path.with_extension("").display()
                ));
            }
        }
        out.push_str("\\tableofcontents\n\\listoffigures\n\\listoftables\n");
        out.push_str("\n%% Main matter\n\\mainmatter\n");
    }

    for input in &chapter_inputs {
        out.push_str(&format!("{}\n", input));
    }

    if has_appendix || has_glossary || has_bib {
        out.push_str("\n%% Back matter\n");
        if matches!(
            template.document_type,
            DocumentTypeHint::Thesis | DocumentTypeHint::Book
        ) {
            out.push_str("\\backmatter\n");
        }
    }

    if has_bib {
        out.push_str("\\printbibliography[heading=bibintoc]\n");
    }

    if has_appendix {
        out.push_str("\\appendix\n");
        for f in template.required_files.iter().filter(|f| {
            let p = f.relative_path.to_string_lossy();
            p.contains("apendice") || p.contains("appendix") || p.starts_with("back/")
        }) {
            out.push_str(&format!(
                "\\input{{{}}}\n",
                f.relative_path.with_extension("").display()
            ));
        }
    }

    if has_glossary {
        out.push_str("\\printglossary[title=Glosario]\n");
        out.push_str("\\printglossary[type=\\acronymtype,title=Acrónimos]\n");
    }

    out.push_str("\n\\end{document}\n");
    out
}

fn generate_preamble_tex(template: &ProjectTemplate, metadata: &ProjectMetadata) -> String {
    let mut out = "%% preamble.tex — generado por TeXisStudio\n".to_string();
    out.push_str("%% Añade tus propios paquetes después de esta sección.\n\n");

    // Paquetes de la plantilla
    for pkg in &template.default_packages {
        if pkg == "biblatex" {
            out.push_str(
                "\\usepackage[backend=biber,style=apa]{biblatex}\n\
                 \\addbibresource{bibliography/references.bib}\n",
            );
        } else if pkg == "polyglossia" {
            let lang = if metadata.language == "es" {
                "spanish"
            } else {
                &metadata.language
            };
            out.push_str(&format!(
                "\\usepackage{{polyglossia}}\n\\setmainlanguage{{{}}}\n",
                lang
            ));
        } else if pkg == "glossaries" {
            out.push_str("\\usepackage[acronym,symbols]{glossaries}\n");
            out.push_str("\\input{glossary/glossary}\n");
            out.push_str("\\makeglossaries\n");
        } else {
            out.push_str(&format!("\\usepackage{{{}}}\n", pkg));
        }
    }

    out.push_str("\n%% Configuración de hyperref — siempre al final\n");
    if !template.default_packages.iter().any(|p| p == "hyperref") {
        out.push_str("\\usepackage[hidelinks]{hyperref}\n");
    }
    if !template.default_packages.iter().any(|p| p == "cleveref") {
        out.push_str("\\usepackage{cleveref}\n");
    }

    out
}

fn generate_metadata_tex(metadata: &ProjectMetadata) -> String {
    let authors = metadata
        .authors
        .iter()
        .map(|a| a.name.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    format!(
        "%% metadata.tex — generado por TeXisStudio\n\
         \\title{{{}}}\n\
         \\author{{{}}}\n\
         \\date{{\\today}}\n",
        metadata.title.replace('{', "\\{").replace('}', "\\}"),
        if authors.is_empty() {
            "Autor".to_string()
        } else {
            authors
        }
    )
}

fn build_config_from_template(template: &ProjectTemplate) -> BuildConfig {
    let engine = match template.default_build_config.engine.as_str() {
        "pdflatex" => LatexEngine::PdfLatex,
        "lualatex" => LatexEngine::LuaLatex,
        _ => LatexEngine::XeLatex,
    };
    let bib_tool = match template.default_build_config.bibliography_tool.as_str() {
        "bibtex" => BibliographyTool::BibTeX,
        "none" => BibliographyTool::None,
        _ => BibliographyTool::Biber,
    };
    let glossary_tool = if template.default_packages.iter().any(|p| p == "glossaries") {
        Some(GlossaryTool::MakeGlossaries)
    } else {
        None
    };

    BuildConfig {
        engine,
        bibliography_tool: bib_tool,
        glossary_tool,
        output_dir: PathBuf::from(&template.default_build_config.output_dir),
        ..BuildConfig::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::template_engine::builtin::find_builtin;
    use crate::texis_project::model::ProjectAuthor;
    use tempfile::TempDir;

    fn test_metadata() -> ProjectMetadata {
        ProjectMetadata {
            title: "Mi Tesis de Prueba".to_string(),
            language: "es".to_string(),
            authors: vec![ProjectAuthor {
                name: "Ana García".to_string(),
                email: None,
                orcid: None,
                affiliation: None,
            }],
            ..Default::default()
        }
    }

    #[test]
    fn instantiate_thesis_es_creates_files() {
        let dir = tempfile::tempdir().unwrap();
        let template = find_builtin("thesis_es").unwrap();
        let metadata = test_metadata();
        let project = TemplateEngine::instantiate(&template, dir.path(), &metadata).unwrap();

        assert!(dir.path().join("main.tex").exists());
        assert!(dir.path().join("preamble.tex").exists());
        assert!(dir.path().join("metadata.tex").exists());
        assert!(dir.path().join(".gitignore").exists());
        assert!(dir.path().join(".texisstudio/project.json").exists());
        assert!(dir.path().join("bibliography/references.bib").exists());
    }

    #[test]
    fn main_tex_contains_title() {
        let dir = tempfile::tempdir().unwrap();
        let template = find_builtin("thesis_es").unwrap();
        let metadata = test_metadata();
        TemplateEngine::instantiate(&template, dir.path(), &metadata).unwrap();

        let main = std::fs::read_to_string(dir.path().join("main.tex")).unwrap();
        assert!(main.contains("\\documentclass"));
        assert!(main.contains("\\input{preamble}"));
        assert!(main.contains("\\printbibliography"));
    }

    #[test]
    fn metadata_tex_contains_title_and_author() {
        let dir = tempfile::tempdir().unwrap();
        let template = find_builtin("thesis_es").unwrap();
        let metadata = test_metadata();
        TemplateEngine::instantiate(&template, dir.path(), &metadata).unwrap();

        let meta_content = std::fs::read_to_string(dir.path().join("metadata.tex")).unwrap();
        assert!(meta_content.contains("Mi Tesis de Prueba"));
        assert!(meta_content.contains("Ana García"));
    }

    #[test]
    fn placeholder_files_have_hint_comment() {
        let dir = tempfile::tempdir().unwrap();
        let template = find_builtin("thesis_es").unwrap();
        let metadata = test_metadata();
        TemplateEngine::instantiate(&template, dir.path(), &metadata).unwrap();

        let resumen = std::fs::read_to_string(dir.path().join("front/resumen.tex")).unwrap();
        assert!(resumen.starts_with('%'));
    }

    #[test]
    fn build_config_shell_escape_false() {
        let template = find_builtin("thesis_es").unwrap();
        let cfg = build_config_from_template(&template);
        assert!(!cfg.shell_escape);
    }

    #[test]
    fn all_builtin_templates_have_main_tex() {
        for t in super::super::builtin::builtin_templates() {
            let has_main = t
                .required_files
                .iter()
                .any(|f| f.relative_path == PathBuf::from("main.tex"));
            assert!(has_main, "Plantilla '{}' no tiene main.tex", t.id);
        }
    }

    #[test]
    fn available_templates_returns_seven() {
        let templates = TemplateEngine::available_templates();
        assert!(
            templates.len() >= 5,
            "Debe haber al menos 5 plantillas builtin"
        );
    }
}
