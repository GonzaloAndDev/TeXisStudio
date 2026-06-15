//! Importador de proyectos LaTeX desde carpeta externa.
//!
//! Flujo:
//!   1. Consolida todos los .tex de `source_dir` en un único string.
//!   2. Ejecuta `import_tex` (parseo estructural).
//!   3. Aplica mapeo de entornos LaTeX → bloques del modelo (figura, código, etc.)
//!   4. Crea el scaffold de carpetas en `work_dir`.
//!   5. Copia figuras y .bib al directorio `work_dir/content/`.
//!   6. Guarda `tesis.project.yaml` en `work_dir`.
//!
//! Política de mapeo:
//!   - `\begin{figure}` con `\includegraphics` + `\caption` + `\label` → FigureBlock
//!   - `\begin{lstlisting}` / `\begin{verbatim}` / `\begin{minted}` → CodeBlock
//!   - `\begin{tikzpicture}`, `\begin{circuitikz}`, `\ce{`, etc. → RawLatexBlock
//!     con aviso de compatibilidad con plugin visual
//!   - Todo lo demás → RawLatexBlock(user_confirmed: true)

use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};
use crate::importer::consolidator::consolidate_directory;
use crate::importer::import_tex;
use crate::project::model::{
    CodeBlock, ContentBlock, FigureBlock, FigureWidth, LatexEngine, RawLatexBlock,
};
use crate::project::saver::ProjectSaver;

// ── Plataforma de origen ──────────────────────────────────────────────────────

/// Plataforma/editor desde donde proviene el proyecto LaTeX.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ImportSourcePlatform {
    Overleaf,
    #[serde(rename = "texstudio")]
    TeXstudio,
    MikTeX,
    TexLive,
    VsCode,
    #[default]
    Other,
}

// ── Opciones de importación ───────────────────────────────────────────────────

/// Parámetros configurables para la importación desde carpeta.
#[derive(Debug, Clone)]
pub struct ImportOptions {
    /// Plataforma/editor de origen (afecta heurísticas menores).
    pub source_platform: ImportSourcePlatform,
    /// Nombre del archivo raíz si el usuario lo conoce (e.g. "main.tex").
    pub main_file_hint: Option<String>,
    /// Sobrescribir `work_dir` si ya tiene contenido.
    pub overwrite: bool,
}

impl Default for ImportOptions {
    fn default() -> Self {
        Self {
            source_platform: ImportSourcePlatform::Other,
            main_file_hint: None,
            overwrite: false,
        }
    }
}

// ── Resultado ─────────────────────────────────────────────────────────────────

pub struct FolderImportResult {
    /// Ruta al `tesis.project.yaml` creado en `work_dir`.
    pub project_file: PathBuf,
    /// Avisos acumulados durante todo el proceso.
    pub warnings: Vec<String>,
    /// Figuras copiadas a `work_dir/content/figures/`.
    pub figures_copied: usize,
    /// Archivos .bib copiados a `work_dir/content/`.
    pub bibs_copied: usize,
}

// ── API principal ─────────────────────────────────────────────────────────────

