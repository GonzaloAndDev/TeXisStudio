//! Exportador a plataformas externas (Overleaf, TeXstudio, VS Code, local).
//!
//! Produce una carpeta (o ZIP para Overleaf) con todos los fuentes LaTeX
//! listos para abrir en el editor de destino, sin necesidad de compilar.

use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::error::{CoreError, CoreResult};
use crate::generator::LaTeXGenerator;
use crate::project::model::ProjectModel;

// ── Plataformas soportadas ────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ExportTarget {
    /// ZIP para subir a overleaf.com/project → "New Project → Upload Project"
    #[serde(rename = "overleaf")]
    Overleaf,
    /// Carpeta para abrir directamente con TeXstudio (Archivo → Abrir)
    #[serde(rename = "texstudio")]
    TeXstudio,
    /// Carpeta con .vscode/settings.json preconfigurado para LaTeX Workshop
    #[serde(rename = "vscode")]
    VsCode,
    /// Carpeta genérica + .latexmkrc para cualquier distribución local
    #[serde(rename = "local")]
    Local,
}

impl ExportTarget {
    /// URL de documentación/destino útil para el usuario, si aplica.
    pub fn info_url(&self) -> Option<&'static str> {
        match self {
            Self::Overleaf => Some("https://www.overleaf.com/project"),
            Self::TeXstudio => Some("https://www.texstudio.org"),
            Self::VsCode => Some("https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop"),
            Self::Local => None,
        }
    }
}

/// Parámetros de la exportación.
pub struct PlatformExportInput<'a> {
    /// Directorio raíz del proyecto (contiene content/, build/).
    pub project_dir: &'a Path,
    pub model: &'a ProjectModel,
    /// Directorio donde se dejará la carpeta o ZIP exportado.
    pub output_dir: &'a Path,
    pub target: ExportTarget,
}

/// Resultado de la exportación.
pub struct PlatformExportResult {
    /// Ruta completa al artefacto exportado (carpeta o ZIP).
    pub artifact_path: PathBuf,
    /// URL de documentación / destino para el usuario, si aplica.
    pub info_url: Option<&'static str>,
    /// Clave de i18n para la nota post-export ("overleaf_note", "vscode_note", …).
    pub note_key: &'static str,
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

/// Exporta el proyecto al destino indicado.
pub fn export_for_platform(input: &PlatformExportInput<'_>) -> CoreResult<PlatformExportResult> {
    let slug = title_slug(&input.model.metadata.title);
    let suffix = target_suffix(&input.target);
    let dir_name = format!("{slug}{suffix}");

    // Generamos fuentes LaTeX en una carpeta temporal dentro del output_dir
    let export_root = input.output_dir.join(&dir_name);
    if export_root.exists() {
        std::fs::remove_dir_all(&export_root).map_err(CoreError::Io)?;
    }
    std::fs::create_dir_all(&export_root).map_err(CoreError::Io)?;

    // 1. Generar todos los archivos .tex
    let generator = LaTeXGenerator::default();
    generator.generate(input.model, &export_root)?;

    // 2. Copiar figuras
    let figures_src = input.project_dir.join("content").join("figures");
    if figures_src.exists() {
        let figures_dst = export_root.join("content").join("figures");
        copy_dir_all(&figures_src, &figures_dst)?;
    }

    // 3. Copiar bibliografía (.bib)
    let content_src = input.project_dir.join("content");
    if content_src.exists() {
        let content_dst = export_root.join("content");
        std::fs::create_dir_all(&content_dst).map_err(CoreError::Io)?;
        for entry in std::fs::read_dir(&content_src).map_err(CoreError::Io)? {
            let entry = entry.map_err(CoreError::Io)?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("bib") {
                let dst = content_dst.join(entry.file_name());
                std::fs::copy(&path, &dst).map_err(CoreError::Io)?;
            }
        }
    }

    // 4. Extras por plataforma
    match &input.target {
        ExportTarget::Overleaf => {
            write_text(&export_root.join("README.md"), overleaf_readme(input.model))?;
        }
        ExportTarget::TeXstudio => {}
        ExportTarget::VsCode => {
            let vs_dir = export_root.join(".vscode");
            std::fs::create_dir_all(&vs_dir).map_err(CoreError::Io)?;
            let engine = latex_engine_str(input.model);
            write_text(
                &vs_dir.join("settings.json"),
                vscode_settings(engine),
            )?;
            write_text(&export_root.join("README.md"), vscode_readme())?;
        }
        ExportTarget::Local => {
            write_text(&export_root.join(".latexmkrc"), latexmkrc(input.model))?;
            write_text(&export_root.join("README.md"), local_readme(input.model))?;
        }
    }

    // 5. Para Overleaf: comprimir en ZIP
    let artifact_path = if input.target == ExportTarget::Overleaf {
        let zip_path = input.output_dir.join(format!("{slug}_overleaf.zip"));
        zip_directory(&export_root, &zip_path)?;
        std::fs::remove_dir_all(&export_root).map_err(CoreError::Io)?;
        zip_path
    } else {
        export_root
    };

    let note_key = match &input.target {
        ExportTarget::Overleaf => "export_platform.note_overleaf",
        ExportTarget::TeXstudio => "export_platform.note_texstudio",
        ExportTarget::VsCode => "export_platform.note_vscode",
        ExportTarget::Local => "export_platform.note_local",
    };

    Ok(PlatformExportResult {
        artifact_path,
        info_url: input.target.info_url(),
        note_key,
    })
}

// ── Helpers de escritura ──────────────────────────────────────────────────────

fn write_text(path: &Path, content: String) -> CoreResult<()> {
    std::fs::write(path, content).map_err(CoreError::Io)
}

fn copy_dir_all(src: &Path, dst: &Path) -> CoreResult<()> {
    std::fs::create_dir_all(dst).map_err(CoreError::Io)?;
    for entry in WalkDir::new(src).min_depth(1) {
        let entry = entry.map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
        let rel = entry.path().strip_prefix(src).unwrap();
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target).map_err(CoreError::Io)?;
        } else {
            std::fs::copy(entry.path(), &target).map_err(CoreError::Io)?;
        }
    }
    Ok(())
}

