//! Importador de archivos .tex externos (Overleaf, TeXstudio, MikTeX, etc.)
//!
//! Estrategia: parseo estructural conservador.
//!   1. Extrae preámbulo y cuerpo (entre \begin{document} y \end{document}).
//!   2. Detecta capitulos (\chapter y \chapter*).
//!   3. Dentro de cada capitulo detecta headings de seccion.
//!   4. El resto del contenido va a RawLatexBlock(user_confirmed: true) -- nunca se pierde contenido.
//!   5. Extrae metadata basica del preambulo: titulo, autor, paquetes.

pub mod consolidator;
pub mod folder_import;

pub use folder_import::{import_from_folder, FolderImportResult, ImportOptions, ImportSourcePlatform};

use crate::project::model::{
    AcademicLevel, BibliographyBackend, CompilerKind, ContentBlock, DocumentClassConfig,
    DocumentKind, HeadingBlock, HeadingLevel, InstitutionData, LatexConfig, LatexEngine,
    ProjectMetadata, ProjectModel, ProjectSection, RawLatexBlock, SectionPlacement,
    SectionStatus, StudentData,
};
use std::collections::HashMap;

/// Resultado de importar un archivo .tex.
pub struct ImportResult {
    pub model: ProjectModel,
    /// Avisos no fatales (paquetes no reconocidos, metadata faltante, etc.)
    pub warnings: Vec<String>,
}

/// Importa el contenido de un archivo .tex y produce un ProjectModel.
///
/// - El ProjectModel resultante tiene `profile_id = "imported"`.
/// - Las secciones contienen los capítulos detectados.
/// - El contenido que no se reconoce va en RawLatexBlock(user_confirmed: true).
pub fn import_tex(tex: &str) -> ImportResult {
    let mut warnings = Vec::new();

    let preamble = extract_preamble(tex);
    let body = extract_body(tex);

    if body.is_none() {
        warnings.push(
            "No se encontró \\begin{document}...\\end{document}. \
             El archivo completo se tratará como un capítulo."
                .to_string(),
        );
    }

    let body = body.unwrap_or(tex);

    let meta = parse_preamble_metadata(preamble.unwrap_or(""), &mut warnings);
    let sections = build_sections(body, &mut warnings);

    let model = build_model(meta, sections);
    ImportResult { model, warnings }
}

// ── Extracción de preámbulo y cuerpo ─────────────────────────────────────────

fn extract_preamble(tex: &str) -> Option<&str> {
    let end = tex.find("\\begin{document}")?;
    Some(&tex[..end])
}

fn extract_body(tex: &str) -> Option<&str> {
    let start = tex.find("\\begin{document}")? + "\\begin{document}".len();
    let end = tex.rfind("\\end{document}").unwrap_or(tex.len());
    Some(tex[start..end].trim())
}

// ── Metadata del preámbulo ────────────────────────────────────────────────────

struct PreambleMeta {
    title: String,
    author: String,
    doc_class: String,
    packages: Vec<String>,
}

fn parse_preamble_metadata(preamble: &str, warnings: &mut Vec<String>) -> PreambleMeta {
    let title = extract_command_arg(preamble, "title")
        .unwrap_or_else(|| "Título importado".to_string());
    let author = extract_command_arg(preamble, "author")
        .unwrap_or_else(|| "Autor".to_string());
    let doc_class = extract_document_class(preamble)
        .unwrap_or_else(|| "book".to_string());

    let packages = extract_packages(preamble);
    if packages.is_empty() {
        warnings.push("No se detectaron \\usepackage en el preámbulo.".to_string());
    }

    PreambleMeta { title, author, doc_class, packages }
}

/// Extrae el argumento principal de un comando LaTeX simple: `\cmd{ARG}`.
/// Solo funciona para comandos con un único par de llaves en la misma línea.
fn extract_command_arg(tex: &str, cmd: &str) -> Option<String> {
    let needle = format!("\\{cmd}{{");
    let start = tex.find(&needle)? + needle.len();
    let rest = &tex[start..];
    let end = find_closing_brace(rest)?;
    let raw = &rest[..end];
    // Quitar saltos de línea y comprimir espacios
    let clean: String = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.is_empty() { None } else { Some(clean) }
}