/// Importa un proyecto LaTeX externo creando la estructura de trabajo TeXisStudio.
///
/// - `source_dir`: carpeta con los .tex originales (subcarpetas permitidas).
/// - `work_dir`: destino donde se creará la estructura TeXisStudio.
///   Debe ser diferente de `source_dir`.
pub fn import_from_folder(
    source_dir: &Path,
    work_dir: &Path,
    options: &ImportOptions,
) -> CoreResult<FolderImportResult> {
    if !source_dir.exists() {
        return Err(CoreError::FileNotFound {
            path: source_dir.to_string_lossy().to_string(),
        });
    }

    // Comparación canónica: evita que "/a/b" y "/a/b/" o "/a/./b" sean distintos.
    let canon_src = source_dir
        .canonicalize()
        .unwrap_or_else(|_| source_dir.to_path_buf());
    let canon_dst = work_dir
        .canonicalize()
        .unwrap_or_else(|_| work_dir.to_path_buf());
    if canon_src == canon_dst {
        return Err(CoreError::InvalidProject {
            message: "source_dir y work_dir no pueden ser el mismo directorio".to_string(),
        });
    }
    // Evitar que work_dir sea una subcarpeta de source_dir (importaría sobre sí mismo)
    if canon_dst.starts_with(&canon_src) {
        return Err(CoreError::InvalidProject {
            message: format!(
                "El directorio de trabajo '{}' es una subcarpeta del origen '{}'. \
                 Usa una ruta completamente diferente.",
                work_dir.display(),
                source_dir.display()
            ),
        });
    }

    if work_dir.exists() && !options.overwrite {
        // unwrap_or(true): si no podemos leer el dir (permisos), asumimos no vacío → seguro
        if std::fs::read_dir(work_dir)
            .map(|mut d| d.next().is_some())
            .unwrap_or(true)
        {
            return Err(CoreError::InvalidProject {
                message: format!(
                    "El directorio de trabajo '{}' ya existe y no está vacío. \
                     Activa la opción de sobreescritura para continuar.",
                    work_dir.display()
                ),
            });
        }
    }

    let mut warnings = Vec::new();

    // 1. Consolidar multi-archivo → un único .tex
    let consolidated = consolidate_directory(source_dir)?;
    warnings.extend(consolidated.warnings);

    // 2. Parseo estructural
    let import_result = import_tex(&consolidated.tex);
    warnings.extend(import_result.warnings);

    // 3. Remapear bloques (figura, código, entornos visuales)
    let mut model = import_result.model;
    let mut env_warnings: Vec<String> = Vec::new();
    for section in &mut model.sections {
        let new_blocks = remap_blocks(std::mem::take(&mut section.blocks), &mut env_warnings);
        section.blocks = new_blocks;
    }
    warnings.extend(env_warnings);

    // 4. Ajustes heurísticos por plataforma de origen
    apply_platform_hints(&mut model, &options.source_platform);

    // 5. Crear scaffold de directorios
    create_scaffold(work_dir)?;

    // 6. Copiar assets
    let (figures_copied, bibs_copied) = copy_assets(
        &consolidated.figure_paths,
        &consolidated.bib_paths,
        work_dir,
        &mut warnings,
    )?;

    // 7. Guardar project YAML
    let project_file = work_dir.join("tesis.project.yaml");
    let saver = ProjectSaver;
    saver.save_to_file(&model, &project_file)?;

    Ok(FolderImportResult {
        project_file,
        warnings,
        figures_copied,
        bibs_copied,
    })
}

// ── Remapeo de bloques ────────────────────────────────────────────────────────

fn remap_blocks(blocks: Vec<ContentBlock>, warnings: &mut Vec<String>) -> Vec<ContentBlock> {
    let mut out = Vec::with_capacity(blocks.len());
    for block in blocks {
        match block {
            ContentBlock::RawLatex(raw) => out.extend(try_remap_raw(raw, warnings)),
            other => out.push(other),
        }
    }
    out
}

fn try_remap_raw(raw: RawLatexBlock, warnings: &mut Vec<String>) -> Vec<ContentBlock> {
    let content = raw.content.trim();

    if let Some(fig) = try_parse_figure(content, &raw.id) {
        return vec![ContentBlock::Figure(fig)];
    }
    if let Some(code) = try_parse_code(content, &raw.id) {
        return vec![ContentBlock::Code(code)];
    }
    if let Some(env_name) = detect_plugin_env(content) {
        warnings.push(format!(
            "Entorno '{}' detectado: compatible con plugin visual de TeXisStudio. \
             Se conserva como bloque LaTeX editable.",
            env_name
        ));
        return vec![ContentBlock::RawLatex(RawLatexBlock { user_confirmed: true, ..raw })];
    }

    vec![ContentBlock::RawLatex(RawLatexBlock { user_confirmed: true, ..raw })]
}

// ── Parseo de entorno figure ──────────────────────────────────────────────────

fn try_parse_figure(content: &str, parent_id: &str) -> Option<FigureBlock> {
    if !content.starts_with("\\begin{figure}") && !content.starts_with("\\begin{figure*}") {
        return None;
    }
    if !content.contains("\\includegraphics") {
        return None;
    }
    let path = extract_includegraphics_path(content)?;
    let caption = extract_braced_arg(content, "caption").unwrap_or_default();
    let label = extract_braced_arg(content, "label").unwrap_or_default();

    Some(FigureBlock {
        id: format!("{parent_id}_fig"),
        file: path,
        caption,
        label,
        source: None,
        width: FigureWidth::Full,
        include_in_list: true,
        verbatim_caption: false,
    })
}

