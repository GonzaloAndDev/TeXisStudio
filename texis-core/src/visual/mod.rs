// Renderers LaTeX para Visual Blocks nativos.
//
// Cada función toma la config tipada y produce un fragmento LaTeX completo
// (normalmente un entorno figure con el contenido y \caption + \label).
// El usuario nunca ve este código — lo genera TeXisStudio automáticamente.

pub mod bio_pathway;
pub mod chem;
pub mod circuit;
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
        VisualConfig::VennEuler(c) => venn::render(c),
        VisualConfig::FlowDiagram(c) => flow::render(c),
        VisualConfig::Timeline(c) => timeline::render(c),
        VisualConfig::ChemReaction(c) => chem::render_reaction(c),
        VisualConfig::Molecule(c) => chem::render_molecule(c),
        VisualConfig::Circuit(c) => circuit::render(c),
        VisualConfig::Feynman(c) => feynman::render(c),
        VisualConfig::BioPathway(c) => bio_pathway::render(c),
        VisualConfig::MusicFragment(c) => music::render(c),
    };

    wrap_in_figure(&inner, block)
}

fn wrap_in_figure(inner: &str, block: &VisualBlock) -> String {
    let caption = latex_escape(&block.caption);
    let label = &block.label;
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
        .map(|l| {
            if l.trim().is_empty() {
                String::new()
            } else {
                format!("{}{}", pad, l)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Devuelve el paquete LaTeX principal que requiere este tipo de visual.
pub fn required_package(config: &VisualConfig) -> &'static str {
    match config {
        VisualConfig::VennEuler(_) => "tikz",
        VisualConfig::FlowDiagram(_) => "tikz",
        VisualConfig::Timeline(_) => "tikz",
        VisualConfig::BioPathway(_) => "tikz",
        VisualConfig::ChemReaction(_) => "mhchem",
        VisualConfig::Molecule(_) => "chemfig",
        VisualConfig::Circuit(_) => "circuitikz",
        VisualConfig::Feynman(_) => "tikz",
        VisualConfig::MusicFragment(_) => "musixtex",
    }
}

/// Paquetes LaTeX adicionales (librerías TikZ, etc.)
pub fn extra_packages(_config: &VisualConfig) -> Vec<&'static str> {
    vec![]
}

/// Snippet LaTeX que debe ir en el preámbulo (una sola vez, deduplicado por main_tex).
/// Se usa para definiciones globales como \tikzset{} que no caben en un usepackage.
pub fn required_preamble(config: &VisualConfig) -> Option<&'static str> {
    match config {
        VisualConfig::Feynman(_) => Some(
            "\\tikzset{\n\
             \x20\x20fermion/.style={postaction={decorate},decoration={markings,\n\
             \x20\x20\x20\x20mark=at position 0.55 with {\\arrow{Latex}}}},\n\
             \x20\x20antifermion/.style={postaction={decorate},decoration={markings,\n\
             \x20\x20\x20\x20mark=at position 0.55 with {\\arrowreversed{Latex}}}},\n\
             \x20\x20photon/.style={decorate,decoration={snake,amplitude=2pt,segment length=6pt}},\n\
             \x20\x20gluon/.style={decorate,decoration={coil,amplitude=3pt,segment length=5pt}},\n\
             \x20\x20boson/.style={dashed, thick},\n\
             }",
        ),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::*;

    fn venn_block() -> VisualBlock {
        VisualBlock {
            id: "v1".to_string(),
            caption: "Venn de prueba".to_string(),
            label: "fig:venn".to_string(),
            include_in_list: true,
            advanced_latex_override: None,
            advanced_override_confirmed: false,
            config: VisualConfig::VennEuler(VennEulerConfig {
                sets: vec![
                    VennSet {
                        label: "A".to_string(),
                        color: "red".to_string(),
                    },
                    VennSet {
                        label: "B".to_string(),
                        color: "blue".to_string(),
                    },
                ],
                intersections: [("01".to_string(), "A∩B".to_string())].into(),
                style: "circles".to_string(),
            }),
        }
    }

    #[test]
    fn venn_block_serializa_y_deserializa() {
        let block = venn_block();
        let block_in_enum = ContentBlock::Visual(block.clone());

        // Serializar a YAML
        let yaml = serde_yaml::to_string(&block_in_enum).unwrap();
        assert!(yaml.contains("type: visual"), "debe tener type: visual");
        assert!(
            yaml.contains("kind: venn_euler"),
            "debe tener kind: venn_euler"
        );
        assert!(yaml.contains("fig:venn"), "debe tener el label");

        // Deserializar de vuelta
        let back: ContentBlock = serde_yaml::from_str(&yaml).unwrap();
        if let ContentBlock::Visual(vb) = back {
            assert_eq!(vb.label, "fig:venn");
            assert_eq!(vb.caption, "Venn de prueba");
            if let VisualConfig::VennEuler(c) = vb.config {
                assert_eq!(c.sets.len(), 2);
                assert_eq!(c.intersections.get("01").map(|s| s.as_str()), Some("A∩B"));
            } else {
                panic!("config debe ser VennEuler");
            }
        } else {
            panic!("back debe ser Visual");
        }
    }

    #[test]
    fn render_venn_produce_tikzpicture_con_figure() {
        let block = venn_block();
        let latex = render_visual(&block);
        assert!(latex.contains("\\begin{figure}"), "debe envolver en figure");
        assert!(
            latex.contains("\\caption{Venn de prueba}"),
            "debe tener caption"
        );
        assert!(latex.contains("\\label{fig:venn}"), "debe tener label");
        assert!(latex.contains("tikzpicture"), "debe contener tikzpicture");
        assert!(latex.contains("circle"), "debe dibujar círculos");
    }

    #[test]
    fn render_chem_reaction_produce_ce_command() {
        let block = VisualBlock {
            id: "c1".to_string(),
            caption: "Síntesis del agua".to_string(),
            label: "fig:water".to_string(),
            include_in_list: true,
            advanced_latex_override: None,
            advanced_override_confirmed: false,
            config: VisualConfig::ChemReaction(ChemReactionConfig {
                equation: "H2 + O2 -> H2O".to_string(),
                catalyst: None,
                conditions: None,
                reaction_type: "forward".to_string(),
                display_mode: true,
            }),
        };
        let latex = render_visual(&block);
        assert!(
            latex.contains("\\ce{"),
            "debe usar el comando \\ce de mhchem"
        );
        assert!(latex.contains("H2"), "debe contener reactivos");
        assert!(latex.contains("\\begin{figure}"), "debe tener figure env");
    }

    #[test]
    fn render_molecule_preset_benzene() {
        let block = VisualBlock {
            id: "m1".to_string(),
            caption: "Benceno".to_string(),
            label: "fig:benzene".to_string(),
            include_in_list: true,
            advanced_latex_override: None,
            advanced_override_confirmed: false,
            config: VisualConfig::Molecule(MoleculeConfig {
                preset: Some("benzene".to_string()),
                chemfig_formula: None,
                scale: 1.0,
            }),
        };
        let latex = render_visual(&block);
        assert!(latex.contains("\\chemfig"), "debe usar \\chemfig");
        assert!(latex.contains("*6"), "benceno usa *6(...)");
    }

    #[test]
    fn advanced_override_sustituye_latex_generado() {
        let mut block = venn_block();
        block.advanced_latex_override =
            Some("% Mi LaTeX personalizado\n\\textbf{override}".to_string());
        block.advanced_override_confirmed = true;
        let latex = render_visual(&block);
        assert!(latex.contains("override"), "debe usar el override");
        assert!(
            !latex.contains("tikzpicture"),
            "NO debe generar TikZ cuando hay override confirmado"
        );
    }

    #[test]
    fn required_package_correcto_por_tipo() {
        use crate::project::model::*;
        let venn = VisualConfig::VennEuler(VennEulerConfig {
            sets: vec![],
            intersections: Default::default(),
            style: "circles".to_string(),
        });
        assert_eq!(required_package(&venn), "tikz");

        let chem = VisualConfig::ChemReaction(ChemReactionConfig {
            equation: "".to_string(),
            catalyst: None,
            conditions: None,
            reaction_type: "forward".to_string(),
            display_mode: true,
        });
        assert_eq!(required_package(&chem), "mhchem");

        let mol = VisualConfig::Molecule(MoleculeConfig {
            preset: None,
            chemfig_formula: None,
            scale: 1.0,
        });
        assert_eq!(required_package(&mol), "chemfig");

        let cir = VisualConfig::Circuit(CircuitConfig {
            preset: "rc_series".to_string(),
            component_values: Default::default(),
        });
        assert_eq!(required_package(&cir), "circuitikz");

        let feynman = VisualConfig::Feynman(FeynmanConfig {
            preset: "compton".to_string(),
            particle_labels: Default::default(),
            show_momentum: false,
        });
        assert_eq!(required_package(&feynman), "tikz");
        assert!(
            extra_packages(&feynman).is_empty(),
            "Feynman usa TikZ nativo, no tikz-feynman"
        );
    }

    #[test]
    fn required_preamble_feynman_tiene_tikzset() {
        use crate::project::model::*;
        let feynman = VisualConfig::Feynman(FeynmanConfig {
            preset: "compton".to_string(),
            particle_labels: Default::default(),
            show_momentum: false,
        });
        let snip = required_preamble(&feynman);
        assert!(snip.is_some(), "Feynman debe tener snippet de preámbulo");
        let s = snip.unwrap();
        assert!(s.contains("fermion"), "debe definir estilo fermion");
        assert!(s.contains("photon"), "debe definir estilo photon");
        assert!(s.contains("\\tikzset"), "debe ser un \\tikzset");
        assert!(
            !s.contains("\\usetikzlibrary"),
            "la librería va por required_package, no aquí"
        );
    }

    #[test]
    fn required_preamble_otros_tipos_son_none() {
        use crate::project::model::*;
        let venn = VisualConfig::VennEuler(VennEulerConfig {
            sets: vec![],
            intersections: Default::default(),
            style: "circles".to_string(),
        });
        assert!(required_preamble(&venn).is_none());

        let chem = VisualConfig::ChemReaction(ChemReactionConfig {
            equation: "".to_string(),
            catalyst: None,
            conditions: None,
            reaction_type: "forward".to_string(),
            display_mode: true,
        });
        assert!(required_preamble(&chem).is_none());
    }

    #[test]
    fn render_feynman_cuerpo_no_contiene_usetikzlibrary() {
        use crate::project::model::*;
        let block = VisualBlock {
            id: "f1".to_string(),
            caption: "Diagrama Compton".to_string(),
            label: "fig:compton".to_string(),
            include_in_list: true,
            advanced_latex_override: None,
            advanced_override_confirmed: false,
            config: VisualConfig::Feynman(FeynmanConfig {
                preset: "compton".to_string(),
                particle_labels: Default::default(),
                show_momentum: false,
            }),
        };
        let latex = render_visual(&block);
        assert!(
            !latex.contains("\\usetikzlibrary"),
            "\\usetikzlibrary va en el preámbulo, no en el cuerpo de la figura"
        );
        assert!(
            !latex.contains("\\tikzset"),
            "\\tikzset va en el preámbulo, no en el cuerpo de la figura"
        );
        assert!(
            latex.contains("tikzpicture"),
            "debe contener el diagrama tikzpicture"
        );
        assert!(latex.contains("fermion"), "debe usar el estilo fermion");
    }

    #[test]
    fn render_flow_sanitiza_ids_y_coloca_label_en_arista() {
        let block = VisualBlock {
            id: "flow1".to_string(),
            caption: "Flujo".to_string(),
            label: "fig:flow".to_string(),
            include_in_list: true,
            advanced_latex_override: None,
            advanced_override_confirmed: false,
            config: VisualConfig::FlowDiagram(FlowDiagramConfig {
                nodes: vec![
                    FlowNode {
                        id: "inicio del usuario".to_string(),
                        label: "Inicio".to_string(),
                        shape: "rounded".to_string(),
                        color: "blue".to_string(),
                    },
                    FlowNode {
                        id: "decision: final?".to_string(),
                        label: "Validar".to_string(),
                        shape: "diamond".to_string(),
                        color: "orange".to_string(),
                    },
                ],
                edges: vec![FlowEdge {
                    from: "inicio del usuario".to_string(),
                    to: "decision: final?".to_string(),
                    label: Some("sí".to_string()),
                    style: "arrow".to_string(),
                }],
                orientation: "vertical".to_string(),
            }),
        };

        let latex = render_visual(&block);
        assert!(latex.contains("\\node[rounded] (n0)"));
        assert!(
            latex.contains("\\node[decision] (n1)"),
            "nodo diamond usa estilo 'decision' para evitar recursividad TikZ"
        );
        assert!(!latex.contains("(inicio del usuario)"));
        assert!(latex.contains("\\draw[->] (n0) -- node[midway, right"));
    }

    #[test]
    fn caption_con_especiales_latex_se_escapa() {
        let mut block = venn_block();
        block.caption = "100% éxito & siempre".to_string();
        let latex = render_visual(&block);
        assert!(latex.contains("100\\%"), "% debe escaparse");
        assert!(latex.contains("\\&"), "& debe escaparse");
    }
}
