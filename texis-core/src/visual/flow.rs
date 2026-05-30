// Renderer TikZ para Flow Diagrams (diagramas de flujo / proceso).

use crate::project::model::{FlowDiagramConfig, FlowNode};
use crate::template::escape::latex_escape;

pub fn render(c: &FlowDiagramConfig) -> String {
    let is_vertical = c.orientation != "horizontal";
    let node_defs = render_nodes(&c.nodes, is_vertical);
    let edge_defs = render_edges(c, &c.nodes);

    format!(r#"\begin{{tikzpicture}}[
  node distance=1.4cm,
  rect/.style={{draw, rounded corners=4pt, minimum width=3cm, minimum height=0.8cm,
               align=center, font=\small, fill=blue!10, draw=blue!60}},
  diamond/.style={{draw, diamond, minimum width=3cm, minimum height=0.8cm,
                  align=center, font=\small, fill=orange!15, draw=orange!70,
                  aspect=2}},
  circle_node/.style={{draw, circle, minimum size=0.8cm, align=center,
                       font=\small, fill=green!15, draw=green!60}},
  rounded/.style={{draw, rounded corners=8pt, minimum width=3cm, minimum height=0.8cm,
                  align=center, font=\small, fill=purple!10, draw=purple!60}},
  >=Latex, thick,
]
{node_defs}
{edge_defs}
\end{{tikzpicture}}"#)
}

fn render_nodes(nodes: &[FlowNode], vertical: bool) -> String {
    let mut out = String::new();
    for (i, node) in nodes.iter().enumerate() {
        let style = match node.shape.as_str() {
            "diamond" => "diamond",
            "circle"  => "circle_node",
            "rounded" => "rounded",
            _         => "rect",
        };
        let position = if i == 0 {
            String::new()
        } else if vertical {
            format!("[below of={}]", nodes[i-1].id)
        } else {
            format!("[right of={}]", nodes[i-1].id)
        };
        out.push_str(&format!(
            "  \\node[{}] ({}) {} {{{}}};\n",
            style,
            node.id,
            position,
            latex_escape(&node.label)
        ));
    }
    out
}

fn render_edges(c: &FlowDiagramConfig, nodes: &[FlowNode]) -> String {
    let mut out = String::new();
    // Auto-edges si no hay edges definidos (conectar en secuencia)
    if c.edges.is_empty() {
        for i in 1..nodes.len() {
            out.push_str(&format!(
                "  \\draw[->] ({}) -- ({});\n",
                nodes[i-1].id, nodes[i].id
            ));
        }
        return out;
    }
    for edge in &c.edges {
        let style = match edge.style.as_str() {
            "dashed" => "->, dashed",
            "double" => "->>, thick",
            _        => "->",
        };
        let label_part = match &edge.label {
            Some(l) => format!(" node[midway, right, font=\\footnotesize] {{{}}}", latex_escape(l)),
            None    => String::new(),
        };
        out.push_str(&format!(
            "  \\draw[{}] ({}){} -- ({});\n",
            style, edge.from, label_part, edge.to
        ));
    }
    out
}
