// Genera build/main.tex y los archivos de configuracion/ a partir del ProjectModel.
//
// INVARIANTES (sección 11 del plan):
// 1. main.tex legible por cualquier persona con LaTeX básico.
// 2. Solo rutas relativas desde build/.
// 3. La clase LaTeX viene del perfil/modelo, no está hardcodeada.
// 4. Compila con: cd build && latexmk -xelatex main.tex

use crate::error::{CoreError, CoreResult};
use crate::project::model::{
    BibliographyBackend, ContentBlock, ProjectModel, ProjectSection, SectionPlacement,
};
use crate::template::engine::TemplateEngine;
use crate::template::escape::latex_escape;
use serde_json::Value;
use std::path::Path;

// ── Detección de scripts Unicode en el contenido ──────────────────────────────

/// Scripts de escritura detectados en el documento.
#[derive(Debug, Default)]
struct ScriptDetection {
    pub cjk: bool,        // Chino / Japonés / Coreano
    pub devanagari: bool, // Hindi / Sanskrit
    pub arabic: bool,
    pub cyrillic: bool, // Ruso / búlgaro / serbio…
    pub hebrew: bool,
    pub thai: bool,
}

fn detect_scripts(model: &ProjectModel) -> ScriptDetection {
    let mut det = ScriptDetection::default();
    for section in &model.sections {
        for block in &section.blocks {
            let text = match block {
                ContentBlock::Paragraph(p) => p.content.as_str(),
                ContentBlock::RawLatex(r) => r.content.as_str(),
                ContentBlock::Heading(h) => h.content.as_str(),
                _ => continue,
            };
            for c in text.chars() {
                let u = c as u32;
                match u {
                    // CJK unificado + extensiones + compatibilidad
                    0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0xF900..=0xFAFF | 0x20000..=0x2A6DF => {
                        det.cjk = true
                    }
                    // Hiragana + Katakana (japonés)
                    0x3040..=0x30FF => det.cjk = true,
                    // Hangul (coreano)
                    0xAC00..=0xD7AF | 0x1100..=0x11FF => det.cjk = true,
                    // Devanagari (Hindi, Sanskrit, Marathi, Nepali…)
                    0x0900..=0x097F => det.devanagari = true,
                    // Árabe
                    0x0600..=0x06FF | 0x0750..=0x077F => det.arabic = true,
                    // Cirílico
                    0x0400..=0x04FF => det.cyrillic = true,
                    // Hebreo
                    0x0590..=0x05FF | 0xFB1D..=0xFB4F => det.hebrew = true,
                    // Thai
                    0x0E00..=0x0E7F => det.thai = true,
                    _ => {}
                }
                if det.cjk && det.devanagari && det.arabic && det.cyrillic {
                    break;
                }
            }
        }
    }
    det
}

const HEADER_COMMENT: &str = "\
% ─────────────────────────────────────────────────────────────────
% Generado por TeXisStudio
% https://github.com/GonzaloAndDev/TeXisStudio
% Autor original: Gonzalo Andrade Estrella
%
% Fuente de verdad: tesis.project.yaml + content/
% Este archivo es output. No editar directamente.
%
% Compilar desde el directorio build/:
%   cd build && latexmk -xelatex main.tex
% ─────────────────────────────────────────────────────────────────
";

pub fn generate(
    model: &ProjectModel,
    build_dir: &Path,
    engine: &TemplateEngine,
    lang_config: Option<&Value>,
) -> CoreResult<()> {
    let main = render_to_string(model, engine, lang_config)?;
    std::fs::write(build_dir.join("main.tex"), &main).map_err(CoreError::Io)?;

    let paquetes = render_paquetes(model, lang_config);
    std::fs::write(build_dir.join("configuracion/paquetes.tex"), &paquetes)
        .map_err(CoreError::Io)?;

    let estilo = render_estilo(model);
    std::fs::write(build_dir.join("configuracion/estilo.tex"), &estilo).map_err(CoreError::Io)?;

    let datos = render_datos_tesis(model);
    std::fs::write(build_dir.join("configuracion/datos_tesis.tex"), &datos)
        .map_err(CoreError::Io)?;

    Ok(())
}