fn extract_includegraphics_path(content: &str) -> Option<String> {
    let marker = "\\includegraphics";
    let pos = content.find(marker)? + marker.len();
    let rest = content[pos..].trim_start();
    // Saltar opciones opcionales [...]
    let rest = if rest.starts_with('[') {
        let close = rest.find(']')? + 1;
        &rest[close..]
    } else {
        rest
    };
    let rest = rest.trim_start();
    if !rest.starts_with('{') {
        return None;
    }
    let inner = &rest[1..];
    let end = inner.find('}')?;
    let p = inner[..end].trim().to_string();
    if p.is_empty() { None } else { Some(p) }
}

fn extract_braced_arg(content: &str, cmd: &str) -> Option<String> {
    let needle = format!("\\{cmd}{{");
    let pos = content.find(&needle)? + needle.len();
    let rest = &content[pos..];
    let end = rest.find('}')?;
    let val = rest[..end].trim().to_string();
    if val.is_empty() { None } else { Some(val) }
}

// ── Parseo de entornos de código ──────────────────────────────────────────────

fn try_parse_code(content: &str, parent_id: &str) -> Option<CodeBlock> {
    let (env, lang) = if content.starts_with("\\begin{lstlisting}") {
        let lang = extract_lstlisting_language(content).unwrap_or_else(|| "text".to_string());
        ("lstlisting", lang)
    } else if content.starts_with("\\begin{verbatim}") {
        ("verbatim", "text".to_string())
    } else if content.starts_with("\\begin{minted}") {
        let lang = extract_minted_language(content).unwrap_or_else(|| "text".to_string());
        ("minted", lang)
    } else {
        return None;
    };

    let body = extract_env_body(content, env)?;
    Some(CodeBlock {
        id: format!("{parent_id}_code"),
        language: lang,
        content: body,
        label: None,
        caption: None,
        show_line_numbers: content.contains("numbers="),
    })
}

fn extract_lstlisting_language(content: &str) -> Option<String> {
    let marker = "\\begin{lstlisting}[";
    let pos = content.find(marker)? + marker.len();
    let opts_end = content[pos..].find(']')?;
    let opts = &content[pos..pos + opts_end];
    for part in opts.split(',') {
        let part = part.trim();
        if let Some(stripped) = part.strip_prefix("language=") {
            return Some(stripped.trim().to_string());
        }
    }
    None
}

fn extract_minted_language(content: &str) -> Option<String> {
    let marker = "\\begin{minted}";
    let pos = content.find(marker)? + marker.len();
    let rest = content[pos..].trim_start();
    let rest = if rest.starts_with('[') {
        let close = rest.find(']')? + 1;
        &rest[close..]
    } else {
        rest
    };
    let rest = rest.trim_start();
    if !rest.starts_with('{') {
        return None;
    }
    let inner = &rest[1..];
    let end = inner.find('}')?;
    Some(inner[..end].trim().to_string())
}

fn extract_env_body(content: &str, env: &str) -> Option<String> {
    let begin = format!("\\begin{{{env}}}");
    let end_marker = format!("\\end{{{env}}}");
    let start = content.find(&begin)? + begin.len();
    let rest = &content[start..];
    // Saltar opciones [..] o {..} que siguen al \begin{env}
    let skip = if rest.starts_with('[') {
        rest.find(']').map(|i| i + 1).unwrap_or(0)
    } else if rest.starts_with('{') {
        rest.find('}').map(|i| i + 1).unwrap_or(0)
    } else {
        0
    };
    let body = rest[skip..].trim_start_matches('\n');
    let end = body.find(&end_marker)?;
    Some(body[..end].trim_end().to_string())
}

// ── Detección de entornos de plugins visuales ─────────────────────────────────

fn detect_plugin_env(content: &str) -> Option<&'static str> {
    const PLUGIN_ENVS: &[(&str, &str)] = &[
        ("\\begin{tikzpicture}", "tikzpicture"),
        ("\\begin{circuitikz}", "circuitikz"),
        ("\\begin{pgfplots}", "pgfplots"),
        ("\\begin{tikzcd}", "tikzcd"),
        ("\\ce{", "mhchem"),
        ("\\chemfig{", "chemfig"),
        ("\\begin{forest}", "forest"),
        ("\\begin{sequencediagram}", "sequencediagram"),
        ("\\begin{bytefield}", "bytefield"),
        ("\\feynmandiagram", "feynman"),
    ];
    for (marker, name) in PLUGIN_ENVS {
        if content.contains(marker) {
            return Some(name);
        }
    }
    None
}

