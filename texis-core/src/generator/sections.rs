// Genera los archivos .tex de cada sección del proyecto.
// Renderiza bloques de contenido a LaTeX directamente (sin templates externos en Release 0.1).

use super::labels::section_output_path;
use crate::error::{CoreError, CoreResult};
use crate::project::model::{
    AcademicLevel, CitationBlock, CitationType, ContentBlock, DocumentKind, FigureWidth,
    HeadingLevel, ListType, ProjectModel, ProjectSection, SectionPlacement, TheoremKind,
};
use crate::template::engine::TemplateEngine;
use crate::template::escape::latex_escape;
use minijinja::Value as JinjaValue;
use std::collections::HashMap;
use std::path::Path;

pub fn generate_all(
    model: &ProjectModel,
    build_dir: &Path,
    engine: &TemplateEngine,
    title_page_template: Option<&str>,
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

        let content = render_section(section, engine, model, title_page_template)?;
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

    render_section(section, engine, model, None)
}

fn render_section(
    section: &ProjectSection,
    engine: &TemplateEngine,
    model: &ProjectModel,
    title_page_template: Option<&str>,
) -> CoreResult<String> {
    // La portada se genera desde los metadatos del proyecto
    if section.element_id == "title_page" {
        return if let Some(tpl) = title_page_template {
            render_title_page_from_template(model, tpl, engine)
        } else {
            Ok(render_title_page(model))
        };
    }

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
        SectionPlacement::Body => "chapter",
        SectionPlacement::Appendix => "chapter",
        _ => "chapter*",
    }
}

/// Renderiza una secuencia de bloques con lógica de agrupación y fusión:
/// - GlossaryEntry / AcronymEntry consecutivos → un único `description` con subtítulo
/// - Párrafo seguido de cita(s) → cita fusionada al final del párrafo
fn render_blocks(blocks: &[ContentBlock]) -> String {
    let mut out = String::new();
    let mut i = 0;

    while i < blocks.len() {
        match &blocks[i] {
            ContentBlock::GlossaryEntry(_) => {
                out.push_str("\\subsection*{Términos}\n\n");
                out.push_str("\\begin{description}\n");
                while i < blocks.len() {
                    if let ContentBlock::GlossaryEntry(g) = &blocks[i] {
                        let def = if g.verbatim {
                            g.definition.clone()
                        } else {
                            latex_escape(&g.definition)
                        };
                        out.push_str(&format!(
                            "  \\item[\\textbf{{{}}}] {}\n",
                            latex_escape(&g.term),
                            def,
                        ));
                        i += 1;
                    } else {
                        break;
                    }
                }
                out.push_str("\\end{description}\n\n");
            }
            ContentBlock::AcronymEntry(_) => {
                out.push_str("\\subsection*{Acrónimos}\n\n");
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
            ContentBlock::Paragraph(p) => {
                // Los párrafos absorben las citas inmediatamente siguientes
                let text = if p.verbatim {
                    p.content.trim_end_matches('\n').to_string()
                } else {
                    latex_escape(p.content.trim_end_matches('\n'))
                };
                let mut full = text;
                i += 1;
                while i < blocks.len() {
                    if let ContentBlock::Citation(c) = &blocks[i] {
                        full.push(' ');
                        full.push_str(&render_citation_cmd(c));
                        i += 1;
                    } else {
                        break;
                    }
                }
                out.push_str(&format!("{}\n\n", full));
            }
            block => {
                out.push_str(&render_block(block));
                i += 1;
            }
        }
    }

    out
}

/// Construye el comando de cita sin newlines. Usado tanto por render_block
/// como por la fusión párrafo+cita en render_blocks.
fn render_citation_cmd(c: &CitationBlock) -> String {
    let cmd = match c.citation_type {
        CitationType::Parenthetical => "parencite",
        CitationType::Narrative => "textcite",
        CitationType::Multiple => "parencite",
        CitationType::Footnote => "footcite",
    };
    let prefix = c
        .prefix
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(latex_escape);
    let mut postnote_parts = Vec::new();
    if let Some(page) = c.page.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        postnote_parts.push(latex_escape(page));
    }
    if let Some(suffix) = c.suffix.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        postnote_parts.push(latex_escape(suffix));
    }
    let postnote = if postnote_parts.is_empty() {
        None
    } else {
        Some(postnote_parts.join(", "))
    };
    let options = match (prefix, postnote) {
        (Some(pre), Some(post)) => format!("[{}][{}]", pre, post),
        (Some(pre), None) => format!("[{}]", pre),
        (None, Some(post)) => format!("[{}]", post),
        (None, None) => String::new(),
    };
    format!("\\{}{}{{{}}}", cmd, options, c.citation_key)
}

