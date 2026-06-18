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

pub use folder_import::{
    import_from_folder, FolderImportResult, ImportOptions, ImportSourcePlatform,
};

use crate::project::model::{
    AcademicLevel, BibliographyBackend, CompilerKind, ContentBlock, DocumentClassConfig,
    DocumentKind, EquationBlock, HeadingBlock, HeadingLevel, InstitutionData, LatexConfig,
    LatexEngine, ListBlock, ListType, ProjectMetadata, ProjectModel, ProjectSection, RawLatexBlock,
    SectionPlacement, SectionStatus, StudentData,
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
    let title =
        extract_command_arg(preamble, "title").unwrap_or_else(|| "Título importado".to_string());
    let author = extract_command_arg(preamble, "author").unwrap_or_else(|| "Autor".to_string());
    let doc_class = extract_document_class(preamble).unwrap_or_else(|| "book".to_string());

    let packages = extract_packages(preamble);
    if packages.is_empty() {
        warnings.push("No se detectaron \\usepackage en el preámbulo.".to_string());
    }

    PreambleMeta {
        title,
        author,
        doc_class,
        packages,
    }
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
    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
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
    if let Some(inner) = rest.strip_prefix('{') {
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
        if let Some(inner) = rest.strip_prefix('{') {
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
    starred: bool, // \chapter* vs \chapter
    content: String,
}

fn build_sections(body: &str, warnings: &mut Vec<String>) -> Vec<ProjectSection> {
    let chapters = split_into_chapters(body);

    if chapters.is_empty() {
        // Sin capítulos detectados — todo el body como una sola sección
        warnings
            .push("No se detectaron \\chapter. Todo el cuerpo va en una sola sección.".to_string());
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
            make_section(
                ch.title.as_deref(),
                placement,
                ch.content.trim(),
                ch.starred,
            )
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
    let (starred, rest) = if let Some(stripped) = line.strip_prefix("\\chapter*") {
        (true, stripped)
    } else if let Some(stripped) = line.strip_prefix("\\chapter") {
        (false, stripped)
    } else {
        return None;
    };
    // El siguiente char debe ser { o espacio+{
    let rest = rest.trim_start();
    let title = if let Some(inner) = rest.strip_prefix('{') {
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
///
/// Estrategia: el parser camina línea a línea y solo se "compromete" con un
/// bloque semántico cuando detecta un entorno cerrado limpiamente. Si algo
/// no calza (un \begin sin \end, un \item huérfano, una sección dentro de
/// un entorno math), el contenido cae al raw_latex acumulado — la red de
/// seguridad nunca pierde texto.
///
/// Reconoce:
///   * \begin{equation} … \end{equation}                → EquationBlock numerada
///   * \begin{equation*} … \end{equation*}              → EquationBlock no numerada
///   * \begin{itemize} … \end{itemize}                  → ListBlock Itemize
///   * \begin{enumerate} … \end{enumerate}              → ListBlock Enumerate
///   * \section / \subsection / \subsubsection          → HeadingBlock
///
/// Todo lo demás (tablas, citas inline, código, macros, comandos crudos) se
/// preserva como RawLatexBlock confirmado para no romper el documento original.
fn parse_chapter_content(content: &str) -> Vec<ContentBlock> {
    let mut blocks: Vec<ContentBlock> = Vec::new();
    let mut pending = String::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        // ── Equation env (equation, equation*) ──────────────────────
        if let Some(numbered) = detect_equation_open(trimmed) {
            let close_tag = if numbered {
                "\\end{equation}"
            } else {
                "\\end{equation*}"
            };
            if let Some(end_idx) = find_env_end(&lines, i + 1, close_tag) {
                flush_raw(&mut pending, &mut blocks);
                let body_lines = &lines[i + 1..end_idx];
                let (body, label) = extract_equation_body_and_label(body_lines);
                blocks.push(ContentBlock::Equation(EquationBlock {
                    id: new_id(),
                    latex_content: body,
                    label,
                    numbered,
                }));
                i = end_idx + 1;
                continue;
            }
            // \begin sin \end → caemos a raw_latex preservando el contenido.
        }

        // ── List env (itemize, enumerate) ───────────────────────────
        if let Some(list_type) = detect_list_open(trimmed) {
            let close_tag = match list_type {
                ListType::Itemize => "\\end{itemize}",
                ListType::Enumerate => "\\end{enumerate}",
                ListType::Description => "\\end{description}",
            };
            if let Some(end_idx) = find_env_end(&lines, i + 1, close_tag) {
                let inner = &lines[i + 1..end_idx];
                if let Some(items) = parse_list_items(inner) {
                    flush_raw(&mut pending, &mut blocks);
                    blocks.push(ContentBlock::List(ListBlock {
                        id: new_id(),
                        list_type,
                        items,
                    }));
                    i = end_idx + 1;
                    continue;
                }
                // Lista con anidados u otra complicación → preferimos
                // dejarla como raw_latex (cae por defecto debajo).
            }
        }

        // ── Heading de sección ──────────────────────────────────────
        if let Some((level, heading_text)) = detect_section_heading(trimmed) {
            flush_raw(&mut pending, &mut blocks);
            blocks.push(ContentBlock::Heading(HeadingBlock {
                id: new_id(),
                content: heading_text,
                level,
            }));
            i += 1;
            continue;
        }

        // ── Fallback: acumula en raw_latex ──────────────────────────
        pending.push_str(line);
        pending.push('\n');
        i += 1;
    }

    flush_raw(&mut pending, &mut blocks);
    blocks
}

/// Devuelve `Some(numbered)` si la línea abre un entorno equation.
/// `numbered = true` para `equation`, `false` para `equation*`.
fn detect_equation_open(line: &str) -> Option<bool> {
    let s = line.trim_start();
    if s.starts_with("\\begin{equation*}") {
        Some(false)
    } else if s.starts_with("\\begin{equation}") {
        Some(true)
    } else {
        None
    }
}

/// Devuelve el tipo si la línea abre un entorno de lista soportado.
fn detect_list_open(line: &str) -> Option<ListType> {
    let s = line.trim_start();
    if s.starts_with("\\begin{itemize}") {
        Some(ListType::Itemize)
    } else if s.starts_with("\\begin{enumerate}") {
        Some(ListType::Enumerate)
    } else {
        None
    }
}

/// Encuentra el índice de la línea que contiene `close_tag` empezando desde
/// `start`. Devuelve `None` si no hay match (env mal cerrado).
fn find_env_end(lines: &[&str], start: usize, close_tag: &str) -> Option<usize> {
    lines.iter().enumerate().skip(start).find_map(|(i, l)| {
        if l.trim_start().starts_with(close_tag) {
            Some(i)
        } else {
            None
        }
    })
}

/// Extrae el cuerpo de una ecuación y, si lo hay, el `\label{…}`. El label
/// se devuelve como `Some(key)` y se elimina del cuerpo (el generador
/// lo re-emite a partir del campo `label` del EquationBlock).
fn extract_equation_body_and_label(body_lines: &[&str]) -> (String, Option<String>) {
    let mut kept: Vec<String> = Vec::new();
    let mut label: Option<String> = None;
    for line in body_lines {
        // Busca \label{...} en la línea; si está, sácalo. Si la línea quedaba
        // vacía sin el label, no la conservamos.
        if let Some(start) = line.find("\\label{") {
            let after = &line[start + 7..];
            if let Some(end) = find_closing_brace(after) {
                if label.is_none() {
                    label = Some(after[..end].trim().to_string());
                }
                let before = &line[..start];
                let after_rest = &after[end + 1..];
                let stripped = format!("{before}{after_rest}");
                if !stripped.trim().is_empty() {
                    kept.push(stripped);
                }
                continue;
            }
        }
        kept.push((*line).to_string());
    }
    let body = kept.join("\n").trim().to_string();
    (body, label)
}

/// Parsea ítems de una lista plana (sin sublistas). Devuelve `None` si detecta
/// un \begin/\end anidado — en ese caso el caller cae a raw_latex.
fn parse_list_items(lines: &[&str]) -> Option<Vec<String>> {
    // Si hay anidamiento de entornos, abortar: parsearlo bien requiere recursión
    // y el riesgo de perder algo no compensa el beneficio.
    if lines.iter().any(|l| {
        let s = l.trim_start();
        s.starts_with("\\begin{") || s.starts_with("\\end{")
    }) {
        return None;
    }
    let mut items: Vec<String> = Vec::new();
    let mut current: Option<String> = None;
    for line in lines {
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix("\\item") {
            if let Some(prev) = current.take() {
                items.push(prev.trim().to_string());
            }
            // Soporta `\item Texto` y `\item[etiqueta] Texto` — descarta el `[…]`.
            let body = rest.trim_start_matches(' ');
            let body = if let Some(after_bracket) = body.strip_prefix('[') {
                if let Some(close) = after_bracket.find(']') {
                    &after_bracket[close + 1..]
                } else {
                    body
                }
            } else {
                body
            };
            current = Some(body.trim().to_string());
        } else if let Some(buf) = current.as_mut() {
            // Continuación del ítem actual: anexar respetando espaciado.
            if !buf.is_empty() {
                buf.push(' ');
            }
            buf.push_str(line.trim());
        }
    }
    if let Some(last) = current {
        items.push(last.trim().to_string());
    }
    if items.is_empty() {
        None
    } else {
        Some(items)
    }
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
        if let Some(inner) = line.strip_prefix(prefix) {
            let end = find_closing_brace(inner)?;
            return Some((level, inner[..end].trim().to_string()));
        }
    }
    None
}

// ── Construcción del ProjectModel ─────────────────────────────────────────────

fn build_model(meta: PreambleMeta, sections: Vec<ProjectSection>) -> ProjectModel {
    let doc_class_name =
        if ["book", "article", "report", "memoir"].contains(&meta.doc_class.as_str()) {
            meta.doc_class.clone()
        } else {
            "book".to_string()
        };

    let engine = if meta
        .packages
        .iter()
        .any(|p| p == "fontspec" || p == "polyglossia")
    {
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
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
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
    let s = secs % 60;
    secs /= 60;
    let mi = secs % 60;
    secs /= 60;
    let h = secs % 24;
    secs /= 24;
    // Días desde 1970-01-01
    let mut days = secs;
    let mut y = 1970u64;
    loop {
        let leap = (y.is_multiple_of(4) && !y.is_multiple_of(100)) || y.is_multiple_of(400);
        let dy = if leap { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        y += 1;
    }
    let months = [
        31u64,
        if (y.is_multiple_of(4) && !y.is_multiple_of(100)) || y.is_multiple_of(400) {
            29
        } else {
            28
        },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut mo = 1u64;
    for &dm in &months {
        if days < dm {
            break;
        }
        days -= dm;
        mo += 1;
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
        assert!(matches!(
            result.model.sections[0].placement,
            SectionPlacement::Body
        ));
    }

    #[test]
    fn capitulo_starred_tiene_placement_backmatter() {
        let result = import_tex(SIMPLE_TEX);
        assert!(matches!(
            result.model.sections[1].placement,
            SectionPlacement::BackMatter
        ));
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
        assert!(result
            .model
            .latex_config
            .packages_required
            .contains(&"fontspec".to_string()));
        assert!(result
            .model
            .latex_config
            .packages_required
            .contains(&"amsmath".to_string()));
    }

    #[test]
    fn engine_xelatex_cuando_fontspec() {
        let result = import_tex(SIMPLE_TEX);
        assert!(matches!(
            result.model.latex_config.engine,
            LatexEngine::Xelatex
        ));
    }

    #[test]
    fn seccion_dentro_de_capitulo_es_heading_block() {
        let result = import_tex(SIMPLE_TEX);
        let intro = &result.model.sections[0];
        let has_heading = intro
            .blocks
            .iter()
            .any(|b| matches!(b, ContentBlock::Heading(h) if h.content == "Contexto"));
        assert!(has_heading, "la \\section debe convertirse en HeadingBlock");
    }

    #[test]
    fn contenido_no_reconocido_es_raw_latex_confirmado() {
        let result = import_tex(SIMPLE_TEX);
        let intro = &result.model.sections[0];
        let has_raw = intro.blocks.iter().any(|b| {
            matches!(b, ContentBlock::RawLatex(r) if r.user_confirmed && r.content.contains("introducción"))
        });
        assert!(
            has_raw,
            "el texto no reconocido debe ser RawLatexBlock confirmado"
        );
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
        let has_raw = result.model.sections[0]
            .blocks
            .iter()
            .any(|b| matches!(b, ContentBlock::RawLatex(r) if r.user_confirmed));
        assert!(has_raw);
        assert!(
            !result.warnings.is_empty(),
            "debe emitir aviso de sin capítulos"
        );
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

    // ── Detectores semánticos añadidos al importador ─────────────────────

    #[test]
    fn import_detecta_equation_numerada_con_label() {
        let tex = "\\chapter{C1}\nAntes.\n\\begin{equation}\n    E = mc^2\n    \\label{eq:einstein}\n\\end{equation}\nDespués.";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        let eq = blocks
            .iter()
            .find_map(|b| {
                if let ContentBlock::Equation(e) = b {
                    Some(e)
                } else {
                    None
                }
            })
            .expect("debe haber un EquationBlock");
        assert!(eq.numbered);
        assert_eq!(eq.label.as_deref(), Some("eq:einstein"));
        assert!(eq.latex_content.contains("E = mc^2"));
        assert!(
            !eq.latex_content.contains("\\label"),
            "el label se extrae fuera del body"
        );
    }

    #[test]
    fn import_detecta_equation_sin_numerar() {
        let tex = "\\chapter{C1}\n\\begin{equation*}\n    \\int_0^1 x \\, dx\n\\end{equation*}";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        let eq = blocks
            .iter()
            .find_map(|b| {
                if let ContentBlock::Equation(e) = b {
                    Some(e)
                } else {
                    None
                }
            })
            .expect("debe haber un EquationBlock");
        assert!(!eq.numbered);
        assert!(eq.label.is_none());
    }

    #[test]
    fn import_detecta_itemize() {
        let tex = "\\chapter{C1}\n\\begin{itemize}\n    \\item Primero\n    \\item Segundo\n    \\item Tercero con \\emph{énfasis}\n\\end{itemize}";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        let list = blocks
            .iter()
            .find_map(|b| {
                if let ContentBlock::List(l) = b {
                    Some(l)
                } else {
                    None
                }
            })
            .expect("debe haber un ListBlock");
        assert!(matches!(
            list.list_type,
            crate::project::model::ListType::Itemize
        ));
        assert_eq!(list.items.len(), 3);
        assert_eq!(list.items[0], "Primero");
        assert_eq!(list.items[1], "Segundo");
        assert!(list.items[2].contains("énfasis"));
    }

    #[test]
    fn import_detecta_enumerate() {
        let tex =
            "\\chapter{C1}\n\\begin{enumerate}\n    \\item Uno\n    \\item Dos\n\\end{enumerate}";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        let list = blocks
            .iter()
            .find_map(|b| {
                if let ContentBlock::List(l) = b {
                    Some(l)
                } else {
                    None
                }
            })
            .expect("debe haber un ListBlock");
        assert!(matches!(
            list.list_type,
            crate::project::model::ListType::Enumerate
        ));
        assert_eq!(list.items.len(), 2);
    }

    #[test]
    fn import_equation_rota_no_pierde_contenido() {
        // Falta el \end{equation}: el detector NO debe consumir; debe caer a raw_latex.
        let tex = "\\chapter{C1}\nAntes.\n\\begin{equation}\n    E = mc^2\nDespués sin cerrar.";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        // Nada de Equation, todo en raw_latex (preserva contenido).
        let has_equation = blocks
            .iter()
            .any(|b| matches!(b, ContentBlock::Equation(_)));
        assert!(
            !has_equation,
            "no debe inventar un EquationBlock con entorno mal cerrado"
        );
        let raw_text: String = blocks
            .iter()
            .filter_map(|b| {
                if let ContentBlock::RawLatex(r) = b {
                    Some(r.content.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            raw_text.contains("E = mc^2"),
            "el contenido sigue presente en raw_latex"
        );
    }

    #[test]
    fn import_lista_anidada_se_preserva_como_raw() {
        // Listas anidadas son frágiles de parsear semánticamente — preferimos
        // dejarlas como raw_latex confirmado antes que romperlas.
        let tex = "\\chapter{C1}\n\\begin{itemize}\n    \\item Externo\n    \\begin{itemize}\n        \\item Interno\n    \\end{itemize}\n\\end{itemize}";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        // Aceptamos cualquiera de los dos comportamientos siempre que NO se pierda nada.
        let all_text: String = blocks
            .iter()
            .map(|b| match b {
                ContentBlock::RawLatex(r) => r.content.clone(),
                ContentBlock::List(l) => l.items.join("|"),
                _ => String::new(),
            })
            .collect::<Vec<_>>()
            .join("\n");
        assert!(all_text.contains("Externo"));
        assert!(all_text.contains("Interno"));
    }

    #[test]
    fn import_seccion_dentro_de_equation_no_se_confunde() {
        // \section dentro de un entorno equation NO debe convertirse en heading.
        let tex = "\\chapter{C1}\n\\begin{equation}\n    a = b \\\\\n    \\section{trampa}\n\\end{equation}";
        let blocks = &import_tex(tex).model.sections[0].blocks;
        let has_trap_heading = blocks
            .iter()
            .any(|b| matches!(b, ContentBlock::Heading(h) if h.content == "trampa"));
        assert!(
            !has_trap_heading,
            "el detector de heading no debe disparar dentro de equation"
        );
    }
}