// ── Ajuste por plataforma ─────────────────────────────────────────────────────

fn apply_platform_hints(
    model: &mut crate::project::model::ProjectModel,
    platform: &ImportSourcePlatform,
) {
    // Overleaf compila con pdfLaTeX por defecto; si el parseo no detectó
    // fontspec/polyglossia, es razonable mantener pdflatex.
    // TeXstudio/MikTeX en proyectos académicos modernos suelen usar XeLaTeX.
    // La heurística del import_tex (detecta fontspec) ya es la más fiable,
    // así que aquí solo corregimos si hay señal clara del editor.
    match platform {
        ImportSourcePlatform::TeXstudio | ImportSourcePlatform::MikTeX => {
            // Sin más señales, no cambiamos el motor — import_tex lo detectó bien.
        }
        ImportSourcePlatform::Overleaf => {
            // Si no se detectó nada que implique XeLaTeX, Overleaf usa pdflatex.
            if matches!(model.latex_config.engine, LatexEngine::Xelatex)
                && !model
                    .latex_config
                    .packages_required
                    .iter()
                    .any(|p| p == "fontspec" || p == "polyglossia")
            {
                model.latex_config.engine = LatexEngine::Pdflatex;
            }
        }
        _ => {}
    }
}

// ── Scaffold ──────────────────────────────────────────────────────────────────

fn create_scaffold(work_dir: &Path) -> CoreResult<()> {
    for dir in &[
        work_dir.to_path_buf(),
        work_dir.join("content"),
        work_dir.join("content").join("figures"),
        work_dir.join("build"),
    ] {
        std::fs::create_dir_all(dir).map_err(CoreError::Io)?;
    }
    Ok(())
}

// ── Copia de assets ───────────────────────────────────────────────────────────

fn copy_assets(
    figure_paths: &[PathBuf],
    bib_paths: &[PathBuf],
    work_dir: &Path,
    warnings: &mut Vec<String>,
) -> CoreResult<(usize, usize)> {
    let figures_dir = work_dir.join("content").join("figures");
    let content_dir = work_dir.join("content");
    let mut figures_copied = 0usize;
    let mut bibs_copied = 0usize;

    // Rastrea nombres usados para detectar colisiones y renombrar en lugar de sobreescribir.
    let mut used_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for src in figure_paths {
        if let Some(raw_name) = src.file_name().and_then(|n| n.to_str()) {
            let dst_name = unique_name(raw_name, &mut used_names);
            let dst = figures_dir.join(&dst_name);
            if dst_name != raw_name {
                warnings.push(format!(
                    "Figura '{}' renombrada a '{}' para evitar colisión de nombres.",
                    src.display(),
                    dst_name
                ));
            }
            match std::fs::copy(src, &dst) {
                Ok(_) => figures_copied += 1,
                Err(e) => warnings.push(format!(
                    "No se pudo copiar figura '{}': {e}",
                    src.display()
                )),
            }
        }
    }

    let mut used_bib_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    for src in bib_paths {
        if let Some(raw_name) = src.file_name().and_then(|n| n.to_str()) {
            let dst_name = unique_name(raw_name, &mut used_bib_names);
            let dst = content_dir.join(&dst_name);
            match std::fs::copy(src, &dst) {
                Ok(_) => bibs_copied += 1,
                Err(e) => warnings.push(format!(
                    "No se pudo copiar .bib '{}': {e}",
                    src.display()
                )),
            }
        }
    }
    Ok((figures_copied, bibs_copied))
}

