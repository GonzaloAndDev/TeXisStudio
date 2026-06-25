//! Backend de render LaTeX (§8.2): primer `RenderBackend`.
//!
//! Etapa B: produce un `main.tex` estructuralmente válido (preámbulo ensamblado,
//! fases en orden canónico, includes) y un render **básico pero fiel** de los
//! nodos. La fidelidad profunda por módulo llega en las Etapas C–G; este backend
//! se extiende, no se reemplaza. No toca el generador legacy de producción.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use texis_document_contracts::capabilities::{Capability, CapabilitySet};
use texis_document_contracts::ids::AssetId;
use texis_document_domain::backend::{
    BackendCapabilities, RenderBackend, RenderedDocument, RenderedFile,
};
use texis_document_domain::ir::body_node::*;
use texis_document_domain::ir::modules::*;
use texis_document_domain::ir::DocumentIR;
use texis_document_domain::phase::DocumentPhase;
use texis_document_domain::plan::DocumentPlan;

#[derive(Default)]
pub struct LatexRenderBackend;

impl LatexRenderBackend {
    pub fn new() -> Self {
        Self
    }
}

impl RenderBackend for LatexRenderBackend {
    fn capabilities(&self) -> BackendCapabilities {
        let caps: CapabilitySet = [
            "render.cover",
            "render.preliminaries",
            "render.indexes",
            "render.body",
            "render.appendices",
            "render.bibliography.biblatex",
            "render.plugin_artifact",
            "font.custom",
            "engine.xelatex",
            "engine.lualatex",
            "engine.pdflatex",
        ]
        .into_iter()
        .map(Capability::new)
        .collect();
        BackendCapabilities {
            capabilities: caps,
            backend_id: "latex".to_string(),
        }
    }

    fn render_document(&self, ir: &DocumentIR, plan: &DocumentPlan) -> RenderedDocument {
        let assets = AssetLookup::new(ir);
        let mut files = Vec::new();

        files.push(RenderedFile {
            relative_path: "preamble.tex".to_string(),
            content: render_preamble(ir, plan),
        });

        let active: Vec<DocumentPhase> = plan.phases.iter().map(|p| p.phase).collect();

        for phase in &active {
            let (path, content) = match phase {
                DocumentPhase::Cover => ("sections/cover.tex", render_cover(&ir.cover)),
                DocumentPhase::Preliminaries => (
                    "sections/preliminaries.tex",
                    render_preliminaries(&ir.preliminaries, &assets),
                ),
                DocumentPhase::Indexes => ("sections/indexes.tex", render_indexes(&ir.indexes)),
                DocumentPhase::MainMatter => ("sections/body.tex", render_body(&ir.body, &assets)),
                DocumentPhase::Appendices => (
                    "sections/appendices.tex",
                    render_appendices(&ir.appendices, &assets),
                ),
                DocumentPhase::BackMatter => {
                    ("sections/bibliography.tex", render_back_matter(ir, &assets))
                }
            };
            files.push(RenderedFile {
                relative_path: path.to_string(),
                content,
            });
        }

        // references.bib: SOLO entradas reales del IR. Nunca se sintetizan
        // fuentes: una cita sin entrada es un error de validación (BIB-001), no
        // una referencia inventada.
        let diagnostics = Vec::new();
        if !ir.bibliography.style.is_empty() {
            files.push(RenderedFile {
                relative_path: "references.bib".to_string(),
                content: render_bib_file(ir),
            });
        }

        files.push(RenderedFile {
            relative_path: "main.tex".to_string(),
            content: render_main(ir, &active),
        });

        RenderedDocument { files, diagnostics }
    }
}

// ── Búsqueda de assets por id ──────────────────────────────────────────────

struct AssetLookup<'a> {
    by_id: BTreeMap<&'a str, &'a str>,
}

impl<'a> AssetLookup<'a> {
    fn new(ir: &'a DocumentIR) -> Self {
        let by_id = ir
            .resources
            .assets
            .iter()
            .map(|a| (a.id.as_str(), a.relative_path.as_str()))
            .collect();
        Self { by_id }
    }

    fn path(&self, id: &AssetId) -> &str {
        self.by_id.get(id.as_str()).copied().unwrap_or("MISSING")
    }
}

// ── Preámbulo ──────────────────────────────────────────────────────────────

