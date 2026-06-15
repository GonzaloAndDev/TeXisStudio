// Renderer TikZ para Flow Diagrams (diagramas de flujo / proceso).

use crate::project::model::{FlowDiagramConfig, FlowNode};
use crate::template::escape::latex_escape;
use std::collections::HashMap;

pub fn render(c: &FlowDiagramConfig) -> String {
    let is_vertical = c.orientation != "horizontal";
    let node_ids = tikz_node_ids(&c.nodes);
    let node_defs = render_nodes(&c.nodes, &node_ids, is_vertical);
    let edge_defs = render_edges(c, &c.nodes, &node_ids);

    format!(
        r#"\begin{{tikzpicture}}[
  node distance=1.4cm,
  rect/.style={{draw, rounded corners=4pt, minimum width=3cm, minimum height=0.8cm,
               align=center, font=\small, fill=blue!10, draw=blue!60}},
  decision/.style={{draw, shape=diamond, minimum width=3cm, minimum height=0.8cm,
                   align=center, font=\small, fill=orange!15, draw=orange!70,
                   aspect=2}},
  circle_node/.style={{draw, shape=circle, minimum size=0.8cm, align=center,
                       font=\small, fill=green!15, draw=green!60}},
  rounded/.style={{draw, rounded corners=8pt, minimum width=3cm, minimum height=0.8cm,
                  align=center, font=\small, fill=purple!10, draw=purple!60}},
  >=Latex, thick,
]
{node_defs}
{edge_defs}
\end{{tikzpicture}}"#
    )
}

fn tikz_node_ids(nodes: &[FlowNode]) -> HashMap<&str, String> {
    nodes
        .iter()
        .enumerate()
        .map(|(i, node)| (node.id.as_str(), format!("n{}", i)))
        .collect()
}

fn render_nodes(nodes: &[FlowNode], ids: &HashMap<&str, String>, vertical: bool) -> String {
    let mut out = String::new();
    for (i, node) in nodes.iter().enumerate() {
        let style = match node.shape.as_str() {
            "diamond" => "decision",
            "circle" => "circle_node",
            "rounded" => "rounded",
            _ => "rect",
        };
        let position = if i == 0 {
            String::new()
        } else if vertical {
            format!("[below of={}]", ids[nodes[i - 1].id.as_str()])
        } else {
            format!("[right of={}]", ids[nodes[i - 1].id.as_str()])
        };
        out.push_str(&format!(
            "  \\node[{}] ({}) {} {{{}}};\n",
            style,
            ids[node.id.as_str()],
            position,
            latex_escape(&node.label)
        ));
    }
    out
}

fn render_edges(c: &FlowDiagramConfig, nodes: &[FlowNode], ids: &HashMap<&str, String>) -> String {
    let mut out = String::new();
    // Auto-edges si no hay edges definidos (conectar en secuencia)
    if c.edges.is_empty() {
        for i in 1..nodes.len() {
            out.push_str(&format!(
                "  \\draw[->] ({}) -- ({});\n",
                ids[nodes[i - 1].id.as_str()],
                ids[nodes[i].id.as_str()]
            ));
        }
        return out;
    }
    for edge in &c.edges {
        let style = match edge.style.as_str() {
            "dashed" => "->, dashed",
            "double" => "->>, thick",
            _ => "->",
        };
        let label_part = match &edge.label {
            Some(l) => format!(
                " node[midway, right, font=\\footnotesize] {{{}}}",
                latex_escape(l)
            ),
            None => String::new(),
        };
        let Some(from) = ids.get(edge.from.as_str()) else {
            out.push_str(&format!(
                "  % Edge omitido: nodo origen desconocido ({})\n",
                latex_escape(&edge.from)
            ));
            continue;
        };
        let Some(to) = ids.get(edge.to.as_str()) else {
            out.push_str(&format!(
                "  % Edge omitido: nodo destino desconocido ({})\n",
                latex_escape(&edge.to)
            ));
            continue;
        };
        out.push_str(&format!(
            "  \\draw[{}] ({}) --{} ({});\n",
            style, from, label_part, to
        ));
    }
    out
}
