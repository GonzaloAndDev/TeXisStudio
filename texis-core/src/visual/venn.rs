// Renderer TikZ para diagramas de Venn/Euler (2, 3 o 4 conjuntos).

use crate::project::model::VennEulerConfig;
use crate::template::escape::latex_escape;

pub fn render(c: &VennEulerConfig) -> String {
    match c.sets.len() {
        2 => render_2(c),
        3 => render_3(c),
        4 => render_4(c),
        _ => render_3(c),
    }
}

fn set_color(color: &str, idx: usize) -> &str {
    // Normaliza nombres de color para TikZ
    match color {
        "red" | "#E74C3C" => "red",
        "blue" | "#3498DB" => "blue",
        "green" | "#27AE60" => "green",
        "purple" | "#9B59B6" => "purple",
        "orange" | "#E67E22" => "orange",
        "teal" | "#1ABC9C" => "teal",
        _ => match idx {
            0 => "red",
            1 => "blue",
            2 => "green",
            _ => "orange",
        },
    }
}

fn render_2(c: &VennEulerConfig) -> String {
    let a = c.sets.first();
    let b = c.sets.get(1);
    let la = a.map(|s| latex_escape(&s.label)).unwrap_or_default();
    let lb = b.map(|s| latex_escape(&s.label)).unwrap_or_default();
    let ca = a.map(|s| set_color(&s.color, 0)).unwrap_or("red");
    let cb = b.map(|s| set_color(&s.color, 1)).unwrap_or("blue");
    let inter_01 = c
        .intersections
        .get("01")
        .map(|s| latex_escape(s))
        .unwrap_or_default();

    format!(
        r#"\begin{{tikzpicture}}[scale=1.1]
  \begin{{scope}}[fill opacity=0.30]
    \fill[{ca}!80] (-1,0) circle (1.6);
    \fill[{cb}!80] ( 1,0) circle (1.6);
  \end{{scope}}
  \draw[thick,{ca}!90] (-1,0) circle (1.6)
    node[left=1.8cm, font=\bfseries\small, text={ca}!90] {{{la}}};
  \draw[thick,{cb}!90] ( 1,0) circle (1.6)
    node[right=1.8cm, font=\bfseries\small, text={cb}!90] {{{lb}}};
  \node[font=\footnotesize, align=center] at (0,0) {{{inter_01}}};
\end{{tikzpicture}}"#
    )
}

fn render_3(c: &VennEulerConfig) -> String {
    let sets: Vec<_> = (0..3)
        .map(|i| {
            c.sets
                .get(i)
                .cloned()
                .unwrap_or_else(|| crate::project::model::VennSet {
                    label: format!("Conjunto {}", (b'A' + i as u8) as char),
                    color: ["red", "blue", "green"][i].to_string(),
                })
        })
        .collect();

    let labels: Vec<_> = sets.iter().map(|s| latex_escape(&s.label)).collect();
    let colors: Vec<_> = sets
        .iter()
        .enumerate()
        .map(|(i, s)| set_color(&s.color, i))
        .collect();

    // Intersecciones: 01=AB, 02=AC, 12=BC, 012=ABC
    let i01 = c
        .intersections
        .get("01")
        .map(|s| latex_escape(s))
        .unwrap_or_default();
    let i02 = c
        .intersections
        .get("02")
        .map(|s| latex_escape(s))
        .unwrap_or_default();
    let i12 = c
        .intersections
        .get("12")
        .map(|s| latex_escape(s))
        .unwrap_or_default();
    let i012 = c
        .intersections
        .get("012")
        .map(|s| latex_escape(s))
        .unwrap_or_default();

    format!(
        r#"\begin{{tikzpicture}}[scale=1.1]
  \begin{{scope}}[fill opacity=0.28]
    \fill[{c0}!80]  (90:1.1)  circle (1.8);
    \fill[{c1}!80] (330:1.1) circle (1.8);
    \fill[{c2}!80] (210:1.1) circle (1.8);
  \end{{scope}}
  \draw[thick,{c0}!90] (90:1.1)  circle (1.8)
    node[above=2.0cm, font=\bfseries\small, text={c0}!90] {{{l0}}};
  \draw[thick,{c1}!90] (330:1.1) circle (1.8)
    node[right=2.0cm, font=\bfseries\small, text={c1}!90] {{{l1}}};
  \draw[thick,{c2}!80!black] (210:1.1) circle (1.8)
    node[below left=1.2cm, font=\bfseries\small, text={c2}!70!black] {{{l2}}};
  % Intersecciones
  \node[font=\scriptsize, align=center] at (30:1.35)  {{{i01}}};
  \node[font=\scriptsize, align=center] at (150:1.35) {{{i02}}};
  \node[font=\scriptsize, align=center] at (270:1.25) {{{i12}}};
  \node[font=\small\bfseries, align=center] at (0,0)  {{{i012}}};
\end{{tikzpicture}}"#,
        c0 = colors[0],
        c1 = colors[1],
        c2 = colors[2],
        l0 = labels[0],
        l1 = labels[1],
        l2 = labels[2],
        i01 = i01,
        i02 = i02,
        i12 = i12,
        i012 = i012,
    )
}

fn render_4(c: &VennEulerConfig) -> String {
    // 4 conjuntos: disposición en elipses (Euler) — más limpio que 4 círculos
    let sets: Vec<_> = (0..4)
        .map(|i| {
            c.sets
                .get(i)
                .cloned()
                .unwrap_or_else(|| crate::project::model::VennSet {
                    label: format!("Conjunto {}", (b'A' + i as u8) as char),
                    color: ["red", "blue", "green", "purple"][i].to_string(),
                })
        })
        .collect();
    let labels: Vec<_> = sets.iter().map(|s| latex_escape(&s.label)).collect();
    let colors: Vec<_> = sets
        .iter()
        .enumerate()
        .map(|(i, s)| set_color(&s.color, i))
        .collect();

    format!(
        r#"\begin{{tikzpicture}}[scale=1.0]
  \begin{{scope}}[fill opacity=0.25]
    \fill[{c0}] (0,0.6) ellipse (2.2cm and 1.4cm);
    \fill[{c1}] (0,-0.6) ellipse (2.2cm and 1.4cm);
    \fill[{c2}] (-0.6,0) ellipse (1.4cm and 2.2cm);
    \fill[{c3}] (0.6,0) ellipse (1.4cm and 2.2cm);
  \end{{scope}}
  \draw[thick,{c0}] (0,0.6) ellipse (2.2cm and 1.4cm)
    node[above=1.5cm, font=\bfseries\footnotesize] {{{l0}}};
  \draw[thick,{c1}] (0,-0.6) ellipse (2.2cm and 1.4cm)
    node[below=1.5cm, font=\bfseries\footnotesize] {{{l1}}};
  \draw[thick,{c2}] (-0.6,0) ellipse (1.4cm and 2.2cm)
    node[left=1.5cm, font=\bfseries\footnotesize] {{{l2}}};
  \draw[thick,{c3}] (0.6,0) ellipse (1.4cm and 2.2cm)
    node[right=1.5cm, font=\bfseries\footnotesize] {{{l3}}};
\end{{tikzpicture}}"#,
        c0 = colors[0],
        c1 = colors[1],
        c2 = colors[2],
        c3 = colors[3],
        l0 = labels[0],
        l1 = labels[1],
        l2 = labels[2],
        l3 = labels[3],
    )
}