fn render_preamble(ir: &DocumentIR, plan: &DocumentPlan) -> String {
    let p = &ir.profile;
    let mut s = String::new();
    s.push_str("% Generado por el núcleo documental nuevo (Etapa B). No editar a mano.\n");

    let opts = if p.document_class_options.is_empty() {
        String::new()
    } else {
        format!("[{}]", p.document_class_options.join(","))
    };
    let _ = writeln!(s, "\\documentclass{}{{{}}}", opts, p.document_class);

    let uses_fontspec = matches!(p.engine.as_str(), "xelatex" | "lualatex");

    for pkg in &plan.packages.packages {
        match pkg.name.as_str() {
            // biblatex se emite con estilo/backend resueltos más abajo.
            "biblatex" => {}
            // geometry se emite con la geometría resuelta más abajo.
            "geometry" => {}
            _ => {
                if pkg.options.is_empty() {
                    let _ = writeln!(s, "\\usepackage{{{}}}", pkg.name);
                } else {
                    let _ = writeln!(s, "\\usepackage[{}]{{{}}}", pkg.options.join(","), pkg.name);
                }
            }
        }
    }

    // Geometría.
    let g = &p.page_geometry;
    let mut geo = vec![format!("{}paper", g.paper)];
    if let Some(m) = g.margin_left {
        geo.push(format!("left={m}"));
    }
    if let Some(m) = g.margin_right {
        geo.push(format!("right={m}"));
    }
    if let Some(m) = g.margin_top {
        geo.push(format!("top={m}"));
    }
    if let Some(m) = g.margin_bottom {
        geo.push(format!("bottom={m}"));
    }
    let _ = writeln!(s, "\\usepackage[{}]{{geometry}}", geo.join(","));

    // `caption`: leyendas consistentes y compatible con el sistema de hooks del
    // kernel LaTeX (necesario antes de biblatex para estilos como apa, que de lo
    // contrario fallan al parchear \@makecaption).
    let _ = writeln!(s, "\\usepackage{{caption}}");

    // Fuentes (solo motores Unicode).
    if uses_fontspec {
        if let Some(f) = &p.typography.main_font {
            let _ = writeln!(s, "\\setmainfont{{{f}}}");
        }
        if let Some(f) = &p.typography.sans_font {
            let _ = writeln!(s, "\\setsansfont{{{f}}}");
        }
        if let Some(f) = &p.typography.mono_font {
            let _ = writeln!(s, "\\setmonofont{{{f}}}");
        }
    }

    // Bibliografía (biblatex con estilo/backend resueltos).
    if !ir.bibliography.style.is_empty() {
        let backend = match ir.bibliography.backend {
            Some(BibliographyBackend::Biber) => "biber",
            Some(BibliographyBackend::Bibtex) => "bibtex",
            None => "biber",
        };
        let _ = writeln!(
            s,
            "\\usepackage[style={},backend={}]{{biblatex}}",
            texis_document_domain::bib_styles::biblatex_style(&ir.bibliography.style),
            backend
        );
        // Recurso bibliográfico normalizado y generado de forma autocontenida.
        // `sources` conserva provenance; no se vuelve a incluir para evitar
        // duplicar claves ni depender de rutas externas durante la entrega.
        let _ = writeln!(s, "\\addbibresource{{references.bib}}");
    }

    // Metadatos PDF.
    let _ = writeln!(
        s,
        "\\usepackage{{hyperref}}\n\\hypersetup{{pdftitle={{{}}},pdfauthor={{{}}}}}",
        escape(&ir.metadata.title),
        escape(
            ir.cover
                .authors
                .first()
                .map(|a| a.full_name.as_str())
                .unwrap_or("")
        )
    );

    s
}

// ── main.tex ───────────────────────────────────────────────────────────────

fn render_main(ir: &DocumentIR, active: &[DocumentPhase]) -> String {
    let is_book = ir.profile.document_class == "book" || ir.profile.document_class == "report";
    let mut s = String::new();
    s.push_str("\\input{preamble}\n\\begin{document}\n");

    let has_front = active
        .iter()
        .any(|p| matches!(p, DocumentPhase::Preliminaries | DocumentPhase::Indexes));

    if is_book && has_front {
        s.push_str("\\frontmatter\n");
    }
    let mut main_started = false;
    let mut appendix_started = false;

    for phase in active {
        match phase {
            DocumentPhase::Cover => s.push_str("\\input{sections/cover}\n"),
            DocumentPhase::Preliminaries => s.push_str("\\input{sections/preliminaries}\n"),
            DocumentPhase::Indexes => s.push_str("\\input{sections/indexes}\n"),
            DocumentPhase::MainMatter => {
                if is_book {
                    s.push_str("\\mainmatter\n");
                    main_started = true;
                }
                s.push_str("\\input{sections/body}\n");
            }
            DocumentPhase::Appendices => {
                if is_book && !main_started {
                    s.push_str("\\mainmatter\n");
                    main_started = true;
                }
                s.push_str("\\appendix\n");
                appendix_started = true;
                s.push_str("\\input{sections/appendices}\n");
            }
            DocumentPhase::BackMatter => {
                let _ = appendix_started;
                s.push_str("\\input{sections/bibliography}\n");
            }
        }
    }

    s.push_str("\\end{document}\n");
    s
}