fn zip_directory(src: &Path, dst: &Path) -> CoreResult<()> {
    let file = std::fs::File::create(dst).map_err(CoreError::Io)?;
    let writer = BufWriter::new(file);
    let mut zip = ZipWriter::new(writer);
    let opts = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for entry in WalkDir::new(src).min_depth(1) {
        let entry = entry.map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
        let rel = entry
            .path()
            .strip_prefix(src)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");

        if entry.file_type().is_dir() {
            zip.add_directory(&format!("{rel}/"), opts)
                .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
        } else {
            zip.start_file(&rel, opts)
                .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
            let bytes = std::fs::read(entry.path()).map_err(CoreError::Io)?;
            zip.write_all(&bytes).map_err(CoreError::Io)?;
        }
    }
    zip.finish()
        .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
    Ok(())
}

// ── Extras por plataforma ─────────────────────────────────────────────────────

fn latex_engine_str(model: &ProjectModel) -> &'static str {
    use crate::project::model::LatexEngine;
    match model.latex_config.engine {
        LatexEngine::Xelatex => "xelatex",
        LatexEngine::Pdflatex => "pdflatex",
        LatexEngine::Lualatex => "lualatex",
    }
}

fn overleaf_readme(model: &ProjectModel) -> String {
    let title = &model.metadata.title;
    format!(
        "# {title}\n\n\
         Proyecto exportado desde **TeXisStudio**.\n\n\
         ## Cómo importar en Overleaf\n\n\
         1. Accede a <https://www.overleaf.com/project>\n\
         2. Haz clic en **New Project → Upload Project**\n\
         3. Selecciona el archivo ZIP que contiene estos fuentes\n\
         4. El compilador por defecto es **XeLaTeX** (necesario para `fontspec`)\n\
         5. Compila con el botón verde ▶\n\n\
         ## Notas\n\n\
         - El archivo principal es `main.tex`\n\
         - Las figuras están en `content/figures/`\n\
         - La bibliografía está en `content/references.bib`\n\
         - Requiere compilar con **Biber** (ya configurado en Overleaf)\n"
    )
}

fn vscode_readme() -> String {
    "# TeXisStudio Export — VS Code\n\n\
     ## Requisitos\n\n\
     - Extensión: [LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)\n\
     - Distribución LaTeX: TeX Live o MikTeX con XeLaTeX y Biber\n\n\
     ## Uso\n\n\
     1. Abre esta carpeta en VS Code (`File → Open Folder`)\n\
     2. Abre `main.tex`\n\
     3. Presiona `Ctrl+Alt+B` (o el botón ▶ de LaTeX Workshop) para compilar\n\
     4. El PDF se abrirá automáticamente junto al editor\n\n\
     La receta de compilación ya está preconfigurada en `.vscode/settings.json`.\n"
        .to_string()
}

fn local_readme(model: &ProjectModel) -> String {
    let engine = latex_engine_str(model);
    format!(
        "# {}\n\n\
         Proyecto exportado desde **TeXisStudio**.\n\n\
         ## Compilar con latexmk (recomendado)\n\n\
         ```bash\n\
         latexmk\n\
         ```\n\n\
         El archivo `.latexmkrc` ya configura el motor (`{engine}`) y Biber.\n\n\
         ## Compilar manualmente\n\n\
         ```bash\n\
         {engine} main.tex\n\
         biber main\n\
         {engine} main.tex\n\
         {engine} main.tex\n\
         ```\n\n\
         ## Estructura\n\n\
         - `main.tex` — archivo principal\n\
         - `sections/` — capítulos y secciones\n\
         - `content/figures/` — imágenes\n\
         - `content/references.bib` — bibliografía\n",
        model.metadata.title,
    )
}