/// Genera un nombre de archivo único dentro de `used`. Si hay colisión, agrega sufijo `_2`, `_3`, ...
fn unique_name(name: &str, used: &mut std::collections::HashSet<String>) -> String {
    if !used.contains(name) {
        used.insert(name.to_string());
        return name.to_string();
    }
    // Partir en stem + extensión para insertar sufijo antes de la extensión
    let (stem, ext) = name.rfind('.').map_or((name, ""), |i| (&name[..i], &name[i..]));
    let mut counter = 2u32;
    loop {
        let candidate = format!("{stem}_{counter}{ext}");
        if !used.contains(&candidate) {
            used.insert(candidate.clone());
            return candidate;
        }
        counter += 1;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write(dir: &TempDir, name: &str, content: &str) {
        let path = dir.path().join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    const SIMPLE_TEX: &str = concat!(
        "\\documentclass{book}\n",
        "\\usepackage{fontspec}\n",
        "\\title{Mi Tesis}\n",
        "\\author{Juan García}\n",
        "\\begin{document}\n",
        "\\chapter{Introducción}\nTexto inicial.\n",
        "\\chapter*{Conclusiones}\nTexto final.\n",
        "\\end{document}",
    );

    #[test]
    fn import_crea_project_yaml() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);

        let result =
            import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();
        assert!(result.project_file.exists());
    }

    #[test]
    fn import_crea_scaffold() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);

        import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();
        assert!(dst.path().join("content").exists());
        assert!(dst.path().join("content/figures").exists());
        assert!(dst.path().join("build").exists());
    }

    #[test]
    fn import_copia_figuras() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);
        fs::create_dir_all(src.path().join("figures")).unwrap();
        fs::write(src.path().join("figures/img.png"), b"PNG").unwrap();

        let result =
            import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();
        assert_eq!(result.figures_copied, 1);
        assert!(dst.path().join("content/figures/img.png").exists());
    }

    #[test]
    fn import_copia_bib() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);
        fs::write(src.path().join("refs.bib"), "@article{k,title={T}}").unwrap();

        let result =
            import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();
        assert_eq!(result.bibs_copied, 1);
        assert!(dst.path().join("content/refs.bib").exists());
    }

    #[test]
    fn import_rechaza_src_igual_dst() {
        let dir = tempfile::tempdir().unwrap();
        assert!(
            import_from_folder(dir.path(), dir.path(), &ImportOptions::default()).is_err()
        );
    }

    #[test]
    fn import_rechaza_dst_ocupado_sin_overwrite() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);
        fs::write(dst.path().join("algo.txt"), "existente").unwrap();

        assert!(import_from_folder(
            src.path(),
            dst.path(),
            &ImportOptions { overwrite: false, ..Default::default() }
        )
        .is_err());
    }

    #[test]
    fn import_permite_dst_ocupado_con_overwrite() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);
        fs::write(dst.path().join("algo.txt"), "existente").unwrap();

        assert!(import_from_folder(
            src.path(),
            dst.path(),
            &ImportOptions { overwrite: true, ..Default::default() }
        )
        .is_ok());
    }

    #[test]
    fn remap_figure_block() {
        let raw = concat!(
            "\\begin{figure}[htbp]\n",
            "\\includegraphics[width=0.8\\textwidth]{figures/img.png}\n",
            "\\caption{Mi figura}\n",
            "\\label{fig:mifigura}\n",
            "\\end{figure}",
        );
        let block = ContentBlock::RawLatex(RawLatexBlock {
            id: "t".to_string(),
            content: raw.to_string(),
            user_confirmed: true,
        });
        let mut w = Vec::new();
        let out = remap_blocks(vec![block], &mut w);
        assert!(
            matches!(&out[0], ContentBlock::Figure(f) if f.file == "figures/img.png"),
            "debe convertirse a FigureBlock"
        );
    }

    #[test]
    fn remap_code_lstlisting() {
        let raw = "\\begin{lstlisting}[language=Python]\nprint('hello')\n\\end{lstlisting}";
        let block = ContentBlock::RawLatex(RawLatexBlock {
            id: "t".to_string(),
            content: raw.to_string(),
            user_confirmed: true,
        });
        let mut w = Vec::new();
        let out = remap_blocks(vec![block], &mut w);
        assert!(
            matches!(&out[0], ContentBlock::Code(c) if c.language == "Python"),
            "debe convertirse a CodeBlock"
        );
    }

    #[test]
    fn remap_tikz_queda_raw_con_aviso() {
        let raw = "\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}";
        let block = ContentBlock::RawLatex(RawLatexBlock {
            id: "t".to_string(),
            content: raw.to_string(),
            user_confirmed: true,
        });
        let mut w = Vec::new();
        let out = remap_blocks(vec![block], &mut w);
        assert!(matches!(&out[0], ContentBlock::RawLatex(_)));
        assert!(w.iter().any(|x| x.contains("tikzpicture")));
    }

    #[test]
    fn import_multifile_con_input() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(
            &src,
            "main.tex",
            "\\documentclass{book}\n\\begin{document}\n\\input{cap1}\n\\end{document}",
        );
        write(&src, "cap1.tex", "\\chapter{Cap Uno}\nTexto del cap.");

        let result =
            import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();
        assert!(result.project_file.exists());
    }

    // ── Tests de regresión para issues críticos ───────────────────────────────

    #[test]
    fn copy_assets_resuelve_colision_de_nombres() {
        // Dos figuras con el mismo nombre en subcarpetas diferentes
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);
        fs::create_dir_all(src.path().join("ch1")).unwrap();
        fs::create_dir_all(src.path().join("ch2")).unwrap();
        fs::write(src.path().join("ch1/fig.png"), b"A").unwrap();
        fs::write(src.path().join("ch2/fig.png"), b"B").unwrap();

        let result =
            import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();

        assert_eq!(result.figures_copied, 2, "ambas figuras deben copiarse");
        // Ambas existen con nombres distintos
        let fig1 = dst.path().join("content/figures/fig.png");
        let fig2 = dst.path().join("content/figures/fig_2.png");
        assert!(fig1.exists() && fig2.exists(), "los dos archivos deben existir sin sobreescribirse");
        assert!(result.warnings.iter().any(|w| w.contains("renombrada")), "debe haber aviso de renombrado");
    }

    #[test]
    fn rechaza_work_dir_subcarpeta_de_source() {
        let src = tempfile::tempdir().unwrap();
        write(&src, "main.tex", SIMPLE_TEX);
        // work_dir ES una subcarpeta de source_dir
        let nested = src.path().join("output");
        fs::create_dir_all(&nested).unwrap();

        let result = import_from_folder(src.path(), &nested, &ImportOptions::default());
        assert!(result.is_err(), "debe rechazar work_dir dentro de source_dir");
    }

    #[test]
    fn consolidator_resuelve_input_relativo_al_root() {
        // Patrón Overleaf: \input{chapters/cap1} desde main.tex en raíz
        // cap1.tex hace \input{sections/intro} — intro.tex está en root/sections/
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        write(
            &src,
            "main.tex",
            "\\documentclass{book}\n\\begin{document}\n\\input{chapters/cap1}\n\\end{document}",
        );
        write(
            &src,
            "chapters/cap1.tex",
            "\\chapter{Cap 1}\n\\input{sections/intro}",
        );
        write(&src, "sections/intro.tex", "Texto de introducción.");

        let result =
            import_from_folder(src.path(), dst.path(), &ImportOptions::default()).unwrap();
        // Debe importar sin error y tener contenido de intro
        assert!(result.project_file.exists());
        // sections/intro se resuelve correctamente desde el contexto del chapters/cap1.tex
        // porque el fallback busca también en root_dir
    }

    /// Test de integración contra el proyecto LaTeX real en /tmp/test_importacion/.
    /// Solo corre si la carpeta existe (no falla en CI si no está).
    #[test]
    fn import_real_proyecto_prueba() {
        let src = std::path::Path::new("/tmp/test_importacion");
        if !src.exists() {
            eprintln!("SKIP: /tmp/test_importacion no existe");
            return;
        }

        let dst = tempfile::tempdir().unwrap();
        let opts = ImportOptions {
            source_platform: ImportSourcePlatform::Other,
            main_file_hint: None,
            overwrite: false,
        };
        let result = import_from_folder(src, dst.path(), &opts).unwrap();

        // Archivo de proyecto generado
        assert!(result.project_file.exists(), "project_file debe existir");

        // La figura PNG debe haberse copiado
        assert_eq!(result.figures_copied, 1, "debe copiar diagrama.png");

        // El .bib debe haberse copiado
        assert_eq!(result.bibs_copied, 1, "debe copiar referencias.bib");

        // El YAML debe tener secciones (al menos introduccion y matematicas)
        let yaml_content = std::fs::read_to_string(&result.project_file).unwrap();
        assert!(yaml_content.contains("Introducción") || yaml_content.contains("introduccion"),
            "debe detectar sección de introducción");

        // Los bloques TikZ deben producir avisos de compatibilidad
        let has_tikz_warning = result.warnings.iter().any(|w|
            w.contains("tikzpicture") || w.contains("TikZ") || w.contains("plugin")
        );
        assert!(has_tikz_warning, "debe advertir sobre tikzpicture: {:?}", result.warnings);

        eprintln!("Import OK — figuras={}, bibs={}, avisos={}",
            result.figures_copied, result.bibs_copied, result.warnings.len());
        for w in &result.warnings {
            eprintln!("  AVISO: {}", w);
        }
    }
}