// ── Fases ──────────────────────────────────────────────────────────────────

fn render_cover(c: &CoverDocument) -> String {
    let mut s = String::from("\\begin{titlepage}\n\\centering\n");
    let _ = writeln!(s, "{{\\large {}}}\\\\[0.5cm]", escape(&c.institution.name));
    if let Some(f) = &c.institution.faculty {
        let _ = writeln!(s, "{{{}}}\\\\[1cm]", escape(f));
    }
    let _ = writeln!(s, "\\vfill\n{{\\Huge {}}}\\\\[0.5cm]", escape(&c.title));
    if let Some(sub) = &c.subtitle {
        let _ = writeln!(s, "{{\\Large {}}}\\\\[1cm]", escape(sub));
    }
    s.push_str("\\vfill\n");
    for a in &c.authors {
        let _ = writeln!(s, "{{\\large {}}}\\\\", escape(&a.full_name));
    }
    for auth in &c.authorities {
        let role = match auth.role {
            AuthorityRole::Advisor => "Asesor",
            AuthorityRole::CoAdvisor => "Co-asesor",
            AuthorityRole::CommitteeMember => "Comité",
        };
        let _ = writeln!(s, "{}: {}\\\\", role, escape(&auth.full_name));
    }
    let _ = writeln!(s, "\\vfill\n{} --- {}\n", escape(&c.city), c.year);
    s.push_str("\\end{titlepage}\n");

    // Página de firmas (acta) si el documento la requiere (§7.1).
    if !c.signatures.is_empty() {
        s.push_str("\\thispagestyle{empty}\n\\begin{center}\n");
        s.push_str("{\\large Acta de aprobación}\\\\[2cm]\n");
        s.push_str("\\end{center}\n");
        for sig in &c.signatures {
            let _ = writeln!(
                s,
                "\\vspace{{1.5cm}}\\noindent\\rule{{6cm}}{{0.4pt}}\\\\\n{} \\textit{{({})}}\\\\\n",
                escape(&sig.full_name),
                escape(&sig.role)
            );
        }
        s.push_str("\\clearpage\n");
    }
    s
}

fn render_preliminaries(doc: &PreliminariesDocument, assets: &AssetLookup) -> String {
    let mut s = String::new();
    for item in &doc.items {
        let title = item
            .title
            .languages()
            .next()
            .and_then(|l| {
                item.title
                    .get(&texis_document_contracts::locale::LanguageTag::new(l))
            })
            .unwrap_or("");
        if !title.is_empty() {
            let _ = writeln!(s, "\\chapter*{{{}}}", escape(title));
        }
        s.push_str(&render_nodes(&item.nodes, assets));
    }
    s
}

fn render_indexes(doc: &IndexesDocument) -> String {
    let mut s = String::new();
    for list in &doc.lists {
        if !list.enabled {
            continue;
        }
        let cmd = match list.kind {
            IndexKind::TableOfContents => "\\tableofcontents",
            IndexKind::ListOfFigures => "\\listoffigures",
            IndexKind::ListOfTables => "\\listoftables",
            IndexKind::ListOfAlgorithms => "\\listofalgorithms",
            IndexKind::ListOfCode => "\\lstlistoflistings",
        };
        let _ = writeln!(s, "{cmd}");
    }
    s
}

fn render_body(doc: &BodyDocument, assets: &AssetLookup) -> String {
    let mut s = String::new();
    for section in &doc.sections {
        render_section(section, 0, "chapter", assets, &mut s);
    }
    s
}

fn render_appendices(doc: &AppendicesDocument, assets: &AssetLookup) -> String {
    let mut s = String::new();
    for a in &doc.appendices {
        if let Some(t) = &a.title {
            let _ = writeln!(s, "\\chapter{{{}}}", escape(t));
        }
        if let Some(l) = &a.label {
            let _ = writeln!(s, "\\label{{{}}}", l);
        }
        s.push_str(&render_nodes(&a.nodes, assets));
        for child in &a.children {
            render_section(child, 1, "chapter", assets, &mut s);
        }
    }
    s
}