fn vscode_settings(engine: &str) -> String {
    format!(
        r#"{{
  "latex-workshop.latex.recipes": [
    {{
      "name": "xelatex + biber",
      "tools": ["{engine}", "biber", "{engine}", "{engine}"]
    }}
  ],
  "latex-workshop.latex.tools": [
    {{
      "name": "{engine}",
      "command": "{engine}",
      "args": ["-synctex=1", "-interaction=nonstopmode", "-file-line-error", "%DOC%"]
    }},
    {{
      "name": "biber",
      "command": "biber",
      "args": ["%DOCFILE%"]
    }}
  ],
  "latex-workshop.latex.autoBuild.run": "onFileChange",
  "latex-workshop.view.pdf.viewer": "tab"
}}
"#
    )
}

fn latexmkrc(model: &ProjectModel) -> String {
    let engine = latex_engine_str(model);
    let flag = match engine {
        "xelatex" => "$pdf_mode = 5;",
        "lualatex" => "$pdf_mode = 4;",
        _ => "$pdf_mode = 1;",
    };
    format!(
        "# Generado por TeXisStudio — latexmk config\n\
         {flag}\n\
         $bibtex_use = 2;  # usa biber\n\
         $clean_ext = 'bbl bcf blg run.xml fls fdb_latexmk';\n"
    )
}

// ── Utilidades ────────────────────────────────────────────────────────────────

fn title_slug(title: &str) -> String {
    let slug: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '_' })
        .take(40)
        .collect::<String>();
    let slug = slug.trim_matches('_').to_string();
    if slug.is_empty() { "tesis".to_string() } else { slug }
}

fn target_suffix(target: &ExportTarget) -> &'static str {
    match target {
        ExportTarget::Overleaf => "",   // va al ZIP directamente
        ExportTarget::TeXstudio => "_texstudio",
        ExportTarget::VsCode => "_vscode",
        ExportTarget::Local => "_local",
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_slug_normal() {
        assert_eq!(title_slug("Mi Tesis de Prueba"), "mi_tesis_de_prueba");
    }

    #[test]
    fn title_slug_empty() {
        assert_eq!(title_slug(""), "tesis");
    }

    #[test]
    fn title_slug_special_chars() {
        let s = title_slug("Análisis & Síntesis");
        assert!(!s.contains('&'));
        assert!(!s.contains(' '));
    }

    #[test]
    fn target_suffix_values() {
        assert_eq!(target_suffix(&ExportTarget::TeXstudio), "_texstudio");
        assert_eq!(target_suffix(&ExportTarget::VsCode), "_vscode");
        assert_eq!(target_suffix(&ExportTarget::Local), "_local");
    }

    #[test]
    fn vscode_settings_contains_engine() {
        let s = vscode_settings("xelatex");
        assert!(s.contains("\"xelatex\""));
        assert!(s.contains("biber"));
        assert!(s.contains("latex-workshop"));
    }

    #[test]
    fn latexmkrc_xelatex() {
        let model = make_model(crate::project::model::LatexEngine::Xelatex);
        let rc = latexmkrc(&model);
        assert!(rc.contains("$pdf_mode = 5;"));
        assert!(rc.contains("biber"));
    }

    #[test]
    fn latexmkrc_pdflatex() {
        let model = make_model(crate::project::model::LatexEngine::Pdflatex);
        let rc = latexmkrc(&model);
        assert!(rc.contains("$pdf_mode = 1;"));
    }

    #[test]
    fn overleaf_readme_contains_title_and_steps() {
        let model = make_model(crate::project::model::LatexEngine::Xelatex);
        let r = overleaf_readme(&model);
        assert!(r.contains("Tesis Test"));
        assert!(r.contains("New Project"));
        assert!(r.contains("XeLaTeX"));
    }

    #[test]
    fn overleaf_info_url() {
        assert!(ExportTarget::Overleaf.info_url().is_some());
    }

    #[test]
    fn local_info_url_is_none() {
        assert!(ExportTarget::Local.info_url().is_none());
    }

    fn make_model(engine: crate::project::model::LatexEngine) -> ProjectModel {
        use crate::project::model::*;
        use std::collections::HashMap;
        ProjectModel {
            id: "t1".into(),
            schema_version: "1.0.0".into(),
            created_at: "".into(),
            updated_at: "".into(),
            metadata: ProjectMetadata {
                title: "Tesis Test".into(),
                subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Licenciatura,
                language: "es".into(),
                city: "CDMX".into(),
                year: 2025,
                keywords: vec![],
                funding: None,
            },
            institution: InstitutionData {
                name: "UNAM".into(),
                faculty: None,
                department: None,
                logo_path: None,
                country: "MX".into(),
            },
            student: StudentData {
                full_name: "Autor".into(),
                student_id: None,
                email: None,
                advisor: None,
                co_advisor: None,
                advisors: vec![],
                co_authors: vec![],
                committee: vec![],
                orcid: None,
            },
            profile_id: "test".into(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig {
                    name: "book".into(),
                    options: vec![],
                },
                engine,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".into(),
                packages_required: vec![],
                typography: Default::default(),
                page_layout: None,
                packages_with_options: vec![],
                preamble_config: Default::default(),
            },
            sections: vec![],
            file_states: HashMap::new(),
        }
    }
}
