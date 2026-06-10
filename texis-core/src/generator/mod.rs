// INVARIANTES — nunca se violan:
// 1. main.tex legible por cualquier persona con LaTeX básico.
// 2. Cada capítulo en archivo separado bajo capitulos/.
// 3. Solo rutas relativas desde build/. Nunca absolutas.
// 4. Labels legibles: fig:nombre, tab:nombre, sec:nombre.
// 5. Compila con: cd build && latexmk -xelatex main.tex
// 6. Sin macros oscuras.
// 7. La clase LaTeX viene del perfil, no está hardcodeada.
// 8. Al crear proyecto: genera .gitignore y README-compilacion.txt.

use crate::error::{CoreError, CoreResult};
use crate::project::model::{FileState, ProjectModel};
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
        copy_bib_to_build(build_dir)?;
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

    /// Genera archivos respetando `FileState::Manual`.
    ///
    /// Los archivos marcados como `Manual` en `model.file_states` no se sobreescriben.
    /// Devuelve un `DriftReport` con qué archivos se generaron y cuáles se preservaron.
    pub fn generate_respecting_manual_edits(
        &self,
        model: &ProjectModel,
        build_dir: &Path,
        lang_config: Option<&Value>,
        title_page_template: Option<&str>,
    ) -> CoreResult<DriftReport> {
        project::create_structure(build_dir)?;

        let mut report = DriftReport::default();

        // Archivos de configuración fijos
        let main_content = main_tex::render_to_string(model, &self.engine, lang_config)?;
        safe_write(
            build_dir,
            "main.tex",
            main_content.as_bytes(),
            model,
            &mut report,
        )?;

        let paquetes = crate::generator::main_tex::render_paquetes_pub(model, lang_config);
        safe_write(
            build_dir,
            "configuracion/paquetes.tex",
            paquetes.as_bytes(),
            model,
            &mut report,
        )?;

        // Secciones
        sections::generate_all_respecting_manual(
            model,
            build_dir,
            &self.engine,
            title_page_template,
            &mut report,
        )?;

        // Glosario
        let glossary = glossary_tex::render_to_string(model);
        safe_write(
            build_dir,
            "configuracion/glossary.tex",
            glossary.as_bytes(),
            model,
            &mut report,
        )?;

        copy_bib_to_build(build_dir)?;

        Ok(report)
    }
}

/// Copia references.bib desde content/bibliography/ al build_dir para que
/// \addbibresource{references.bib} funcione sin rutas relativas con '..'.
/// Tectonic no admite rutas con '../' en \addbibresource.
fn copy_bib_to_build(build_dir: &Path) -> CoreResult<()> {
    if let Some(project_root) = build_dir.parent() {
        let src = project_root.join("content/bibliography/references.bib");
        if src.exists() {
            let dst = build_dir.join("references.bib");
            std::fs::copy(&src, &dst).map_err(CoreError::Io)?;
        }
    }
    Ok(())
}

/// Escribe `content` en `build_dir/rel_path` salvo que el archivo esté marcado como Manual.
fn safe_write(
    build_dir: &Path,
    rel_path: &str,
    content: &[u8],
    model: &ProjectModel,
    report: &mut DriftReport,
) -> CoreResult<()> {
    let is_manual = model
        .file_states
        .get(rel_path)
        .map(|s| matches!(s, FileState::Manual))
        .unwrap_or(false);

    if is_manual {
        report.preserved_manual.push(rel_path.to_string());
        return Ok(());
    }

    let full_path = build_dir.join(rel_path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(CoreError::Io)?;
    }
    std::fs::write(&full_path, content).map_err(CoreError::Io)?;
    report.generated.push(rel_path.to_string());
    Ok(())
}

/// Resultado del generador cuando respeta ediciones manuales.
#[derive(Debug, Default, Clone)]
pub struct DriftReport {
    /// Archivos generados o actualizados.
    pub generated: Vec<String>,
    /// Archivos preservados sin modificación por tener FileState::Manual.
    pub preserved_manual: Vec<String>,
}

impl DriftReport {
    pub fn has_preserved(&self) -> bool {
        !self.preserved_manual.is_empty()
    }
}

impl Default for LaTeXGenerator {
    fn default() -> Self {
        Self::new().expect("TemplateEngine::new() no debe fallar")
    }
}