pub(crate) fn render_block(block: &ContentBlock) -> String {
    match block {
        ContentBlock::Paragraph(p) => {
            let text = if p.verbatim {
                p.content.trim_end_matches('\n').to_string()
            } else {
                latex_escape(p.content.trim_end_matches('\n'))
            };
            format!("{}\n\n", text)
        }

        ContentBlock::Heading(h) => {
            let cmd = match h.level {
                HeadingLevel::Section => "section",
                HeadingLevel::Subsection => "subsection",
                HeadingLevel::Subsubsection => "subsubsection",
            };
            format!("\\{}{{{}}}\n\n", cmd, latex_escape(&h.content))
        }

        ContentBlock::Equation(eq) => {
            let content = eq.latex_content.trim();
            if eq.numbered {
                let label = eq.label.as_deref().unwrap_or("");
                if label.is_empty() {
                    format!("\\begin{{equation}}\n    {}\n\\end{{equation}}\n\n", content)
                } else {
                    format!(
                        "\\begin{{equation}}\n    {}\n    \\label{{{}}}\n\\end{{equation}}\n\n",
                        content, label
                    )
                }
            } else {
                format!(
                    "\\begin{{equation*}}\n    {}\n\\end{{equation*}}\n\n",
                    content
                )
            }
        }

        ContentBlock::List(l) => {
            let env = match l.list_type {
                ListType::Itemize => "itemize",
                ListType::Enumerate => "enumerate",
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
            format!("{}\n\n", render_citation_cmd(c))
        }

        ContentBlock::Figure(f) => {
            let width = match f.width {
                FigureWidth::Half => "0.5\\linewidth",
                FigureWidth::ThreeQuarters => "0.75\\linewidth",
                FigureWidth::Full => "\\linewidth",
            };
            let caption = if f.verbatim_caption {
                f.caption.clone()
            } else {
                latex_escape(&f.caption)
            };
            format!(
                "\\begin{{figure}}[htbp]\n    \\centering\n    \\includegraphics[width={}]{{../content/figures/{}}}\n    \\caption{{{}}}\n    \\label{{{}}}\n\\end{{figure}}\n\n",
                width,
                f.file,
                caption,
                f.label
            )
        }

        ContentBlock::Table(t) => {
            let n = t.headers.len();
            let caption = if t.verbatim_caption {
                t.caption.clone()
            } else {
                latex_escape(&t.caption)
            };
            let headers = t
                .headers
                .iter()
                .map(|h| if t.raw_headers { h.clone() } else { latex_escape(h) })
                .collect::<Vec<_>>()
                .join(" & ");
            let rows: String = t
                .rows
                .iter()
                .map(|row| {
                    let cells = row
                        .iter()
                        .map(|c| if t.raw_cells { c.clone() } else { latex_escape(c) })
                        .collect::<Vec<_>>()
                        .join(" & ");
                    format!("    {} \\\\\n", cells)
                })
                .collect();
            // Tablas anchas (≥5 cols o con celdas verbatim) usan adjustbox para
            // escalar automáticamente al ancho de texto sin desbordar el margen.
            let wide = n >= 5 || t.raw_cells;
            let tabular_body = format!(
                "    \\begin{{tabular}}{{{}}}\n    \\toprule\n    {} \\\\\n    \\midrule\n{}    \\bottomrule\n    \\end{{tabular}}",
                (0..n).map(|_| "l").collect::<Vec<_>>().join(" "),
                headers,
                rows,
            );
            let inner = if wide {
                format!("    \\begin{{adjustbox}}{{max width=\\linewidth}}\n{}\n    \\end{{adjustbox}}", tabular_body)
            } else {
                tabular_body
            };
            format!(
                "\\begin{{table}}[htbp]\n    \\centering\n    \\caption{{{}}}\n    \\label{{{}}}\n{}\n\\end{{table}}\n\n",
                caption,
                t.label,
                inner,
            )
        }

        ContentBlock::RawLatex(r) => {
            if !r.user_confirmed {
                "% [TeXisStudio] Bloque LaTeX directo pendiente de confirmación — no incluido.\n\n"
                    .to_string()
            } else {
                format!("{}\n\n", r.content)
            }
        }

        // ── Bloques de posgrado ────────────────────────────────────────

        // GlossaryEntry y AcronymEntry se renderizan agrupados en render_blocks.
        // Este arm sólo se llama si un bloque aparece fuera de contexto (no debería ocurrir).
        ContentBlock::GlossaryEntry(g) => {
            let def = if g.verbatim {
                g.definition.clone()
            } else {
                latex_escape(&g.definition)
            };
            format!(
                "\\begin{{description}}\n  \\item[\\textbf{{{}}}] {}\n\\end{{description}}\n\n",
                latex_escape(&g.term),
                def,
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
                opts_str, c.content
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
                TheoremKind::Theorem => "theorem",
                TheoremKind::Lemma => "lemma",
                TheoremKind::Corollary => "corollary",
                TheoremKind::Definition => "definition",
                TheoremKind::Proposition => "proposition",
                TheoremKind::Proof => "proof",
                TheoremKind::Remark => "remark",
            };
            // proof y remark son siempre no numerados en amsthm; el resto respeta la opción.
            let env = if !t.numbered && !matches!(t.kind, TheoremKind::Proof | TheoremKind::Remark)
            {
                format!("{}*", base_env)
            } else {
                base_env.to_string()
            };
            let title_opt = match &t.title {
                Some(ti) if !ti.trim().is_empty() => format!("[{}]", latex_escape(ti)),
                _ => String::new(),
            };
            let body = if t.verbatim {
                t.content.clone()
            } else {
                latex_escape(&t.content)
            };
            format!(
                "\\begin{{{}}}{}\n    {}\n\\end{{{}}}\n\n",
                env,
                title_opt,
                body,
                env
            )
        }
    }
}

// ── Portada ───────────────────────────────────────────────────────────────────

/// Renderiza la portada usando la plantilla MiniJinja del perfil.
fn render_title_page_from_template(
    model: &ProjectModel,
    template: &str,
    engine: &TemplateEngine,
) -> CoreResult<String> {
    let ctx = build_title_page_context(model);
    engine.render(template, &ctx)
}

/// Construye el contexto MiniJinja con todos los campos de portada.
/// Todos los valores de texto son strings crudos (sin escapar);
/// el template debe aplicar `| latex_escape` donde corresponda.
fn build_title_page_context(model: &ProjectModel) -> HashMap<String, JinjaValue> {
    let mut ctx: HashMap<String, JinjaValue> = HashMap::new();

    // Institución
    ctx.insert("institution_name".into(), JinjaValue::from(model.institution.name.clone()));
    ctx.insert(
        "faculty".into(),
        model.institution.faculty.as_deref().map(JinjaValue::from).unwrap_or(JinjaValue::UNDEFINED),
    );
    ctx.insert(
        "department".into(),
        model.institution.department.as_deref().map(JinjaValue::from).unwrap_or(JinjaValue::UNDEFINED),
    );
    ctx.insert("country".into(), JinjaValue::from(model.institution.country.clone()));

    // Metadata del documento
    ctx.insert("title".into(), JinjaValue::from(model.metadata.title.clone()));
    if let Some(sub) = &model.metadata.subtitle {
        ctx.insert("subtitle".into(), JinjaValue::from(sub.clone()));
    }
    ctx.insert("city".into(), JinjaValue::from(model.metadata.city.clone()));
    ctx.insert("year".into(), JinjaValue::from(model.metadata.year));
    ctx.insert("language".into(), JinjaValue::from(model.metadata.language.clone()));

    // Etiquetas computadas (localizadas al español)
    ctx.insert("degree_label".into(), JinjaValue::from(academic_level_label(&model.metadata.academic_level)));
    ctx.insert("doc_kind_label".into(), JinjaValue::from(doc_kind_label(&model.metadata.document_kind, &model.metadata.academic_level)));

    // Estudiante
    ctx.insert("author".into(), JinjaValue::from(model.student.full_name.clone()));

    // Asesores: lista de strings
    let all_advisors: Vec<&str> = if !model.student.advisors.is_empty() {
        model.student.advisors.iter().map(|s| s.as_str()).collect()
    } else {
        model.student.advisor.as_deref().into_iter().collect()
    };
    ctx.insert(
        "advisors".into(),
        JinjaValue::from(all_advisors.iter().map(|s| JinjaValue::from(*s)).collect::<Vec<_>>()),
    );
    ctx.insert(
        "advisor_label".into(),
        JinjaValue::from(if all_advisors.len() > 1 { "Directores de tesis:" } else { "Director de tesis:" }),
    );
    // Primer asesor para plantillas simples
    ctx.insert(
        "advisor".into(),
        JinjaValue::from(all_advisors.first().copied().unwrap_or("")),
    );

    // Comité: lista de objetos {name, role}
    let committee: Vec<JinjaValue> = model.student.committee.iter().map(|m| {
        let mut obj: HashMap<String, JinjaValue> = HashMap::new();
        obj.insert("name".into(), JinjaValue::from(m.full_name.clone()));
        obj.insert(
            "role".into(),
            m.role.as_deref().map(JinjaValue::from).unwrap_or(JinjaValue::UNDEFINED),
        );
        JinjaValue::from_object(texis_core_jinja_map(obj))
    }).collect();
    ctx.insert("committee".into(), JinjaValue::from(committee));

    // ORCID
    if let Some(orcid) = &model.student.orcid {
        ctx.insert("orcid".into(), JinjaValue::from(orcid.clone()));
    }

    ctx
}

/// Adaptador simple para pasar un HashMap como objeto MiniJinja.
fn texis_core_jinja_map(map: HashMap<String, JinjaValue>) -> impl minijinja::value::Object {
    TexisJinjaMap(map)
}

#[derive(Debug)]
struct TexisJinjaMap(HashMap<String, JinjaValue>);

impl minijinja::value::Object for TexisJinjaMap {
    fn get_value(self: &std::sync::Arc<Self>, key: &JinjaValue) -> Option<JinjaValue> {
        key.as_str().and_then(|k| self.0.get(k).cloned())
    }
}

fn render_title_page(model: &ProjectModel) -> String {
    let mut out = String::new();
    out.push_str("\\thispagestyle{empty}\n");
    out.push_str("\\begin{titlepage}\n");
    out.push_str("  \\centering\n");
    out.push_str("  \\vspace*{1cm}\n");
    out.push_str(&format!(
        "  {{\\scshape\\Large {}\\par}}\n",
        latex_escape(&model.institution.name)
    ));
    if let Some(fac) = &model.institution.faculty {
        out.push_str("  \\vspace{0.3cm}\n");
        out.push_str(&format!("  {{\\large {}\\par}}\n", latex_escape(fac)));
    }
    if let Some(dep) = &model.institution.department {
        out.push_str("  \\vspace{0.2cm}\n");
        out.push_str(&format!("  {{\\normalsize {}\\par}}\n", latex_escape(dep)));
    }
    out.push_str("  \\vspace{1.5cm}\n");
    out.push_str(&format!(
        "  {{\\huge\\bfseries {}\\par}}\n",
        latex_escape(&model.metadata.title)
    ));
    out.push_str("  \\vspace{1.5cm}\n");
    let kind_label = doc_kind_label(&model.metadata.document_kind, &model.metadata.academic_level);
    let level_label = academic_level_label(&model.metadata.academic_level);
    out.push_str(&format!("  {{\\large {}\\par}}\n", kind_label));
    out.push_str("  \\vspace{0.3cm}\n");
    out.push_str("  {\\normalsize que para obtener el grado de\\par}\n");
    out.push_str(&format!(
        "  {{\\normalsize\\bfseries {}\\par}}\n",
        level_label
    ));
    out.push_str("  \\vspace{1.5cm}\n");
    out.push_str("  {\\normalsize Presenta:\\par}\n");
    out.push_str("  \\vspace{0.3cm}\n");
    out.push_str(&format!(
        "  {{\\large\\bfseries {}\\par}}\n",
        latex_escape(&model.student.full_name)
    ));
    out.push_str("  \\vspace{1.5cm}\n");

    let all_advisors: Vec<&str> = if !model.student.advisors.is_empty() {
        model.student.advisors.iter().map(|s| s.as_str()).collect()
    } else {
        model.student.advisor.as_deref().into_iter().collect()
    };
    if !all_advisors.is_empty() {
        let label = if all_advisors.len() > 1 {
            "Directores de tesis:"
        } else {
            "Director de tesis:"
        };
        out.push_str(&format!("  {{\\normalsize {}\\par}}\n", label));
        out.push_str("  \\vspace{0.3cm}\n");
        for a in &all_advisors {
            out.push_str(&format!(
                "  {{\\normalsize {}\\par}}\n",
                latex_escape(a)
            ));
        }
        out.push_str("  \\vspace{1cm}\n");
    }

    out.push_str("  \\vfill\n");
    out.push_str(&format!(
        "  {{\\normalsize {}, {}\\par}}\n",
        latex_escape(&model.metadata.city),
        model.metadata.year
    ));
    out.push_str("\\end{titlepage}\n");
    out
}

fn academic_level_label(level: &AcademicLevel) -> &'static str {
    match level {
        AcademicLevel::Doctorado => "Doctorado",
        AcademicLevel::Maestria => "Maestría",
        AcademicLevel::Especialidad => "Especialidad",
        AcademicLevel::Licenciatura => "Licenciatura",
        AcademicLevel::Tecnico => "Técnico Superior",
        AcademicLevel::Bachillerato => "Bachillerato",
        AcademicLevel::Posdoctorado => "Posdoctorado",
    }
}