pub fn render_to_string(
    model: &ProjectModel,
    _engine: &TemplateEngine,
    _lang_config: Option<&Value>,
) -> CoreResult<String> {
    let mut out = String::new();

    out.push_str(HEADER_COMMENT);
    out.push('\n');

    // Clase del documento — aplicar overrides de tipografía del usuario
    let cls = &model.latex_config.document_class;
    let typo = &model.latex_config.typography;
    let mut options = normalized_class_options(model);
    if let Some(fs) = &typo.font_size {
        options.push(fs.clone());
    }
    if let Some(ps) = &typo.paper_size {
        options.push(ps.clone());
    }
    out.push_str(&format!(
        "\\documentclass[{}]{{{}}}\n\n",
        options.join(","),
        cls.name
    ));

    // Archivos de configuración
    out.push_str("\\input{configuracion/paquetes}\n");
    out.push_str("\\input{configuracion/estilo}\n");
    out.push_str("\\input{configuracion/datos_tesis}\n");

    // Entradas de glosario/acrónimos (generadas automáticamente cuando existen)
    if crate::generator::glossary_tex::has_glossary_content(model) {
        out.push_str("\\input{configuracion/glossary}\n");
    }
    out.push('\n');

    out.push_str("\\begin{document}\n");

    let mut body_idx = 0usize;
    let mut in_frontmatter = false;
    let mut in_mainmatter = false;
    let mut appendix_started = false;
    let mut pending_backmatter = Vec::new();

    for section in &model.sections {
        if !section.enabled {
            continue;
        }

        match section.placement {
            SectionPlacement::FrontMatter => {
                if section.element_id == "title_page" {
                    out.push_str(
                        "\n% ── Portada ──────────────────────────────────────────────────────\n",
                    );
                    out.push_str(&format!("\\input{{preliminares/{}}}\n", section.id));
                } else {
                    if !in_frontmatter {
                        out.push_str("\n\\frontmatter\n");
                        in_frontmatter = true;
                    }
                    match section.element_id.as_str() {
                        "table_of_contents" => out.push_str("\n\\tableofcontents\n"),
                        "list_of_figures" if has_figures(model) => {
                            out.push_str("\\listoffigures\n")
                        }
                        "list_of_tables" if has_tables(model) => out.push_str("\\listoftables\n"),
                        "list_of_algorithms" if has_algorithms(model) => {
                            out.push_str("\\listofalgorithms\n")
                        }
                        "list_of_listings" if has_listings(model) => {
                            out.push_str("\\lstlistoflistings\n")
                        }
                        "list_of_figures" | "list_of_tables" | "list_of_algorithms"
                        | "list_of_listings" => {}
                        _ => out.push_str(&format!("\\input{{preliminares/{}}}\n", section.id)),
                    }
                }
            }

            SectionPlacement::Body => {
                if !in_mainmatter {
                    if !in_frontmatter {
                        // Sin secciones de frontmatter explícitas aún así va \frontmatter
                        out.push_str("\n\\frontmatter\n\\tableofcontents\n");
                        in_frontmatter = true;
                    }
                    out.push_str("\n\\mainmatter\n");
                    in_mainmatter = true;
                }
                out.push_str(&format!(
                    "\n\\input{{capitulos/{:02}_{}}}\n",
                    body_idx + 1,
                    section.id
                ));
                body_idx += 1;
            }

            SectionPlacement::BackMatter => {
                pending_backmatter.push(section);
            }

            SectionPlacement::Appendix => {
                if !appendix_started {
                    out.push_str("\n\\appendix\n");
                    appendix_started = true;
                }
                out.push_str(&format!("\\input{{anexos/{}}}\n", section.id));
            }
        }
    }

    if !pending_backmatter.is_empty() {
        out.push_str("\n\\backmatter\n");
        for section in pending_backmatter {
            match section.element_id.as_str() {
                // biblatex siempre usa \printbibliography, independientemente del backend
                "references" => {
                    out.push_str("\n\\printbibliography[heading=bibintoc]\n");
                }
                // Sección de glosario explícita → emitir \printglossaries
                "glossary" | "list_glossary" | "glossary_section" => {
                    out.push_str("\n\\printglossaries\n");
                }
                _ => out.push_str(&format!("\\input{{backmatter/{}}}\n", section.id)),
            }
        }
    }

    out.push_str("\n\\end{document}\n");
    Ok(out)
}

/// Genera el \usepackage{geometry} con los márgenes correctos.
///
/// Prioridad (P1.1/P1.2):
/// 1. Márgenes asimétricos en `latex_config.page_layout.margins` (copiados del perfil).
/// 2. Margen uniforme `typography.margin_cm` del proyecto (override del usuario).
/// 3. Default 2.5 cm uniforme.
fn render_geometry(model: &ProjectModel) -> String {
    let layout = model.latex_config.page_layout.as_ref();

    let paper = layout
        .and_then(|l| l.paper.as_deref())
        .or(model.latex_config.typography.paper_size.as_deref())
        .unwrap_or("letterpaper");

    // Márgenes asimétricos (institucionales) tienen prioridad
    if let Some(margins) = layout.and_then(|l| l.margins.as_ref()) {
        let top = margins.top.as_deref().unwrap_or("25.4mm");
        let bottom = margins.bottom.as_deref().unwrap_or("25.4mm");
        let left = margins.left.as_deref().unwrap_or("25.4mm");
        let right = margins.right.as_deref().unwrap_or("25.4mm");
        return format!(
            "\\usepackage[{paper},top={top},bottom={bottom},left={left},right={right}]{{geometry}}\n"
        );
    }

    // Margen uniforme del usuario o default
    let margin = model.latex_config.typography.margin_cm.unwrap_or(2.5);
    format!("\\usepackage[{paper},margin={margin}cm]{{geometry}}\n")
}

/// Reescribe los nombres de caption y de lista de los paquetes `listings`
/// (código) y `algorithm`, que por defecto están en inglés y que ni babel ni
/// polyglossia traducen. Devuelve cadena vacía para idiomas sin traducción
/// curada (se conservan los nombres por defecto en inglés).
fn caption_name_localization(language: &str) -> String {
    let lang = language
        .split(['-', '_'])
        .next()
        .unwrap_or(language)
        .to_lowercase();
    // (lstlistingname, lstlistlistingname, algorithm floatname, listalgorithmname)
    let names = match lang.as_str() {
        "es" => ("Código", "Índice de listados", "Algoritmo", "Índice de algoritmos"),
        "pt" => ("Código", "Lista de listagens", "Algoritmo", "Lista de algoritmos"),
        "fr" => (
            "Listing",
            "Liste des listings",
            "Algorithme",
            "Liste des algorithmes",
        ),
        "de" => (
            "Listing",
            "Listingverzeichnis",
            "Algorithmus",
            "Algorithmenverzeichnis",
        ),
        // en y cualquier otro: conservar los nombres por defecto del paquete.
        _ => return String::new(),
    };
    let (listing, listing_list, algorithm, algorithm_list) = names;
    format!(
        "\\renewcommand{{\\lstlistingname}}{{{listing}}}\n\
         \\renewcommand{{\\lstlistlistingname}}{{{listing_list}}}\n\
         \\floatname{{algorithm}}{{{algorithm}}}\n\
         \\renewcommand{{\\listalgorithmname}}{{{algorithm_list}}}\n",
    )
}

