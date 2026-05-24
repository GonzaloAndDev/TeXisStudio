// Genera los archivos .tex de cada sección del proyecto.
// Renderiza bloques de contenido a LaTeX directamente (sin templates externos en Release 0.1).

use super::labels::section_output_path;
use crate::error::{CoreError, CoreResult};
use crate::project::model::{
    CitationType, ContentBlock, FigureWidth, HeadingLevel, ListType, ProjectModel, ProjectSection,
    SectionPlacement, TheoremKind,
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

    if let Some(title) = &section.title {
        let cmd = chapter_command(section);
        out.push_str(&format!("\\{}{{{}}}\n\n", cmd, latex_escape(title)));
    }

    out.push_str(&render_blocks(&section.blocks));

    Ok(out)
}

fn chapter_command(section: &ProjectSection) -> &'static str {
    match section.placement {
        SectionPlacement::Body     => "chapter",
        SectionPlacement::Appendix => "chapter",
        _                          => "chapter*",
    }
}

/// Renderiza una secuencia de bloques, agrupando entradas de glosario/acrónimos consecutivas
/// en un único entorno `description` para que el espaciado LaTeX sea correcto.
fn render_blocks(blocks: &[ContentBlock]) -> String {
    let mut out = String::new();
    let mut i = 0;

    while i < blocks.len() {
        match &blocks[i] {
            ContentBlock::GlossaryEntry(_) => {
                out.push_str("\\begin{description}\n");
                while i < blocks.len() {
                    if let ContentBlock::GlossaryEntry(g) = &blocks[i] {
                        out.push_str(&format!(
                            "  \\item[\\textbf{{{}}}] {}\n",
                            latex_escape(&g.term),
                            latex_escape(&g.definition)
                        ));
                        i += 1;
                    } else {
                        break;
                    }
                }
                out.push_str("\\end{description}\n\n");
            }
            ContentBlock::AcronymEntry(_) => {
                out.push_str("\\begin{description}\n");
                while i < blocks.len() {
                    if let ContentBlock::AcronymEntry(a) = &blocks[i] {
                        let extra = match &a.description {
                            Some(d) if !d.trim().is_empty() => {
                                format!(". {}", latex_escape(d))
                            }
                            _ => String::new(),
                        };
                        out.push_str(&format!(
                            "  \\item[\\textbf{{{}}}] {}{}\n",
                            latex_escape(&a.acronym),
                            latex_escape(&a.full_form),
                            extra
                        ));
                        i += 1;
                    } else {
                        break;
                    }
                }
                out.push_str("\\end{description}\n\n");
            }
            block => {
                out.push_str(&render_block(block));
                i += 1;
            }
        }
    }

    out
}