fn doc_kind_label(kind: &DocumentKind, level: &AcademicLevel) -> &'static str {
    match kind {
        DocumentKind::Tesis | DocumentKind::TesisPosgrado => match level {
            AcademicLevel::Doctorado => "Tesis de Doctorado",
            AcademicLevel::Maestria => "Tesis de Maestría",
            AcademicLevel::Licenciatura => "Tesis de Licenciatura",
            _ => "Tesis",
        },
        DocumentKind::Tesina => "Tesina",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{CitationBlock, CitationType, ContentBlock, RawLatexBlock};

    #[test]
    fn raw_latex_confirmado_genera_contenido() {
        let block = ContentBlock::RawLatex(RawLatexBlock {
            id: "r1".to_string(),
            content: "\\textbf{hola}".to_string(),
            user_confirmed: true,
        });
        let out = render_block(&block);
        assert!(
            out.contains("\\textbf{hola}"),
            "debe incluir el contenido LaTeX"
        );
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
        assert!(
            !out.contains("\\textbf{secreto}"),
            "NO debe incluir el contenido"
        );
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
                verbatim: false,
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g2".to_string(),
                term: "Epistemología".to_string(),
                definition: "Teoría del conocimiento.".to_string(),
                verbatim: false,
            }),
        ];
        let out = render_blocks(&blocks);
        assert_eq!(
            out.matches("\\begin{description}").count(),
            1,
            "debe haber un solo description"
        );
        assert!(out.contains("Ontología"));
        assert!(out.contains("Epistemología"));
    }

    #[test]
    fn paragraph_verbatim_no_escapa_math() {
        use crate::project::model::ParagraphBlock;
        let block = ContentBlock::Paragraph(ParagraphBlock {
            id: "p1".to_string(),
            content: "La función $f(x) = x^2$ es continua.".to_string(),
            verbatim: true,
        });
        let out = render_block(&block);
        assert!(out.contains("$f(x) = x^2$"), "math debe pasar verbatim");
        assert!(!out.contains("\\$"), "no debe escapar el signo de dólar");
    }

    #[test]
    fn paragraph_sin_verbatim_escapa_especiales() {
        use crate::project::model::ParagraphBlock;
        let block = ContentBlock::Paragraph(ParagraphBlock {
            id: "p2".to_string(),
            content: "El 100% de A&B".to_string(),
            verbatim: false,
        });
        let out = render_block(&block);
        assert!(out.contains("100\\%"));
        assert!(out.contains("A\\&B"));
    }

    #[test]
    fn citation_block_renderiza_opciones_y_salto_final() {
        let block = ContentBlock::Citation(CitationBlock {
            id: "c1".to_string(),
            citation_key: "lamport1978time".to_string(),
            citation_type: CitationType::Parenthetical,
            page: Some("558--565".to_string()),
            prefix: Some("see".to_string()),
            suffix: Some("sec. 2".to_string()),
        });
        let out = render_block(&block);
        assert_eq!(
            out,
            "\\parencite[see][558--565, sec. 2]{lamport1978time}\n\n"
        );
    }

    #[test]
    fn parrafo_absorbe_cita_siguiente() {
        use crate::project::model::ParagraphBlock;
        let blocks = vec![
            ContentBlock::Paragraph(ParagraphBlock {
                id: "p1".to_string(),
                content: "El control por modos deslizantes es robusto.".to_string(),
                verbatim: false,
            }),
            ContentBlock::Citation(CitationBlock {
                id: "c1".to_string(),
                citation_key: "slotine1991".to_string(),
                citation_type: CitationType::Parenthetical,
                page: None,
                prefix: None,
                suffix: None,
            }),
        ];
        let out = render_blocks(&blocks);
        // La cita debe quedar en la misma "línea" que el párrafo, no como párrafo aparte
        assert!(
            out.contains("robusto. \\parencite{slotine1991}"),
            "la cita debe fusionarse al final del párrafo: {}",
            out
        );
        // No debe haber doble salto entre párrafo y cita
        assert!(
            !out.contains("robusto.\n\n\\parencite"),
            "no debe haber párrafo vacío entre texto y cita"
        );
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
            verbatim: false,
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
            verbatim: false,
        });
        let out = render_block(&block);
        assert!(out.contains("\\begin{lemma*}"));
    }
}