fn normalized_class_options(model: &ProjectModel) -> Vec<String> {
    let cls = &model.latex_config.document_class;
    let typo = &model.latex_config.typography;
    let mut options: Vec<String> = cls
        .options
        .iter()
        .filter(|o| {
            // Filtrar las opciones que el usuario puede sobreescribir
            let o = o.as_str();
            let is_font_size = matches!(o, "10pt" | "11pt" | "12pt");
            let is_paper_size = matches!(o, "a4paper" | "letterpaper" | "a5paper" | "b5paper");
            !(is_font_size && typo.font_size.is_some()
                || is_paper_size && typo.paper_size.is_some())
        })
        .cloned()
        .collect();
    if model.latex_config.document_class.name == "book"
        && options.iter().any(|o| o == "oneside")
        && !options.iter().any(|o| o == "openany" || o == "openright")
    {
        options.push("openany".to_string());
    }
    options
}

fn walk_sections<'a>(sections: &'a [ProjectSection], f: &mut impl FnMut(&'a ProjectSection)) {
    for section in sections {
        f(section);
        walk_sections(&section.children, f);
    }
}

fn any_block(model: &ProjectModel, pred: impl Fn(&ContentBlock) -> bool) -> bool {
    let mut found = false;
    walk_sections(&model.sections, &mut |section| {
        if !found && section.enabled {
            found = section.blocks.iter().any(&pred);
        }
    });
    found
}

fn has_figures(model: &ProjectModel) -> bool {
    any_block(model, |block| {
        matches!(block, ContentBlock::Figure(f) if f.include_in_list)
            || matches!(block, ContentBlock::Visual(v) if v.include_in_list)
            || matches!(block, ContentBlock::PluginFigure(_))
    })
}

fn has_tables(model: &ProjectModel) -> bool {
    any_block(
        model,
        |block| matches!(block, ContentBlock::Table(t) if t.include_in_list),
    )
}

fn has_algorithms(model: &ProjectModel) -> bool {
    any_block(model, |block| matches!(block, ContentBlock::Algorithm(_)))
}

fn has_listings(model: &ProjectModel) -> bool {
    any_block(
        model,
        |block| matches!(block, ContentBlock::Code(c) if c.caption.as_ref().is_some_and(|caption| !caption.trim().is_empty())),
    )
}

/// Emite la configuración de fuente Cirílica para polyglossia russian.
/// Sin esta configuración, el texto ruso sale en negrita o no se muestra
/// porque la fuente principal (LM Roman) no tiene glifos Cirílicos.
fn emit_cyrillic_font(pc: &crate::project::model::PreambleConfig, out: &mut String) {
    let font = match &pc.cyrillic_font {
        Some(f) if !f.is_empty() => f.as_str(),
        // Fuentes de fallback por SO
        _ => {
            #[cfg(target_os = "macos")]
            {
                "Arial Unicode MS"
            }
            #[cfg(not(target_os = "macos"))]
            {
                "CMU Serif"
            }
        }
    };
    out.push_str(&format!(
        "\\newfontfamily\\cyrillicfont[Script=Cyrillic]{{{}}}\n",
        latex_escape(font)
    ));
    out.push_str(&format!(
        "\\newfontfamily\\cyrillicfontsf[Script=Cyrillic]{{{}}}\n",
        latex_escape(font)
    ));
    out.push_str(&format!(
        "\\newfontfamily\\cyrillicfonttt[Script=Cyrillic]{{{}}}\n",
        latex_escape(font)
    ));
}

/// Versión pública de render_paquetes para uso desde el DriftReport generator.
pub fn render_paquetes_pub(model: &ProjectModel, lang_config: Option<&Value>) -> String {
    render_paquetes(model, lang_config)
}

/// Versión pública de render_estilo para uso desde el DriftReport generator.
pub fn render_estilo_pub(model: &ProjectModel) -> String {
    render_estilo(model)
}

/// Versión pública de render_datos_tesis para uso desde el DriftReport generator.
pub fn render_datos_tesis_pub(model: &ProjectModel) -> String {
    render_datos_tesis(model)
}