pub(crate) fn render_block(block: &ContentBlock) -> String {
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
            if !r.user_confirmed {
                "% [TeXisStudio] Bloque LaTeX directo pendiente de confirmación — no incluido.\n\n".to_string()
            } else {
                format!("{}\n\n", r.content)
            }
        }

        // ── Bloques de posgrado ────────────────────────────────────────

        // GlossaryEntry y AcronymEntry se renderizan agrupados en render_blocks.
        // Este arm sólo se llama si un bloque aparece fuera de contexto (no debería ocurrir).
        ContentBlock::GlossaryEntry(g) => {
            format!(
                "\\begin{{description}}\n  \\item[\\textbf{{{}}}] {}\n\\end{{description}}\n\n",
                latex_escape(&g.term),
                latex_escape(&g.definition)
            )
        }

        ContentBlock::AcronymEntry(a) => {
            let extra = match &a.description {
                Some(d) if !d.trim().is_empty() => format!(". {}", latex_escape(d)),
                _ => String::new(),
            };
            format!(
                "\\begin{{description}}\n  \\item[\\textbf{{{}}}] {}{}\n\\end{{description}}\n\n",
                latex_escape(&a.acronym),
                latex_escape(&a.full_form),
                extra
            )
        }

        ContentBlock::Code(c) => {
            let mut opts: Vec<String> = Vec::new();
            if !c.language.is_empty() {
                opts.push(format!("language={}", c.language));
            }
            if c.show_line_numbers {
                opts.push("numbers=left".to_string());
            }
            if let Some(cap) = &c.caption {
                if !cap.is_empty() {
                    opts.push(format!("caption={{{}}}", latex_escape(cap)));
                }
            }
            if let Some(lbl) = &c.label {
                if !lbl.is_empty() {
                    opts.push(format!("label={{{}}}", lbl));
                }
            }
            let opts_str = if opts.is_empty() {
                String::new()
            } else {
                format!("[{}]", opts.join(", "))
            };
            // El contenido de lstlisting es verbatim — NO pasar por latex_escape.
            format!(
                "\\begin{{lstlisting}}{}\n{}\n\\end{{lstlisting}}\n\n",
                opts_str,
                c.content
            )
        }

        ContentBlock::Algorithm(a) => {
            let label_line = match &a.label {
                Some(l) if !l.is_empty() => format!("\\label{{{}}}\n", l),
                _ => String::new(),
            };
            let input_line = match &a.input {
                Some(inp) if !inp.trim().is_empty() => {
                    format!("\\Require {}\n", latex_escape(inp))
                }
                _ => String::new(),
            };
            let output_line = match &a.output {
                Some(out) if !out.trim().is_empty() => {
                    format!("\\Ensure {}\n", latex_escape(out))
                }
                _ => String::new(),
            };
            let body_lines: String = a
                .body
                .lines()
                .filter(|l| !l.trim().is_empty())
                .map(|line| format!("    \\State {}\n", latex_escape(line.trim())))
                .collect();
            format!(
                "\\begin{{algorithm}}[H]\n\\caption{{{}}}\n{}\\begin{{algorithmic}}[1]\n{}{}{}\\end{{algorithmic}}\n\\end{{algorithm}}\n\n",
                latex_escape(&a.caption),
                label_line,
                input_line,
                output_line,
                body_lines
            )
        }

        ContentBlock::Theorem(t) => {
            let base_env = match t.kind {
                TheoremKind::Theorem    => "theorem",
                TheoremKind::Lemma      => "lemma",
                TheoremKind::Corollary  => "corollary",
                TheoremKind::Definition => "definition",
                TheoremKind::Proposition => "proposition",
                TheoremKind::Proof      => "proof",
                TheoremKind::Remark     => "remark",
            };
            // proof y remark son siempre no numerados en amsthm; el resto respeta la opción.
            let env = if !t.numbered && !matches!(t.kind, TheoremKind::Proof | TheoremKind::Remark) {
                format!("{}*", base_env)
            } else {
                base_env.to_string()
            };
            let title_opt = match &t.title {
                Some(ti) if !ti.trim().is_empty() => format!("[{}]", latex_escape(ti)),
                _ => String::new(),
            };
            format!(
                "\\begin{{{}}}{}\n    {}\n\\end{{{}}}\n\n",
                env,
                title_opt,
                latex_escape(&t.content),
                env
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{RawLatexBlock, ContentBlock};

    #[test]
    fn raw_latex_confirmado_genera_contenido() {
        let block = ContentBlock::RawLatex(RawLatexBlock {
            id: "r1".to_string(),
            content: "\\textbf{hola}".to_string(),
            user_confirmed: true,
        });
        let out = render_block(&block);
        assert!(out.contains("\\textbf{hola}"), "debe incluir el contenido LaTeX");
        assert!(!out.contains("pendiente"), "no debe tener advertencia");
    }

    #[test]
    fn raw_latex_sin_confirmar_genera_comentario_no_contenido() {
        let block = ContentBlock::RawLatex(RawLatexBlock {
            id: "r2".to_string(),
            content: "\\textbf{secreto}".to_string(),
            user_confirmed: false,
        });
        let out = render_block(&block);
        assert!(!out.contains("\\textbf{secreto}"), "NO debe incluir el contenido");
        assert!(out.starts_with('%'), "debe comenzar con comentario LaTeX");
    }

    #[test]
    fn glossary_entries_se_agrupan_en_description() {
        use crate::project::model::GlossaryEntryBlock;
        let blocks = vec![
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g1".to_string(),
                term: "Ontología".to_string(),
                definition: "Rama de la filosofía que estudia el ser.".to_string(),
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g2".to_string(),
                term: "Epistemología".to_string(),
                definition: "Teoría del conocimiento.".to_string(),
            }),
        ];
        let out = render_blocks(&blocks);
        assert_eq!(out.matches("\\begin{description}").count(), 1, "debe haber un solo description");
        assert!(out.contains("Ontología"));
        assert!(out.contains("Epistemología"));
    }

    #[test]
    fn code_block_genera_lstlisting() {
        use crate::project::model::CodeBlock;
        let block = ContentBlock::Code(CodeBlock {
            id: "c1".to_string(),
            language: "Python".to_string(),
            caption: Some("Ejemplo".to_string()),
            label: Some("lst:ejemplo".to_string()),
            content: "print('hola')".to_string(),
            show_line_numbers: true,
        });
        let out = render_block(&block);
        assert!(out.contains("\\begin{lstlisting}"));
        assert!(out.contains("language=Python"));
        assert!(out.contains("numbers=left"));
        assert!(out.contains("print('hola')"));
    }

    #[test]
    fn theorem_numerado_usa_entorno_sin_asterisco() {
        use crate::project::model::{TheoremBlock, TheoremKind};
        let block = ContentBlock::Theorem(TheoremBlock {
            id: "t1".to_string(),
            kind: TheoremKind::Theorem,
            title: Some("Pitágoras".to_string()),
            content: "En un triángulo rectángulo...".to_string(),
            numbered: true,
        });
        let out = render_block(&block);
        assert!(out.contains("\\begin{theorem}[Pit"));
        assert!(!out.contains("theorem*"));
    }

    #[test]
    fn theorem_no_numerado_usa_asterisco() {
        use crate::project::model::{TheoremBlock, TheoremKind};
        let block = ContentBlock::Theorem(TheoremBlock {
            id: "t2".to_string(),
            kind: TheoremKind::Lemma,
            title: None,
            content: "Contenido del lema.".to_string(),
            numbered: false,
        });
        let out = render_block(&block);
        assert!(out.contains("\\begin{lemma*}"));
    }
}
