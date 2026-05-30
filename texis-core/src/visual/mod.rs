// Renderers LaTeX para Visual Blocks nativos.
//
// Cada función toma la config tipada y produce un fragmento LaTeX completo
// (normalmente un entorno figure con el contenido y \caption + \label).
// El usuario nunca ve este código — lo genera TeXisStudio automáticamente.

pub mod bio_pathway;
pub mod circuit;
pub mod chem;
pub mod feynman;
pub mod flow;
pub mod music;
pub mod timeline;
pub mod venn;

use crate::project::model::{VisualBlock, VisualConfig};
use crate::template::escape::latex_escape;

/// Renderiza un VisualBlock completo como LaTeX (entorno figure).
pub fn render_visual(block: &VisualBlock) -> String {
    // Override avanzado: si el usuario confirmó su propio LaTeX, usarlo directamente
    if block.advanced_override_confirmed {
        if let Some(override_latex) = &block.advanced_latex_override {
            if !override_latex.trim().is_empty() {
                return format!("{}\n\n", override_latex.trim());
            }
        }
    }

    let inner = match &block.config {
        VisualConfig::VennEuler(c)    => venn::render(c),
        VisualConfig::FlowDiagram(c)  => flow::render(c),
        VisualConfig::Timeline(c)     => timeline::render(c),
        VisualConfig::ChemReaction(c) => chem::render_reaction(c),
        VisualConfig::Molecule(c)     => chem::render_molecule(c),
        VisualConfig::Circuit(c)      => circuit::render(c),
        VisualConfig::Feynman(c)      => feynman::render(c),
        VisualConfig::BioPathway(c)   => bio_pathway::render(c),
        VisualConfig::MusicFragment(c)=> music::render(c),
    };

    wrap_in_figure(&inner, block)
}

fn wrap_in_figure(inner: &str, block: &VisualBlock) -> String {
    let caption = latex_escape(&block.caption);
    let label   = &block.label;
    format!(
        "\\begin{{figure}}[htbp]\n  \\centering\n{}\n  \\caption{{{}}}\n  \\label{{{}}}\n\\end{{figure}}\n\n",
        indent(inner, 2),
        caption,
        label,
    )
}

fn indent(s: &str, n: usize) -> String {
    let pad = " ".repeat(n);
    s.lines()
        .map(|l| if l.trim().is_empty() { String::new() } else { format!("{}{}", pad, l) })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Devuelve el paquete LaTeX principal que requiere este tipo de visual.
pub fn required_package(config: &VisualConfig) -> &'static str {
    match config {
        VisualConfig::VennEuler(_)    => "tikz",
        VisualConfig::FlowDiagram(_)  => "tikz",
        VisualConfig::Timeline(_)     => "tikz",
        VisualConfig::BioPathway(_)   => "tikz",
        VisualConfig::ChemReaction(_) => "mhchem",
        VisualConfig::Molecule(_)     => "chemfig",
        VisualConfig::Circuit(_)      => "circuitikz",
        VisualConfig::Feynman(_)      => "tikz",    // tikz-feynman usa tikz base
        VisualConfig::MusicFragment(_)=> "musixtex",
    }
}

/// Paquetes LaTeX adicionales (librerías TikZ, etc.)
pub fn extra_packages(config: &VisualConfig) -> Vec<&'static str> {
    match config {
        VisualConfig::Feynman(_) => vec!["tikz-feynman"],
        _ => vec![],
    }
}