fn render_paquetes(model: &ProjectModel, lang_config: Option<&Value>) -> String {
    let mut out = String::from("% Paquetes LaTeX — generado automáticamente\n\n");
    let pc = &model.latex_config.preamble_config;
    let scripts = detect_scripts(model);

    // ── Paquetes base ─────────────────────────────────────────────────────────
    out.push_str("\\usepackage{fontspec}\n");
    out.push_str(&render_geometry(model));
    out.push_str("\\usepackage{graphicx}\n");
    out.push_str("\\usepackage{booktabs}\n");
    out.push_str("\\usepackage{array}\n");
    out.push_str("\\usepackage{longtable}\n");
    // rotating: requerido por sidewaystable (TableStyle::Wide)
    if has_wide_table(model) {
        out.push_str("\\usepackage{rotating}\n");
    }
    out.push_str("\\usepackage{float}\n");
    out.push_str("\\usepackage{caption}\n");
    out.push_str("\\usepackage{setspace}\n");
    out.push_str("\\usepackage{microtype}\n");
    out.push_str("\\usepackage{csquotes}\n");
    // adjustbox: escala tablas anchas automáticamente
    out.push_str("\\usepackage{adjustbox}\n");

    // ── Fuentes del documento (override sobre perfil) ─────────────────────────
    if let Some(f) = &pc.main_font {
        out.push_str(&format!("\\setmainfont{{{}}}\n", latex_escape(f)));
    }
    if let Some(f) = &pc.sans_font {
        out.push_str(&format!("\\setsansfont{{{}}}\n", latex_escape(f)));
    }
    if let Some(f) = &pc.mono_font {
        out.push_str(&format!("\\setmonofont{{{}}}\n", latex_escape(f)));
    }

    // ── Soporte CJK ──────────────────────────────────────────────────────────
    // Auto-detectado del contenido O si el usuario declaró cjk_main_font.
    // xeCJK se carga ANTES de polyglossia para evitar conflictos.
    let needs_cjk = scripts.cjk
        || pc.cjk_main_font.is_some()
        || pc.cjk_japanese_font.is_some()
        || pc.cjk_korean_font.is_some()
        || model
            .latex_config
            .packages_required
            .iter()
            .any(|p| p == "xeCJK");

    if needs_cjk {
        out.push_str("\n% Soporte CJK (auto-detectado del contenido del documento)\n");
        // Solo añadir xeCJK si no está ya en packages_required (evitar doble carga)
        if !model
            .latex_config
            .packages_required
            .iter()
            .any(|p| p == "xeCJK")
        {
            out.push_str("\\usepackage{xeCJK}\n");
        }
        let cjk_main = pc.cjk_main_font.as_deref().unwrap_or("Heiti SC");
        out.push_str(&format!("\\setCJKmainfont{{{}}}\n", latex_escape(cjk_main)));
        // xeCJK permite variantes de fuente por idioma con el parámetro Language=
        // Fuente japonesa: [Language=Japanese] — necesita xeCJK >= 3.x
        if let Some(ja) = &pc.cjk_japanese_font {
            out.push_str(&format!(
                "\\setCJKmainfont[Language=Japanese]{{{}}}\n",
                latex_escape(ja)
            ));
        }
        // Los que usen cjk_korean_font pueden poner la fuente en preamble_config.extra
        // ya que la API varía según la versión de xeCJK disponible.
    }

    // ── Configuración de idioma ───────────────────────────────────────────────
    // Prioridad: (1) lang_config del pack instalado, (2) model.metadata.language.
    if lang_config.is_none() {
        match model.metadata.language.as_str() {
            "es" => {
                out.push_str("\n% Idioma del documento\n");
                out.push_str("\\usepackage{polyglossia}\n");
                out.push_str("\\setmainlanguage{spanish}\n");
                out.push_str("\\setotherlanguage{english}\n");
                // Ruso también si se detectó cirílico
                if scripts.cyrillic {
                    out.push_str("\\setotherlanguage{russian}\n");
                    emit_cyrillic_font(pc, &mut out);
                }
            }
            "fr" => {
                out.push_str("\n% Idioma del documento\n");
                out.push_str("\\usepackage{polyglossia}\n");
                out.push_str("\\setmainlanguage{french}\n");
            }
            "pt" => {
                out.push_str("\n% Idioma del documento\n");
                out.push_str("\\usepackage{polyglossia}\n");
                out.push_str("\\setmainlanguage{portuges}\n");
            }
            "de" => {
                out.push_str("\n% Idioma del documento\n");
                out.push_str("\\usepackage{polyglossia}\n");
                out.push_str("\\setmainlanguage{german}\n");
            }
            "ru" => {
                out.push_str("\n% Idioma del documento\n");
                out.push_str("\\usepackage{polyglossia}\n");
                out.push_str("\\setmainlanguage{russian}\n");
                emit_cyrillic_font(pc, &mut out);
            }
            "en" | "" if scripts.cyrillic => {
                // Cirílico detectado en documento de idioma inglés
                out.push_str("\n% Soporte multilingüe (Cirílico detectado)\n");
                out.push_str("\\usepackage{polyglossia}\n");
                out.push_str("\\setmainlanguage{english}\n");
                out.push_str("\\setotherlanguage{russian}\n");
                emit_cyrillic_font(pc, &mut out);
            }
            _ => {}
        }
    }

    if let Some(cfg) = lang_config {
        let polyglossia = cfg.get("polyglossia_name").and_then(|v| v.as_str());
        let babel = cfg.get("babel_name").and_then(|v| v.as_str());
        let xelatex_font = cfg.get("xelatex_font").and_then(|v| v.as_str());

        if let Some(lang_name) = polyglossia {
            out.push_str("\n% Idioma del documento (polyglossia)\n");
            out.push_str("\\usepackage{polyglossia}\n");
            out.push_str(&format!("\\setmainlanguage{{{}}}\n", lang_name));
        } else if let Some(lang_name) = babel {
            out.push_str("\n% Idioma del documento (babel)\n");
            out.push_str(&format!("\\usepackage[{}]{{babel}}\n", lang_name));
        }
        if let Some(font) = xelatex_font {
            out.push_str(&format!("\\setmainfont{{{}}}\n", font));
        }
    }

    // ── Bibliografía ──────────────────────────────────────────────────────────
    let bib_style = &model.latex_config.bibliography_style;
    let bib_backend = match &model.latex_config.bibliography_backend {
        BibliographyBackend::Biber => "biber",
        BibliographyBackend::Bibtex => "bibtex",
    };
    out.push_str(&format!(
        "\\usepackage[style={},backend={}]{{biblatex}}\n",
        bib_style, bib_backend
    ));
    out.push_str("\\addbibresource{references.bib}\n");

    out.push_str("\\usepackage[hidelinks]{hyperref}\n");

    // ── Glosario y acrónimos (auto-detectados del contenido) ──────────────────
    // glossaries debe cargarse DESPUÉS de hyperref para que los hipervínculos
    // funcionen correctamente. \makeglossaries activa la indexación.
    if crate::generator::glossary_tex::has_glossary_content(model) {
        out.push_str("\n% Glosario y acrónimos (detectados en el contenido del proyecto)\n");
        out.push_str("\\usepackage[toc,acronym,nonumberlist]{glossaries}\n");
        out.push_str("\\makeglossaries\n");
    }

    // ── Paquetes requeridos por VisualBlocks y PluginFigureBlocks ────────────
    // Auto-detectados del contenido — el usuario no necesita declararlos.
    // needs_tikz_libs se emite más abajo, después de packages_required, para que
    // \usetikzlibrary aparezca siempre después de \usepackage{tikz}.
    let needs_tikz_libs: bool;
    let preamble_snippets: Vec<&'static str>;
    {
        use crate::project::model::ContentBlock;
        use crate::visual::{extra_packages, required_package, required_preamble};
        let mut vis_pkgs: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut snippets: std::collections::HashSet<&'static str> = Default::default();
        for section in &model.sections {
            for block in &section.blocks {
                match block {
                    ContentBlock::Visual(v) => {
                        vis_pkgs.insert(required_package(&v.config).to_string());
                        for ep in extra_packages(&v.config) {
                            vis_pkgs.insert(ep.to_string());
                        }
                        if let Some(snip) = required_preamble(&v.config) {
                            snippets.insert(snip);
                        }
                    }
                    ContentBlock::PluginFigure(pf) => {
                        for pkg in &pf.required_packages {
                            // Solo nombres de paquete seguros: [a-zA-Z0-9\-_]
                            // Un nombre con } o \n rompería \usepackage{name}.
                            if !pkg.is_empty()
                                && pkg
                                    .chars()
                                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                            {
                                vis_pkgs.insert(pkg.clone());
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        needs_tikz_libs = vis_pkgs.contains("tikz");
        preamble_snippets = snippets.into_iter().collect();
        if !vis_pkgs.is_empty() {
            out.push_str("\n% Paquetes para elementos visuales (auto-detectados)\n");
            // Orden determinista
            let mut sorted: Vec<&String> = vis_pkgs.iter().collect();
            sorted.sort();
            for pkg in &sorted {
                // No duplicar paquetes ya cargados en packages_required
                let already = model
                    .latex_config
                    .packages_required
                    .iter()
                    .any(|p| p == pkg.as_str())
                    || model
                        .latex_config
                        .packages_with_options
                        .iter()
                        .any(|p| p.name == pkg.as_str());
                if !already {
                    out.push_str(&format!("\\usepackage{{{}}}\n", pkg));
                }
            }
        }
    }

    // ── Paquetes de posgrado (base) ───────────────────────────────────────────
    out.push_str("\n% Paquetes de posgrado\n");
    out.push_str("\\usepackage{listings}\n");
    out.push_str("\\lstset{basicstyle=\\ttfamily\\footnotesize, frame=single, breaklines=true, tabsize=4, showstringspaces=false}\n");
    out.push_str("\\usepackage{algorithm}\n");
    out.push_str("\\usepackage{algpseudocode}\n");
    // polyglossia traduce capítulo/figura/tabla, pero los paquetes `listings` y
    // `algorithm` usan nombres en inglés ("Listing", "Algorithm") que ningún
    // idioma reescribe. Localizamos sus captions y títulos de lista aquí.
    out.push_str(&caption_name_localization(&model.metadata.language));
    out.push_str("\\usepackage{amsmath}\n");
    out.push_str("\\usepackage{amssymb}\n");
    out.push_str("\\usepackage{amsthm}\n");
    out.push_str("\\usepackage{mathtools}\n");
    out.push_str("\\usepackage{bm}\n");

    // ── Paquetes con opciones declarados por el usuario ───────────────────────
    if !model.latex_config.packages_with_options.is_empty() {
        out.push_str("\n% Paquetes con opciones\n");
        for pkg in &model.latex_config.packages_with_options {
            if pkg.options.is_empty() {
                out.push_str(&format!("\\usepackage{{{}}}\n", pkg.name));
            } else {
                out.push_str(&format!(
                    "\\usepackage[{}]{{{}}}\n",
                    pkg.options.join(","),
                    pkg.name
                ));
            }
        }
    }

    // ── Paquetes simples adicionales ──────────────────────────────────────────
    // (excluir xeCJK si ya lo cargamos arriba)
    for pkg in &model.latex_config.packages_required {
        if pkg == "xeCJK" && needs_cjk {
            continue;
        } // ya cargado
        out.push_str(&format!("\\usepackage{{{}}}\n", pkg));
    }

    // TikZ libraries — emitidas aquí, después de \usepackage{tikz}
    if needs_tikz_libs {
        out.push_str("\\usetikzlibrary{shapes.geometric,calc,decorations.markings,decorations.pathmorphing,arrows.meta,positioning}\n");
    }

    // Snippets de preámbulo requeridos por bloques visuales (e.g. \tikzset{} de Feynman).
    // Se deduplicaron en la fase de recolección arriba.
    if !preamble_snippets.is_empty() {
        out.push_str("\n% Estilos de elementos visuales\n");
        let mut sorted_snippets = preamble_snippets.clone();
        sorted_snippets.sort_unstable();
        for snip in &sorted_snippets {
            out.push_str(snip);
            out.push('\n');
        }
    }

    // ── Operadores matemáticos personalizados ─────────────────────────────────
    if !pc.math_operators.is_empty() {
        out.push_str("\n% Operadores matemáticos\n");
        for op in &pc.math_operators {
            out.push_str(&format!(
                "\\DeclareMathOperator{{\\{}}}{{{}}}\n",
                latex_escape(&op.command),
                latex_escape(&op.text)
            ));
        }
    }

    // ── Entornos de teoremas adicionales ─────────────────────────────────────
    if !pc.extra_theorems.is_empty() {
        out.push_str("\n% Entornos de teoremas adicionales\n");
        for thm in &pc.extra_theorems {
            if thm.numbered {
                match &thm.parent_counter {
                    Some(parent) => out.push_str(&format!(
                        "\\newtheorem{{{}}}{{{}}}[{}]\n",
                        thm.id,
                        latex_escape(&thm.label),
                        parent
                    )),
                    None => out.push_str(&format!(
                        "\\newtheorem{{{}}}{{{}}}\n",
                        thm.id,
                        latex_escape(&thm.label)
                    )),
                }
            } else {
                out.push_str(&format!(
                    "\\newtheorem*{{{}}}{{{}}}\n",
                    thm.id,
                    latex_escape(&thm.label)
                ));
            }
        }
    }

    // ── Preámbulo extra (escape hatch) ────────────────────────────────────────
    if let Some(extra) = &pc.extra {
        let trimmed = extra.trim();
        if !trimmed.is_empty() {
            out.push_str("\n% Preámbulo adicional (configurado por el usuario)\n");
            out.push_str(trimmed);
            out.push('\n');
        }
    }

    out
}

fn render_estilo(model: &ProjectModel) -> String {
    let mut out = String::from("% Estilo — generado automáticamente\n\n");

    // Prioridad de interlineado (P1.2):
    // 1. line_spacing del perfil (page_layout.line_spacing, valor float: 1.0=single, 1.5=onehalf, 2.0=double)
    // 2. line_spacing del usuario (typography.line_spacing, string: "single"|"onehalf"|"double")
    // 3. Default: onehalf
    let spacing_cmd = if let Some(spacing_f) = model
        .latex_config
        .page_layout
        .as_ref()
        .and_then(|l| l.line_spacing)
    {
        if spacing_f <= 1.0 {
            "\\singlespacing"
        } else if spacing_f >= 2.0 {
            "\\doublespacing"
        } else {
            "\\onehalfspacing"
        }
    } else {
        match model
            .latex_config
            .typography
            .line_spacing
            .as_deref()
            .unwrap_or("onehalf")
        {
            "single" => "\\singlespacing",
            "double" => "\\doublespacing",
            _ => "\\onehalfspacing",
        }
    };
    out.push_str(&format!("{}\n", spacing_cmd));
    out.push_str("\\setlength{\\parindent}{1.5em}\n");
    out.push_str("\\setlength{\\parskip}{6pt}\n");

    // Entornos de teoremas (amsthm)
    out.push_str("\n% Entornos de teoremas\n");
    out.push_str("\\newtheorem{theorem}{Teorema}[chapter]\n");
    out.push_str("\\newtheorem{lemma}[theorem]{Lema}\n");
    out.push_str("\\newtheorem{corollary}[theorem]{Corolario}\n");
    out.push_str("\\newtheorem{proposition}[theorem]{Proposici\\'{o}n}\n");
    out.push_str("\\theoremstyle{definition}\n");
    out.push_str("\\newtheorem{definition}[theorem]{Definici\\'{o}n}\n");
    out.push_str("\\theoremstyle{remark}\n");
    out.push_str("\\newtheorem*{remark}{Observaci\\'{o}n}\n");
    // Variantes no numeradas
    out.push_str("\\newtheorem*{theorem*}{Teorema}\n");
    out.push_str("\\newtheorem*{lemma*}{Lema}\n");
    out.push_str("\\newtheorem*{corollary*}{Corolario}\n");
    out.push_str("\\newtheorem*{proposition*}{Proposici\\'{o}n}\n");
    out.push_str("\\newtheorem*{definition*}{Definici\\'{o}n}\n");

    out
}

fn has_wide_table(model: &ProjectModel) -> bool {
    use crate::project::model::{ContentBlock, TableStyle};
    model.sections.iter().any(|s| {
        s.blocks.iter().any(
            |b| matches!(b, ContentBlock::Table(t) if matches!(t.table_style, TableStyle::Wide)),
        )
    })
}

fn render_datos_tesis(model: &ProjectModel) -> String {
    let mut out = String::from("% Datos de la tesis — generado automáticamente\n\n");

    out.push_str(&format!(
        "\\newcommand{{\\tesisTitulo}}{{{}}}\n",
        latex_escape(&model.metadata.title)
    ));
    if let Some(sub) = &model.metadata.subtitle {
        out.push_str(&format!(
            "\\newcommand{{\\tesisSubtitulo}}{{{}}}\n",
            latex_escape(sub)
        ));
    }
    out.push_str(&format!(
        "\\newcommand{{\\tesisAutor}}{{{}}}\n",
        latex_escape(&model.student.full_name)
    ));
    out.push_str(&format!(
        "\\newcommand{{\\tesisInstitucion}}{{{}}}\n",
        latex_escape(&model.institution.name)
    ));
    if let Some(fac) = &model.institution.faculty {
        out.push_str(&format!(
            "\\newcommand{{\\tesisFacultad}}{{{}}}\n",
            latex_escape(fac)
        ));
    }
    // Asesores: usar lista `advisors` si existe, sino campo legacy `advisor`
    let all_advisors: Vec<&str> = if !model.student.advisors.is_empty() {
        model.student.advisors.iter().map(|s| s.as_str()).collect()
    } else {
        let mut v: Vec<&str> = model.student.advisor.as_deref().into_iter().collect();
        if let Some(co) = model.student.co_advisor.as_deref() {
            v.push(co);
        }
        v
    };
    if !all_advisors.is_empty() {
        // \tesisAsesor → primer asesor (compatibilidad portadas clásicas)
        out.push_str(&format!(
            "\\newcommand{{\\tesisAsesor}}{{{}}}\n",
            latex_escape(all_advisors[0])
        ));
        // \tesisAsesores → todos, separados por \\ para listados de portada
        let joined = all_advisors
            .iter()
            .map(|a| latex_escape(a))
            .collect::<Vec<_>>()
            .join(" \\\\ ");
        out.push_str(&format!("\\newcommand{{\\tesisAsesores}}{{{}}}\n", joined));
    }
    // Co-autores (trabajos grupales)
    if !model.student.co_authors.is_empty() {
        let co = model
            .student
            .co_authors
            .iter()
            .map(|a| latex_escape(&a.full_name))
            .collect::<Vec<_>>()
            .join(", ");
        out.push_str(&format!("\\newcommand{{\\tesisCoAutores}}{{{}}}\n", co));
    }
    out.push_str(&format!(
        "\\newcommand{{\\tesisAnio}}{{{}}}\n",
        model.metadata.year
    ));
    out.push_str(&format!(
        "\\newcommand{{\\tesisCiudad}}{{{}}}\n",
        latex_escape(&model.metadata.city)
    ));

    // ORCID iD
    if let Some(orcid) = &model.student.orcid {
        if !orcid.is_empty() {
            out.push_str(&format!(
                "\\newcommand{{\\tesisORCID}}{{{}}}\n",
                latex_escape(orcid)
            ));
        }
    }

    // Comité sinodal / jurado
    if !model.student.committee.is_empty() {
        let joined = model
            .student
            .committee
            .iter()
            .map(|m| match &m.role {
                Some(r) => format!("{} ({})", latex_escape(&m.full_name), latex_escape(r)),
                None => latex_escape(&m.full_name),
            })
            .collect::<Vec<_>>()
            .join(" \\\\ ");
        out.push_str(&format!("\\newcommand{{\\tesisComite}}{{{}}}\n", joined));
        // Comandos individuales para plantillas de portada avanzadas.
        // En TeX, `\tesisComite1` NO es un nombre de macro válido por sintaxis directa:
        // se tokeniza como `\tesisComite` + `1`. Por eso definimos los nombres
        // dinámicos con `\csname ... \endcsname`, de modo que las plantillas que
        // realmente necesiten acceso indexado usen:
        //   \csname tesisComite1\endcsname
        //   \csname tesisComite1Rol\endcsname
        for (i, m) in model.student.committee.iter().enumerate() {
            out.push_str(&format!(
                "\\expandafter\\def\\csname tesisComite{}\\endcsname{{{}}}\n",
                i + 1,
                latex_escape(&m.full_name)
            ));
            if let Some(r) = &m.role {
                out.push_str(&format!(
                    "\\expandafter\\def\\csname tesisComite{}Rol\\endcsname{{{}}}\n",
                    i + 1,
                    latex_escape(r)
                ));
            }
        }
    }

    // Financiamiento
    if let Some(funding) = &model.metadata.funding {
        if !funding.is_empty() {
            out.push_str(&format!(
                "\\newcommand{{\\tesisFinanciamiento}}{{{}}}\n",
                latex_escape(funding)
            ));
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::*;
    use std::collections::HashMap;

    fn front_list(id: &str, element_id: &str) -> ProjectSection {
        ProjectSection {
            id: id.to_string(),
            element_id: element_id.to_string(),
            title: Some(id.to_string()),
            placement: SectionPlacement::FrontMatter,
            required: false,
            enabled: true,
            label: None,
            status: SectionStatus::Draft,
            notes: None,
            blocks: vec![],
            fields: HashMap::new(),
            children: vec![],
        }
    }

    fn body_section(blocks: Vec<ContentBlock>) -> ProjectSection {
        ProjectSection {
            id: "intro".to_string(),
            element_id: "intro".to_string(),
            title: Some("Introduccion".to_string()),
            placement: SectionPlacement::Body,
            required: true,
            enabled: true,
            label: None,
            status: SectionStatus::Draft,
            notes: None,
            blocks,
            fields: HashMap::new(),
            children: vec![],
        }
    }

    fn model_with_blocks(blocks: Vec<ContentBlock>) -> ProjectModel {
        ProjectModel {
            id: "test".to_string(),
            schema_version: "1.0.0".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
            metadata: ProjectMetadata {
                title: "Tesis".to_string(),
                subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Licenciatura,
                language: "es".to_string(),
                city: "CDMX".to_string(),
                year: 2026,
                keywords: vec![],
                funding: None,
            },
            institution: InstitutionData {
                name: "Universidad".to_string(),
                faculty: None,
                department: None,
                logo_path: None,
                country: "MX".to_string(),
            },
            student: StudentData {
                full_name: "Autor".to_string(),
                student_id: None,
                email: None,
                advisor: None,
                advisors: vec![],
                co_authors: vec![],
                co_advisor: None,
                committee: vec![],
                orcid: None,
            },
            profile_id: "generic.thesis".to_string(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig {
                    name: "book".to_string(),
                    options: vec!["12pt".to_string(), "oneside".to_string()],
                },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "numeric".to_string(),
                packages_required: vec![],
                packages_with_options: vec![],
                typography: Default::default(),
                page_layout: None,
                preamble_config: Default::default(),
            },
            sections: vec![
                front_list("toc", "table_of_contents"),
                front_list("lof", "list_of_figures"),
                front_list("lot", "list_of_tables"),
                front_list("lol", "list_of_listings"),
                body_section(blocks),
            ],
            file_states: HashMap::new(),
        }
    }

    #[test]
    fn skips_empty_generated_lists() {
        let engine = TemplateEngine::new().unwrap();
        let model = model_with_blocks(vec![ContentBlock::Paragraph(ParagraphBlock {
            id: "p1".to_string(),
            content: "Texto sin figuras ni tablas.".to_string(),
            verbatim: false,
        })]);

        let out = render_to_string(&model, &engine, None).unwrap();

        assert!(out.contains("\\tableofcontents"));
        assert!(!out.contains("\\listoffigures"));
        assert!(!out.contains("\\listoftables"));
        assert!(!out.contains("\\lstlistoflistings"));
    }

    #[test]
    fn emits_lists_when_matching_content_exists() {
        let engine = TemplateEngine::new().unwrap();
        let model = model_with_blocks(vec![
            ContentBlock::Figure(FigureBlock {
                id: "fig1".to_string(),
                file: "figures/a.png".to_string(),
                caption: "Figura".to_string(),
                source: None,
                width: FigureWidth::Half,
                label: "fig:a".to_string(),
                include_in_list: true,
                verbatim_caption: false,
            }),
            ContentBlock::Table(TableBlock {
                id: "tab1".to_string(),
                caption: "Tabla".to_string(),
                source: None,
                label: "tab:a".to_string(),
                include_in_list: true,
                raw_headers: false,
                raw_cells: false,
                verbatim_caption: false,
                headers: vec!["A".to_string()],
                rows: vec![vec!["B".to_string()]],
                table_style: TableStyle::Simple,
            }),
            ContentBlock::Code(CodeBlock {
                id: "code1".to_string(),
                language: "Python".to_string(),
                caption: Some("Codigo".to_string()),
                label: Some("lst:a".to_string()),
                content: "print('ok')".to_string(),
                show_line_numbers: false,
            }),
        ]);

        let out = render_to_string(&model, &engine, None).unwrap();

        assert!(out.contains("\\listoffigures"));
        assert!(out.contains("\\listoftables"));
        assert!(out.contains("\\lstlistoflistings"));
    }

    #[test]
    fn skips_generated_lists_when_blocks_are_not_listable() {
        let engine = TemplateEngine::new().unwrap();
        let model = model_with_blocks(vec![
            ContentBlock::Figure(FigureBlock {
                id: "fig1".to_string(),
                file: "figures/a.png".to_string(),
                caption: "Figura".to_string(),
                source: None,
                width: FigureWidth::Half,
                label: "fig:a".to_string(),
                include_in_list: false,
                verbatim_caption: false,
            }),
            ContentBlock::Table(TableBlock {
                id: "tab1".to_string(),
                caption: "Tabla".to_string(),
                source: None,
                label: "tab:a".to_string(),
                include_in_list: false,
                raw_headers: false,
                raw_cells: false,
                verbatim_caption: false,
                headers: vec!["A".to_string()],
                rows: vec![vec!["B".to_string()]],
                table_style: TableStyle::Simple,
            }),
            ContentBlock::Code(CodeBlock {
                id: "code1".to_string(),
                language: "Python".to_string(),
                caption: None,
                label: None,
                content: "print('ok')".to_string(),
                show_line_numbers: false,
            }),
        ]);

        let out = render_to_string(&model, &engine, None).unwrap();

        assert!(!out.contains("\\listoffigures"));
        assert!(!out.contains("\\listoftables"));
        assert!(!out.contains("\\lstlistoflistings"));
    }

    #[test]
    fn oneside_book_defaults_to_openany_unless_profile_requests_openright() {
        let engine = TemplateEngine::new().unwrap();
        let mut model = model_with_blocks(vec![]);

        let out = render_to_string(&model, &engine, None).unwrap();
        assert!(out.contains("\\documentclass[12pt,oneside,openany]{book}"));

        model
            .latex_config
            .document_class
            .options
            .push("openright".to_string());
        let out = render_to_string(&model, &engine, None).unwrap();
        assert!(out.contains("\\documentclass[12pt,oneside,openright]{book}"));
        assert!(!out.contains("openright,openany"));
    }
}