/// Localiza la } de cierre contando niveles de anidación.
fn find_closing_brace(s: &str) -> Option<usize> {
    let mut depth = 1usize;
    for (i, c) in s.char_indices() {
        match c {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

fn extract_document_class(preamble: &str) -> Option<String> {
    // \documentclass[opts]{class} o \documentclass{class}
    let start = preamble.find("\\documentclass")?;
    let rest = &preamble[start + "\\documentclass".len()..];
    // Saltar opciones opcionales [...]
    let rest = if rest.starts_with('[') {
        let close = rest.find(']')? + 1;
        &rest[close..]
    } else {
        rest
    };
    let rest = rest.trim_start();
    if rest.starts_with('{') {
        let inner = &rest[1..];
        let end = inner.find('}')?;
        Some(inner[..end].trim().to_string())
    } else {
        None
    }
}

fn extract_packages(preamble: &str) -> Vec<String> {
    let mut pkgs = Vec::new();
    for line in preamble.lines() {
        let line = line.trim();
        if !line.starts_with("\\usepackage") {
            continue;
        }
        // \usepackage[opts]{pkg} o \usepackage{pkg}
        let rest = &line["\\usepackage".len()..];
        // Saltar opciones
        let rest = if rest.starts_with('[') {
            match rest.find(']') {
                Some(i) => &rest[i + 1..],
                None => continue,
            }
        } else {
            rest
        };
        let rest = rest.trim_start();
        if rest.starts_with('{') {
            let inner = &rest[1..];
            if let Some(end) = inner.find('}') {
                // Puede ser \usepackage{pkg1, pkg2} con lista
                for p in inner[..end].split(',') {
                    let name = p.trim().to_string();
                    if !name.is_empty() {
                        pkgs.push(name);
                    }
                }
            }
        }
    }
    pkgs
}

// ── División en secciones por capítulo ────────────────────────────────────────

struct RawChapter {
    title: Option<String>,
    starred: bool,     // \chapter* vs \chapter
    content: String,
}

fn build_sections(body: &str, warnings: &mut Vec<String>) -> Vec<ProjectSection> {
    let chapters = split_into_chapters(body);

    if chapters.is_empty() {
        // Sin capítulos detectados — todo el body como una sola sección
        warnings.push(
            "No se detectaron \\chapter. Todo el cuerpo va en una sola sección.".to_string(),
        );
        return vec![make_section(
            None,
            SectionPlacement::Body,
            body.trim(),
            false,
        )];
    }

    chapters
        .iter()
        .map(|ch| {
            let placement = if ch.starred {
                // heurística simple: starred chapters → BackMatter
                SectionPlacement::BackMatter
            } else {
                SectionPlacement::Body
            };
            make_section(ch.title.as_deref(), placement, ch.content.trim(), ch.starred)
        })
        .collect()
}

/// Divide el body en capítulos. El contenido previo al primer \chapter
/// va como capítulo "FrontMatter sin título" si no está vacío.
fn split_into_chapters(body: &str) -> Vec<RawChapter> {
    let mut chapters: Vec<RawChapter> = Vec::new();

    // Tokenizamos línea a línea buscando \chapter o \chapter*
    let mut current_title: Option<String> = None;
    let mut current_starred = false;
    let mut current_content = String::new();
    let mut in_chapter = false;

    for line in body.lines() {
        let trimmed = line.trim();
        if let Some((starred, title)) = detect_chapter(trimmed) {
            // Guardar acumulado anterior
            if in_chapter || !current_content.trim().is_empty() {
                chapters.push(RawChapter {
                    title: current_title.clone(),
                    starred: current_starred,
                    content: current_content.clone(),
                });
            }
            current_title = title;
            current_starred = starred;
            current_content = String::new();
            in_chapter = true;
        } else {
            if !current_content.is_empty() || !trimmed.is_empty() {
                current_content.push_str(line);
                current_content.push('\n');
            }
        }
    }

    // Último capítulo
    if in_chapter || !current_content.trim().is_empty() {
        chapters.push(RawChapter {
            title: current_title,
            starred: current_starred,
            content: current_content,
        });
    }

    chapters
}

/// Detecta `\chapter{TITLE}` o `\chapter*{TITLE}`.
/// Devuelve (starred, Option<title>).
fn detect_chapter(line: &str) -> Option<(bool, Option<String>)> {
    let line = line.trim_start();
    let (starred, rest) = if line.starts_with("\\chapter*") {
        (true, &line["\\chapter*".len()..])
    } else if line.starts_with("\\chapter") {
        (false, &line["\\chapter".len()..])
    } else {
        return None;
    };
    // El siguiente char debe ser { o espacio+{
    let rest = rest.trim_start();
    let title = if rest.starts_with('{') {
        let inner = &rest[1..];
        find_closing_brace(inner)
            .map(|end| inner[..end].trim().to_string())
            .filter(|t| !t.is_empty())
    } else {
        None
    };
    Some((starred, title))
}

// ── Construcción de ProjectSection con bloques ────────────────────────────────

fn make_section(
    title: Option<&str>,
    placement: SectionPlacement,
    content: &str,
    _starred: bool,
) -> ProjectSection {
    let blocks = parse_chapter_content(content);
    ProjectSection {
        id: new_id(),
        element_id: "imported".to_string(),
        title: title.map(|t| t.to_string()),
        placement,
        required: false,
        enabled: true,
        label: None,
        status: SectionStatus::Draft,
        notes: None,
        blocks,
        fields: HashMap::new(),
        children: vec![],
    }
}

/// Parsea el contenido de un capítulo en bloques.
/// Reconoce headings de sección; el resto va a RawLatexBlock.
fn parse_chapter_content(content: &str) -> Vec<ContentBlock> {
    let mut blocks: Vec<ContentBlock> = Vec::new();
    let mut pending = String::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if let Some((level, heading_text)) = detect_section_heading(trimmed) {
            flush_raw(&mut pending, &mut blocks);
            blocks.push(ContentBlock::Heading(HeadingBlock {
                id: new_id(),
                content: heading_text,
                level,
            }));
        } else {
            pending.push_str(line);
            pending.push('\n');
        }
    }

    flush_raw(&mut pending, &mut blocks);
    blocks
}

/// Convierte el texto acumulado en un RawLatexBlock si no está vacío.
fn flush_raw(pending: &mut String, blocks: &mut Vec<ContentBlock>) {
    let trimmed = pending.trim();
    if !trimmed.is_empty() {
        blocks.push(ContentBlock::RawLatex(RawLatexBlock {
            id: new_id(),
            content: trimmed.to_string(),
            user_confirmed: true,
        }));
    }
    pending.clear();
}

fn detect_section_heading(line: &str) -> Option<(HeadingLevel, String)> {
    let candidates = [
        ("\\subsubsection{", HeadingLevel::Subsubsection),
        ("\\subsection{", HeadingLevel::Subsection),
        ("\\section{", HeadingLevel::Section),
    ];
    for (prefix, level) in candidates {
        if line.starts_with(prefix) {
            let inner = &line[prefix.len()..];
            let end = find_closing_brace(inner)?;
            return Some((level, inner[..end].trim().to_string()));
        }
    }
    None
}

// ── Construcción del ProjectModel ─────────────────────────────────────────────

fn build_model(meta: PreambleMeta, sections: Vec<ProjectSection>) -> ProjectModel {
    let doc_class_name = if ["book", "article", "report", "memoir"]
        .contains(&meta.doc_class.as_str())
    {
        meta.doc_class.clone()
    } else {
        "book".to_string()
    };

    let engine = if meta.packages.iter().any(|p| p == "fontspec" || p == "polyglossia") {
        LatexEngine::Xelatex
    } else {
        LatexEngine::Pdflatex
    };

    let now = chrono_or_placeholder();

    ProjectModel {
        id: new_id(),
        schema_version: crate::schema::versions::CURRENT_SCHEMA_VERSION.to_string(),
        created_at: now.clone(),
        updated_at: now,
        metadata: ProjectMetadata {
            title: meta.title.clone(),
            subtitle: None,
            document_kind: DocumentKind::Tesis,
            academic_level: AcademicLevel::Licenciatura,
            language: "es".to_string(),
            city: "".to_string(),
            year: 2025,
            keywords: vec![],
            funding: None,
        },
        institution: InstitutionData {
            name: "".to_string(),
            faculty: None,
            department: None,
            logo_path: None,
            country: "".to_string(),
        },
        student: StudentData {
            full_name: meta.author,
            student_id: None,
            email: None,
            advisor: None,
            co_advisor: None,
            advisors: vec![],
            co_authors: vec![],
            committee: vec![],
            orcid: None,
        },
        profile_id: "imported".to_string(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: doc_class_name,
                options: vec![],
            },
            engine,
            compiler: CompilerKind::Latexmk,
            bibliography_backend: BibliographyBackend::Biber,
            bibliography_style: "apa".to_string(),
            packages_required: meta.packages,
            typography: Default::default(),
            page_layout: None,
            packages_with_options: vec![],
            preamble_config: Default::default(),
        },
        sections,
        file_states: HashMap::new(),
    }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("imp_{ts:08x}_{n:04x}")
}

fn chrono_or_placeholder() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // ISO-8601 básico sin dependencia de chrono
    let (y, mo, d, h, mi, s) = epoch_to_ymd(secs);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

fn epoch_to_ymd(mut secs: u64) -> (u64, u64, u64, u64, u64, u64) {
    let s = secs % 60; secs /= 60;
    let mi = secs % 60; secs /= 60;
    let h = secs % 24; secs /= 24;
    // Días desde 1970-01-01
    let mut days = secs;
    let mut y = 1970u64;
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        let dy = if leap { 366 } else { 365 };
        if days < dy { break; }
        days -= dy; y += 1;
    }
    let months = [31u64, if (y%4==0&&y%100!=0)||y%400==0{29}else{28}, 31,30,31,30,31,31,30,31,30,31];
    let mut mo = 1u64;
    for &dm in &months {
        if days < dm { break; }
        days -= dm; mo += 1;
    }
    (y, mo, days + 1, h, mi, s)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const SIMPLE_TEX: &str = r#"\documentclass[12pt]{book}
\usepackage{fontspec}
\usepackage{amsmath}
\title{Mi Tesis de Prueba}
\author{Juan García}
\begin{document}
\chapter{Introducción}
Este es el texto de introducción.

Segundo párrafo.

\section{Contexto}
Más texto aquí.

\chapter*{Conclusiones}
Texto de conclusiones.
\end{document}"#;

    #[test]
    fn import_detecta_capitulos() {
        let result = import_tex(SIMPLE_TEX);
        let sections = &result.model.sections;
        assert_eq!(sections.len(), 2, "debe haber 2 capítulos");
        assert_eq!(sections[0].title.as_deref(), Some("Introducción"));
        assert_eq!(sections[1].title.as_deref(), Some("Conclusiones"));
    }

    #[test]
    fn capitulo_body_tiene_placement_body() {
        let result = import_tex(SIMPLE_TEX);
        assert!(matches!(result.model.sections[0].placement, SectionPlacement::Body));
    }

    #[test]
    fn capitulo_starred_tiene_placement_backmatter() {
        let result = import_tex(SIMPLE_TEX);
        assert!(matches!(result.model.sections[1].placement, SectionPlacement::BackMatter));
    }

    #[test]
    fn import_extrae_titulo() {
        let result = import_tex(SIMPLE_TEX);
        assert_eq!(result.model.metadata.title, "Mi Tesis de Prueba");
    }

    #[test]
    fn import_extrae_autor() {
        let result = import_tex(SIMPLE_TEX);
        assert_eq!(result.model.student.full_name, "Juan García");
    }

    #[test]
    fn import_extrae_paquetes() {
        let result = import_tex(SIMPLE_TEX);
        assert!(result.model.latex_config.packages_required.contains(&"fontspec".to_string()));
        assert!(result.model.latex_config.packages_required.contains(&"amsmath".to_string()));
    }

    #[test]
    fn engine_xelatex_cuando_fontspec() {
        let result = import_tex(SIMPLE_TEX);
        assert!(matches!(result.model.latex_config.engine, LatexEngine::Xelatex));
    }

    #[test]
    fn seccion_dentro_de_capitulo_es_heading_block() {
        let result = import_tex(SIMPLE_TEX);
        let intro = &result.model.sections[0];
        let has_heading = intro.blocks.iter().any(|b| {
            matches!(b, ContentBlock::Heading(h) if h.content == "Contexto")
        });
        assert!(has_heading, "la \\section debe convertirse en HeadingBlock");
    }

    #[test]
    fn contenido_no_reconocido_es_raw_latex_confirmado() {
        let result = import_tex(SIMPLE_TEX);
        let intro = &result.model.sections[0];
        let has_raw = intro.blocks.iter().any(|b| {
            matches!(b, ContentBlock::RawLatex(r) if r.user_confirmed && r.content.contains("introducción"))
        });
        assert!(has_raw, "el texto no reconocido debe ser RawLatexBlock confirmado");
    }

    #[test]
    fn sin_document_env_importa_todo_el_contenido() {
        let tex = "\\chapter{Solo}\nTexto sin envolver en document.";
        let result = import_tex(tex);
        assert_eq!(result.model.sections.len(), 1);
        assert_eq!(result.model.sections[0].title.as_deref(), Some("Solo"));
    }

    #[test]
    fn tex_sin_capitulos_produce_una_seccion() {
        let tex = "\\begin{document}\nTexto libre sin capítulos.\n\\end{document}";
        let result = import_tex(tex);
        assert_eq!(result.model.sections.len(), 1);
        let has_raw = result.model.sections[0].blocks.iter().any(|b| {
            matches!(b, ContentBlock::RawLatex(r) if r.user_confirmed)
        });
        assert!(has_raw);
        assert!(!result.warnings.is_empty(), "debe emitir aviso de sin capítulos");
    }

    #[test]
    fn find_closing_brace_simple() {
        assert_eq!(find_closing_brace("abc}def"), Some(3));
    }

    #[test]
    fn find_closing_brace_anidado() {
        assert_eq!(find_closing_brace("a{b}c}d"), Some(5));
    }

    #[test]
    fn extract_packages_lista_multiple() {
        let preamble = "\\usepackage{pkg1, pkg2, pkg3}";
        let pkgs = extract_packages(preamble);
        assert!(pkgs.contains(&"pkg1".to_string()));
        assert!(pkgs.contains(&"pkg2".to_string()));
        assert!(pkgs.contains(&"pkg3".to_string()));
    }
}