/// Materia final: secciones no bibliográficas (glosario editorial, nomenclatura,
/// cierre) seguidas de la bibliografía.
fn render_back_matter(ir: &DocumentIR, assets: &AssetLookup) -> String {
    let mut s = String::new();
    for section in &ir.back_matter.sections {
        render_section(section, 0, "chapter", assets, &mut s);
    }
    if !ir.bibliography.style.is_empty() {
        s.push_str("\\printbibliography\n");
    }
    s
}

// ── Secciones y nodos ──────────────────────────────────────────────────────

fn render_section(
    section: &BodySection,
    depth: usize,
    top_cmd: &str,
    assets: &AssetLookup,
    out: &mut String,
) {
    let cmd = match depth {
        0 => top_cmd,
        1 => "section",
        2 => "subsection",
        _ => "subsubsection",
    };
    if let Some(title) = &section.title {
        let _ = writeln!(out, "\\{}{{{}}}", cmd, escape(title));
    }
    if let Some(label) = &section.label {
        let _ = writeln!(out, "\\label{{{}}}", label);
    }
    out.push_str(&render_nodes(&section.nodes, assets));
    for child in &section.children {
        render_section(child, depth + 1, top_cmd, assets, out);
    }
}

fn render_nodes(nodes: &[BodyNode], assets: &AssetLookup) -> String {
    let mut s = String::new();
    for node in nodes {
        render_node(node, assets, &mut s);
    }
    s
}

fn render_node(node: &BodyNode, assets: &AssetLookup, out: &mut String) {
    match node {
        BodyNode::Paragraph(p) => {
            let _ = writeln!(out, "{}\n", text(&p.content));
        }
        BodyNode::Heading(h) => {
            let cmd = match h.level {
                HeadingLevel::Section => "section",
                HeadingLevel::Subsection => "subsection",
                HeadingLevel::Subsubsection => "subsubsection",
            };
            let _ = writeln!(out, "\\{}{{{}}}", cmd, escape(&h.text));
        }
        BodyNode::Figure(f) => {
            let width = match f.width {
                FigureWidth::Half => "0.5",
                FigureWidth::ThreeQuarters => "0.75",
                FigureWidth::Full => "1.0",
            };
            let _ = writeln!(
                out,
                "\\begin{{figure}}[htbp]\n\\centering\n\\includegraphics[width={}\\textwidth]{{{}}}\n\\caption{{{}}}\n\\label{{{}}}\n\\end{{figure}}",
                width,
                assets.path(&f.asset),
                text(&f.caption),
                f.label
            );
        }
        BodyNode::Table(t) => {
            let cols = "l".repeat(t.headers.len().max(1));
            let _ = writeln!(
                out,
                "\\begin{{table}}[htbp]\n\\centering\n\\begin{{tabular}}{{{}}}",
                cols
            );
            let header: Vec<String> = t.headers.iter().map(text).collect();
            let _ = writeln!(out, "{} \\\\ \\hline", header.join(" & "));
            for row in &t.rows {
                let cells: Vec<String> = row.iter().map(text).collect();
                let _ = writeln!(out, "{} \\\\", cells.join(" & "));
            }
            let _ = writeln!(
                out,
                "\\end{{tabular}}\n\\caption{{{}}}\n\\label{{{}}}\n\\end{{table}}",
                text(&t.caption),
                t.label
            );
        }
        BodyNode::Equation(e) => {
            if e.numbered {
                let label = e
                    .label
                    .as_ref()
                    .map(|l| format!("\\label{{{l}}}"))
                    .unwrap_or_default();
                let _ = writeln!(
                    out,
                    "\\begin{{equation}}{}\n{}\n\\end{{equation}}",
                    label, e.latex
                );
            } else {
                let _ = writeln!(out, "\\[\n{}\n\\]", e.latex);
            }
        }
        BodyNode::List(l) => {
            let env = match l.kind {
                ListKind::Itemize => "itemize",
                ListKind::Enumerate => "enumerate",
                ListKind::Description => "description",
            };
            let _ = writeln!(out, "\\begin{{{env}}}");
            for item in &l.items {
                let _ = writeln!(out, "\\item {}", escape(item));
            }
            let _ = writeln!(out, "\\end{{{env}}}");
        }
        BodyNode::Theorem(t) => {
            let env = format!("{:?}", t.kind).to_lowercase();
            let _ = writeln!(
                out,
                "\\begin{{{env}}}\n{}\n\\end{{{env}}}",
                text(&t.content)
            );
        }
        BodyNode::CodeListing(c) => {
            let _ = writeln!(
                out,
                "\\begin{{lstlisting}}[language={}]\n{}\n\\end{{lstlisting}}",
                c.language, c.content
            );
        }
        BodyNode::Algorithm(a) => {
            let _ = writeln!(
                out,
                "\\begin{{algorithm}}\n\\caption{{{}}}\n{}\n\\end{{algorithm}}",
                escape(&a.caption),
                a.body
            );
        }
        BodyNode::Citation(c) => {
            let _ = writeln!(out, "\\cite{{{}}}", c.citation_key);
        }
        BodyNode::CrossReference(r) => {
            let _ = writeln!(out, "\\ref{{{}}}", r.target_label);
        }
        BodyNode::GlossaryEntry(g) => {
            let _ = writeln!(
                out,
                "\\newglossaryentry{{{}}}{{name={{{}}},description={{{}}}}}",
                slug(&g.term),
                escape(&g.term),
                text(&g.definition)
            );
        }
        BodyNode::AcronymEntry(a) => {
            let _ = writeln!(
                out,
                "\\newacronym{{{}}}{{{}}}{{{}}}",
                slug(&a.acronym),
                escape(&a.acronym),
                escape(&a.full_form)
            );
        }
        BodyNode::PluginContribution(p) => {
            // Frontera de seguridad: el artefacto SOLO se inserta si está saneado.
            // Si contiene \usepackage o un constructo prohibido, se rechaza con un
            // marcador visible (la validación ya emitió PLUGIN-003/004 bloqueante).
            let unsafe_construct =
                texis_document_domain::validation::body::plugin_artifact_violation(
                    &p.artifact_latex,
                )
                .is_some();
            if unsafe_construct {
                let _ = writeln!(
                    out,
                    "% [plugin:{}] artefacto rechazado por la frontera de seguridad",
                    p.plugin_id
                );
            } else {
                out.push_str(&p.artifact_latex);
                out.push('\n');
            }
        }
        BodyNode::Visual(v) => {
            if let Some(ov) = &v.advanced_override {
                out.push_str(ov);
                out.push('\n');
            } else {
                let _ = writeln!(
                    out,
                    "% [visual:{}] render semántico pendiente (Etapa E)",
                    v.kind
                );
            }
        }
        BodyNode::TrustedRawLatex(r) => {
            // Escape hatch explícito y auditable (§7.4).
            out.push_str(&r.content);
            out.push('\n');
        }
    }
}

