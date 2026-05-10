// Genera los archivos .tex de cada sección del proyecto.
// Renderiza bloques de contenido a LaTeX directamente (sin templates externos en Release 0.1).

use super::labels::section_output_path;
use crate::error::{CoreError, CoreResult};
use crate::project::model::{
    CitationType, ContentBlock, FigureWidth, HeadingLevel, ListType, ProjectModel, ProjectSection,
    SectionPlacement,
};
use crate::template::engine::TemplateEngine;
use crate::template::escape::latex_escape;
use std::path::Path;

pub fn generate_all(
    model: &ProjectModel,
    build_dir: &Path,
    engine: &TemplateEngine,
) -> CoreResult<()> {
    let mut body_idx = 0usize;

    for section in &model.sections {
        if !section.enabled {
            continue;
        }

        // Calcular índice de secciones body antes de decidir si se salta
        let current_body_idx = body_idx;
        if matches!(section.placement, SectionPlacement::Body) {
            body_idx += 1;
        }

        let rel_path = match section_output_path(section, current_body_idx) {
            Some(p) => p,
            None => continue, // inline en main.tex
        };

        let content = render_section(section, engine)?;
        let file_path = build_dir.join(&rel_path);

        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent).map_err(CoreError::Io)?;
        }
        std::fs::write(&file_path, &content).map_err(CoreError::Io)?;
    }

    Ok(())
}

/// Renderiza una sección por su ID. Usado en tests sin escribir a disco.
pub fn render_section_to_string(
    model: &ProjectModel,
    section_id: &str,
    engine: &TemplateEngine,
) -> CoreResult<String> {
    let section = model
        .sections
        .iter()
        .find(|s| s.id == section_id)
        .ok_or_else(|| CoreError::InvalidProject {
            message: format!("sección '{}' no encontrada", section_id),
        })?;

    render_section(section, engine)
}

fn render_section(section: &ProjectSection, _engine: &TemplateEngine) -> CoreResult<String> {
    let mut out = String::new();

    // Encabezado de capítulo según placement
    if let Some(title) = &section.title {
        let cmd = chapter_command(section);
        out.push_str(&format!("\\{}{{{}}}\n\n", cmd, latex_escape(title)));
    }

    // Renderizar bloques
    for block in &section.blocks {
        out.push_str(&render_block(block));
    }

    Ok(out)
}

fn chapter_command(section: &ProjectSection) -> &'static str {
    match section.placement {
        SectionPlacement::Body     => "chapter",
        SectionPlacement::Appendix => "chapter",
        _                          => "chapter*",
    }
}

fn render_block(block: &ContentBlock) -> String {
    match block {
        ContentBlock::Paragraph(p) => {
            format!("{}\n\n", latex_escape(&p.content))
        }

        ContentBlock::Heading(h) => {
            let cmd = match h.level {
                HeadingLevel::Section       => "section",
                HeadingLevel::Subsection    => "subsection",
                HeadingLevel::Subsubsection => "subsubsection",
            };
            format!("\\{}{{{}}}\n\n", cmd, latex_escape(&h.content))
        }

        ContentBlock::Equation(eq) => {
            if eq.numbered {
                let label = eq.label.as_deref().unwrap_or("");
                if label.is_empty() {
                    format!("\\begin{{equation}}\n    {}\n\\end{{equation}}\n\n", eq.latex_content)
                } else {
                    format!(
                        "\\begin{{equation}}\n    {}\n    \\label{{{}}}\n\\end{{equation}}\n\n",
                        eq.latex_content, label
                    )
                }
            } else {
                format!(
                    "\\begin{{equation*}}\n    {}\n\\end{{equation*}}\n\n",
                    eq.latex_content
                )
            }
        }

        ContentBlock::List(l) => {
            let env = match l.list_type {
                ListType::Itemize    => "itemize",
                ListType::Enumerate  => "enumerate",
                ListType::Description => "description",
            };
            let items: String = l
                .items
                .iter()
                .map(|item| format!("    \\item {}\n", latex_escape(item)))
                .collect();
            format!("\\begin{{{}}}\n{}\\end{{{}}}\n\n", env, items, env)
        }

        ContentBlock::Citation(c) => {
            let cmd = match c.citation_type {
                CitationType::Parenthetical => "parencite",
                CitationType::Narrative     => "textcite",
                CitationType::Multiple      => "parencite",
                CitationType::Footnote      => "footcite",
            };
            let page_opt = c
                .page
                .as_deref()
                .map(|p| format!("[{{}}][{}]", p))
                .unwrap_or_default();
            format!("\\{}{}{{{}}}", cmd, page_opt, c.citation_key)
        }

        ContentBlock::Figure(f) => {
            let width = match f.width {
                FigureWidth::Half          => "0.5\\linewidth",
                FigureWidth::ThreeQuarters => "0.75\\linewidth",
                FigureWidth::Full          => "\\linewidth",
            };
            format!(
                "\\begin{{figure}}[htbp]\n    \\centering\n    \\includegraphics[width={}]{{../content/figures/{}}}\n    \\caption{{{}}}\n    \\label{{{}}}\n\\end{{figure}}\n\n",
                width,
                f.file,
                latex_escape(&f.caption),
                f.label
            )
        }

        ContentBlock::Table(t) => {
            let col_spec = (0..t.headers.len()).map(|_| "l").collect::<Vec<_>>().join(" ");
            let headers = t
                .headers
                .iter()
                .map(|h| latex_escape(h))
                .collect::<Vec<_>>()
                .join(" & ");
            let rows: String = t
                .rows
                .iter()
                .map(|row| {
                    let cells = row
                        .iter()
                        .map(|c| latex_escape(c))
                        .collect::<Vec<_>>()
                        .join(" & ");
                    format!("    {} \\\\\n", cells)
                })
                .collect();
            format!(
                "\\begin{{table}}[htbp]\n    \\centering\n    \\caption{{{}}}\n    \\label{{{}}}\n    \\begin{{tabular}}{{{}}}\n    \\toprule\n    {} \\\\\n    \\midrule\n{}    \\bottomrule\n    \\end{{tabular}}\n\\end{{table}}\n\n",
                latex_escape(&t.caption),
                t.label,
                col_spec,
                headers,
                rows
            )
        }

        ContentBlock::RawLatex(r) => {
            format!("{}\n\n", r.content)
        }
    }
}
