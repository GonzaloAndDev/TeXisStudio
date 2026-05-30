// INVARIANTES — nunca se violan:
// 1. main.tex legible por cualquier persona con LaTeX básico.
// 2. Cada capítulo en archivo separado bajo capitulos/.
// 3. Solo rutas relativas desde build/. Nunca absolutas.
// 4. Labels legibles: fig:nombre, tab:nombre, sec:nombre.
// 5. Compila con: cd build && latexmk -xelatex main.tex
// 6. Sin macros oscuras.
// 7. La clase LaTeX viene del perfil, no está hardcodeada.
// 8. Al crear proyecto: genera .gitignore y README-compilacion.txt.

use crate::error::CoreResult;
use crate::project::model::ProjectModel;
use crate::template::engine::TemplateEngine;
use serde_json::Value;
use std::path::Path;

pub mod glossary_tex;
pub mod labels;
pub mod main_tex;
pub mod project;
pub mod sections;

pub struct LaTeXGenerator {
    engine: TemplateEngine,
}

impl LaTeXGenerator {
    pub fn new() -> CoreResult<Self> {
        Ok(Self {
            engine: TemplateEngine::new()?,
        })
    }

    /// Genera todos los archivos .tex en build_dir.
    /// build_dir es el directorio build/ del proyecto del usuario.
    pub fn generate(&self, model: &ProjectModel, build_dir: &Path) -> CoreResult<()> {
        self.generate_with_lang(model, build_dir, None)
    }

    /// Como `generate` pero acepta configuración de idioma de la comunidad
    /// (contenido de latex.json del pack instalado).
    pub fn generate_with_lang(
        &self,
        model: &ProjectModel,
        build_dir: &Path,
        lang_config: Option<&Value>,
    ) -> CoreResult<()> {
        self.generate_full(model, build_dir, lang_config, None)
    }

    /// Genera con lang_config Y con template de portada del perfil.
    /// `title_page_template`: plantilla MiniJinja del campo `title_page_template.template`
    /// del perfil activo. Si None usa la portada genérica.
    pub fn generate_with_profile(
        &self,
        model: &ProjectModel,
        build_dir: &Path,
        lang_config: Option<&Value>,
        title_page_template: Option<&str>,
    ) -> CoreResult<()> {
        self.generate_full(model, build_dir, lang_config, title_page_template)
    }

    fn generate_full(
        &self,
        model: &ProjectModel,
        build_dir: &Path,
        lang_config: Option<&Value>,
        title_page_template: Option<&str>,
    ) -> CoreResult<()> {
        project::create_structure(build_dir)?;
        main_tex::generate(model, build_dir, &self.engine, lang_config)?;
        sections::generate_all(model, build_dir, &self.engine, title_page_template)?;
        glossary_tex::generate(model, build_dir)?;
        Ok(())
    }

    /// Solo para tests: retorna main.tex como String sin escribir a disco.
    pub fn generate_main_tex_string(&self, model: &ProjectModel) -> CoreResult<String> {
        main_tex::render_to_string(model, &self.engine, None)
    }

    /// Solo para tests: retorna una sección como String sin escribir a disco.
    pub fn generate_section_string(
        &self,
        model: &ProjectModel,
        section_id: &str,
    ) -> CoreResult<String> {
        sections::render_section_to_string(model, section_id, &self.engine)
    }
}

impl Default for LaTeXGenerator {
    fn default() -> Self {
        Self::new().expect("TemplateEngine::new() no debe fallar")
    }
}