// ── Bibliografía (.bib) ─────────────────────────────────────────────────────

/// Renderiza `references.bib` SOLO con las entradas reales del IR. Nunca crea
/// entradas para citas sin resolver: eso es un error de validación (BIB-001), no
/// una fuente inventada.
fn render_bib_file(ir: &DocumentIR) -> String {
    use std::collections::BTreeSet;
    let mut out = String::from("% Generado por el núcleo documental. No editar a mano.\n");
    let mut written: BTreeSet<String> = BTreeSet::new();

    for e in &ir.bibliography.entries {
        if written.insert(e.key.clone()) {
            let _ = writeln!(out, "@{}{{{},", e.entry_type, e.key);
            for (k, v) in &e.fields {
                let _ = writeln!(out, "  {k} = {{{v}}},");
            }
            out.push_str("}\n");
        }
    }
    out
}

// ── Utilidades ─────────────────────────────────────────────────────────────

/// Renderiza `RichText`: si es matemático/intencional, verbatim; si no, escapado.
fn text(t: &RichText) -> String {
    if t.is_math {
        t.text.clone()
    } else {
        escape(&t.text)
    }
}

/// Escape mínimo de caracteres especiales de LaTeX para texto plano.
fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\textbackslash{}"),
            '&' => out.push_str("\\&"),
            '%' => out.push_str("\\%"),
            '$' => out.push_str("\\$"),
            '#' => out.push_str("\\#"),
            '_' => out.push_str("\\_"),
            '{' => out.push_str("\\{"),
            '}' => out.push_str("\\}"),
            '~' => out.push_str("\\textasciitilde{}"),
            '^' => out.push_str("\\textasciicircum{}"),
            other => out.push(other),
        }
    }
    out
}

/// Slug ASCII para claves de glosario/acrónimo.
fn slug(s: &str) -> String {
    s.chars()
        .filter_map(|c| {
            if c.is_ascii_alphanumeric() {
                Some(c.to_ascii_lowercase())
            } else if c == ' ' {
                Some('-')
            } else {
                None
            }
        })
        .collect()
}
