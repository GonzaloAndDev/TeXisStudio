// Renderer TikZ para diagramas de Feynman (usando TikZ nativo con decoraciones).
// No requiere tikz-feynman — usa decoraciones estándar para mayor compatibilidad.

use crate::project::model::FeynmanConfig;

pub fn render(c: &FeynmanConfig) -> String {
    // Preamble de estilos (insertado una sola vez — el generador lo deduplica si se usan varios)
    let header = r#"\usetikzlibrary{decorations.markings,decorations.pathmorphing,arrows.meta}
\tikzset{
  fermion/.style={postaction={decorate},decoration={markings,
    mark=at position 0.55 with {\arrow{Latex}}}},
  antifermion/.style={postaction={decorate},decoration={markings,
    mark=at position 0.55 with {\arrowreversed{Latex}}}},
  photon/.style={decorate,decoration={snake,amplitude=2pt,segment length=6pt}},
  gluon/.style={decorate,decoration={coil,amplitude=3pt,segment length=5pt}},
  boson/.style={dashed, thick},
}"#;

    let diagram = match c.preset.as_str() {
        "compton" => compton(),
        "muon_decay" => muon_decay(),
        "pair_production" => pair_production(),
        "bhabha" => bhabha(),
        "higgs_production" => higgs_production(),
        _ => vertex_qed(),
    };

    format!("{}\n{}", header, diagram)
}

fn vertex_qed() -> String {
    r#"\begin{tikzpicture}[scale=1.3, font=\small]
  \draw[fermion, thick, blue!80]  (-1.3, 0.7) -- (0,0) node[pos=0, left] {$e^-$};
  \draw[fermion, thick, blue!80]  (0,0) -- (1.3, 0.7) node[right] {$e^-$};
  \draw[photon,  thick, red!80]   (0,0) -- (0,-1.3) node[below] {$\gamma$};
  \filldraw[black] (0,0) circle (2.5pt);
  \node[above right=2pt, font=\scriptsize] at (0,0) {QED};
\end{tikzpicture}"#
        .to_string()
}

fn compton() -> String {
    r#"\begin{tikzpicture}[scale=1.3, font=\small]
  \draw[fermion, thick, blue!80] (-1.3, 0.6) -- (0,0) node[pos=0,left] {$e^-$};
  \draw[photon,  thick, red!80]  (-1.3,-0.6) -- (0,0) node[pos=0,left] {$\gamma$};
  \filldraw[black] (0,0) circle (2.5pt);
  \draw[fermion, thick, blue!80] (0,0) -- (1.3, 0.6) node[right] {$e^-$};
  \draw[photon,  thick, red!80]  (0,0) -- (1.3,-0.6) node[right] {$\gamma$};
  \node[below=4pt, font=\scriptsize] at (0,0) {Compton};
\end{tikzpicture}"#
        .to_string()
}

fn muon_decay() -> String {
    r#"\begin{tikzpicture}[scale=1.2, font=\small]
  \draw[fermion, thick, purple!80] (-1.5,0) -- (0,0) node[pos=0,left] {$\mu^-$};
  \filldraw[black] (0,0) circle (2.5pt);
  \draw[boson, orange!80] (0,0) -- (1.0,0) node[midway, above, font=\scriptsize] {$W^-$};
  \filldraw[black] (1.0,0) circle (2.5pt);
  \draw[fermion, thick, blue!80]  (1.0,0) -- (2.2, 0.7) node[right] {$e^-$};
  \draw[antifermion, thick, green!60!black] (1.0,0) -- (2.2,-0.7) node[right] {$\bar{\nu}_e$};
  \draw[fermion, thick, purple!60] (0,0) -- (1.0, 0.9) node[right] {$\nu_\mu$};
\end{tikzpicture}"#
        .to_string()
}

fn pair_production() -> String {
    r#"\begin{tikzpicture}[scale=1.3, font=\small]
  \draw[photon,  thick, red!80]   (-1.3, 0.5) -- (0,0) node[pos=0,left] {$\gamma$};
  \draw[photon,  thick, red!80]   (-1.3,-0.5) -- (0,0) node[pos=0,left] {$\gamma$};
  \filldraw[black] (0,0) circle (2.5pt);
  \draw[fermion, thick, blue!80]      (0,0) -- (1.3, 0.6) node[right] {$e^-$};
  \draw[antifermion, thick, red!60]   (0,0) -- (1.3,-0.6) node[right] {$e^+$};
\end{tikzpicture}"#
        .to_string()
}

fn bhabha() -> String {
    r#"\begin{tikzpicture}[scale=1.2, font=\small]
  \draw[fermion, thick, blue!80]      (-1.3, 0.7) -- (0, 0.7) node[pos=0,left] {$e^-$};
  \draw[antifermion, thick, red!70]   (-1.3,-0.7) -- (0,-0.7) node[pos=0,left] {$e^+$};
  \draw[photon, thick, orange!80] (0, 0.7) -- (0,-0.7) node[midway, right, font=\scriptsize] {$\gamma$};
  \draw[fermion, thick, blue!80]      (0, 0.7) -- (1.3, 0.7) node[right] {$e^-$};
  \draw[antifermion, thick, red!70]   (0,-0.7) -- (1.3,-0.7) node[right] {$e^+$};
  \filldraw[black] (0, 0.7) circle (2pt);
  \filldraw[black] (0,-0.7) circle (2pt);
\end{tikzpicture}"#.to_string()
}

fn higgs_production() -> String {
    r#"\begin{tikzpicture}[scale=1.2, font=\small]
  \draw[gluon, thick, orange!70]  (-1.5, 0.8) -- (-0.5, 0.3) node[pos=0,left] {$g$};
  \draw[gluon, thick, orange!70]  (-1.5,-0.8) -- (-0.5,-0.3) node[pos=0,left] {$g$};
  \draw[fermion, thick, green!60!black] (-0.5,0.3) -- (-0.5,-0.3);
  \draw[fermion, thick, green!60!black] (-0.5,-0.3) -- (0.5,-0.3);
  \draw[fermion, thick, green!60!black] (0.5,-0.3) -- (0.5, 0.3);
  \draw[fermion, thick, green!60!black] (0.5, 0.3) -- (-0.5, 0.3);
  \draw[boson, blue!80] (0.5, 0) -- (1.5, 0) node[right] {$H$};
  \node[font=\scriptsize, above=2pt] at (0, 0.3) {top};
  \filldraw[black] (-0.5,0.3) circle (2pt);
  \filldraw[black] (-0.5,-0.3) circle (2pt);
  \filldraw[black] (0.5,0.3) circle (2pt);
  \filldraw[black] (0.5,-0.3) circle (2pt);
\end{tikzpicture}"#
        .to_string()
}
