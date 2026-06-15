// Renderer TikZ para vías biológicas (presets editables).

use crate::project::model::BioPathwayConfig;
use crate::template::escape::latex_escape;

pub fn render(c: &BioPathwayConfig) -> String {
    match c.preset.as_str() {
        "glycolysis" => glycolysis(c),
        "photosynthesis" => photosynthesis(c),
        "electron_transport" => electron_transport(c),
        "beta_oxidation" => beta_oxidation(c),
        _ => krebs_cycle(c),
    }
}

fn label(c: &BioPathwayConfig, key: &str, default: &str) -> String {
    // Los defaults son LaTeX intencional (pueden contener $\alpha$, etc.) — no escapar.
    // Los labels del usuario sí se escapan porque vienen de texto libre.
    if let Some(user_label) = c.custom_labels.get(key) {
        latex_escape(user_label)
    } else {
        default.to_string()
    }
}

fn krebs_cycle(c: &BioPathwayConfig) -> String {
    let show = c.show_cofactors;
    format!(
        r#"\usetikzlibrary{{shapes.geometric,calc}}
\begin{{tikzpicture}}[
  box/.style={{draw, rounded corners=3pt, fill=#1, minimum width=2.5cm,
              minimum height=0.55cm, align=center, font=\footnotesize\bfseries, inner sep=3pt}},
  >=Latex, thick, scale=0.9
]
  \def\R{{3.4}}
  \node[box=orange!25]       (ac)  at (90:\R)  {{{ac}}};
  \node[box=red!20]          (cit) at (30:\R)  {{{cit}}};
  \node[box=red!15]          (isa) at (330:\R) {{{isa}}};
  \node[box=purple!20]       (kg)  at (270:\R) {{{kg}}};
  \node[box=blue!20]         (scc) at (210:\R) {{{scc}}};
  \node[box=teal!20]         (suc) at (150:\R) {{{suc}}};
  \node[box=green!20,draw=green!60!black] (oaa) at (0,0) {{{oaa}}};
  \draw[->] (oaa.north) to[out=80,in=200]  (ac.south west);
  \draw[->] (ac)   to[out=330,in=100] (cit);
  \draw[->] (cit)  to[out=280,in=60]  (isa);
  \draw[->] (isa)  to[out=240,in=40]  (kg);
  \draw[->] (kg)   to[out=160,in=300] (scc);
  \draw[->] (scc)  to[out=80,in=220]  (suc);
  \draw[->] (suc)  to[out=40,in=170]  (oaa);
  {cofactors}
\end{{tikzpicture}}"#,
        ac = label(c, "acetyl_coa", "Acetil-CoA"),
        cit = label(c, "citrate", "Citrato (6C)"),
        isa = label(c, "isocitrate", "Isocitrato (6C)"),
        kg = label(c, "alpha_kg", "$\\alpha$-Cetoglu. (5C)"),
        scc = label(c, "succinyl", "Succinil-CoA (4C)"),
        suc = label(c, "succinate", "Succinato (4C)"),
        oaa = label(c, "oaa", "Oxalacetato (4C)"),
        cofactors = if show {
            r#"\node[font=\scriptsize,text=orange!80!black] at (75:2.0) {$+$CoA-SH};
  \node[font=\scriptsize,text=red!70!black]    at (5:\R*1.28)    {NADH};
  \node[font=\scriptsize,text=purple!80,align=center] at (308:\R*1.22) {NADH$+$CO$_2$};
  \node[font=\scriptsize,text=blue!70!black,align=center]   at (235:\R*1.22) {NADH$+$CO$_2$};
  \node[font=\scriptsize,text=teal!80,align=center]   at (187:\R*1.22) {GTP, FADH$_2$};
  \node[font=\scriptsize,text=green!60!black]  at (125:\R*1.2) {NADH};"#
        } else {
            ""
        },
    )
}

fn glycolysis(c: &BioPathwayConfig) -> String {
    let show = c.show_cofactors;
    let steps = [
        ("glucose", label(c, "glucose", "Glucosa (6C)")),
        ("g6p", label(c, "g6p", "Glucosa-6-P")),
        ("f6p", label(c, "f6p", "Fructosa-6-P")),
        ("f16bp", label(c, "f16bp", "Fructosa-1,6-biP")),
        ("dhap_gap", label(c, "dhap_gap", "DHAP + G3P")),
        ("pyruvate", label(c, "pyruvate", "Piruvato (3C) ×2")),
    ];
    let cofactors_right = ["", "ATP→ADP", "", "ATP→ADP", "", "2 NADH, 4 ATP"];
    let mut out = String::from("\\begin{tikzpicture}[node distance=1.3cm, font=\\small]\n");
    out.push_str("  \\tikzset{metabolite/.style={draw, rounded corners=3pt, fill=blue!10, minimum width=3.5cm, minimum height=0.55cm, align=center, font=\\footnotesize\\bfseries}}\n");
    for (i, (id, lbl)) in steps.iter().enumerate() {
        let pos = if i == 0 {
            String::new()
        } else {
            format!("[below of={}]", steps[i - 1].0)
        };
        out.push_str(&format!(
            "  \\node[metabolite] ({}) {} {{{}}};\n",
            id, pos, lbl
        ));
        if i > 0 {
            let cof = if show { cofactors_right[i] } else { "" };
            let cof_node = if !cof.is_empty() {
                format!(
                    " node[right=0.1cm, font=\\scriptsize, text=purple] {{\\scriptsize {}}}",
                    cof
                )
            } else {
                String::new()
            };
            out.push_str(&format!(
                "  \\draw[->] ({}) --{} ({});\n",
                steps[i - 1].0,
                cof_node,
                id
            ));
        }
    }
    out.push_str("\\end{tikzpicture}");
    out
}

fn photosynthesis(c: &BioPathwayConfig) -> String {
    format!(
        r#"\begin{{tikzpicture}}[scale=0.9, node distance=1.4cm]
  \tikzset{{react/.style={{draw, rounded corners=3pt, fill=green!15, minimum width=3cm,
                       minimum height=0.55cm, align=center, font=\footnotesize\bfseries}}}}
  \node[react] (co2)   {{{co2}}};
  \node[react] (rubp)  [below of=co2]  {{{rubp}}};
  \node[react] (pg3)   [below of=rubp] {{{pg3}}};
  \node[react] (g3p)   [below of=pg3]  {{{g3p}}};
  \node[react] (glucose)[below of=g3p]  {{{glucose}}};
  \draw[->] (co2)  -- node[right,font=\scriptsize] {{RuBisCO}} (rubp);
  \draw[->] (rubp) -- node[right,font=\scriptsize] {{ATP, NADPH}} (pg3);
  \draw[->] (pg3)  -- (g3p);
  \draw[->] (g3p)  -- (glucose);
  \draw[->, dashed] (g3p.west) to[out=180,in=180] node[left,font=\scriptsize] {{regeneración}} (rubp.west);
\end{{tikzpicture}}"#,
        co2 = label(c, "co2", "CO$_2$ (3×)"),
        rubp = label(c, "rubp", "RuBP (5C)"),
        pg3 = label(c, "pg3", "3-PGA (6C)"),
        g3p = label(c, "g3p", "G3P (6C)"),
        glucose = label(c, "glucose", "Glucosa"),
    )
}

fn electron_transport(c: &BioPathwayConfig) -> String {
    let steps = [
        (label(c, "ci", "Complejo I\\\\NADH DH"), "blue!15"),
        (label(c, "cii", "Complejo II\\\\Succinato DH"), "purple!15"),
        (label(c, "ciii", "Complejo III\\\\Cyt bc$_1$"), "red!15"),
        (label(c, "civ", "Complejo IV\\\\Cyt c oxidasa"), "orange!15"),
    ];
    let mut out = String::from("\\begin{tikzpicture}[node distance=1.8cm, font=\\small]\n");
    out.push_str("  \\tikzset{complex/.style={draw, rounded corners=3pt, minimum width=2.2cm, minimum height=1.2cm, align=center, font=\\footnotesize\\bfseries}}\n");
    for (i, (lbl, color)) in steps.iter().enumerate() {
        let pos = if i == 0 {
            String::new()
        } else {
            format!("[right of=c{}]", i)
        };
        out.push_str(&format!(
            "  \\node[complex, fill={}] (c{}) {} {{{}}};\n",
            color,
            i + 1,
            pos,
            lbl
        ));
    }
    for i in 1..steps.len() {
        out.push_str(&format!("  \\draw[->] (c{}) -- (c{});\n", i, i + 1));
    }
    out.push_str("  \\node[below=0.6cm of c1, font=\\scriptsize] {NADH / FADH$_2$};\n");
    out.push_str(
        "  \\node[below=0.6cm of c4, font=\\scriptsize] {$\\frac{1}{2}$O$_2$ + H$_2$O};\n",
    );
    if c.show_cofactors {
        out.push_str("  \\node[above=0.5cm, font=\\scriptsize, text=orange] at ($(c1)!0.5!(c4)$) {Bombeo de H$^+$ → ATP sintasa};\n");
    }
    out.push_str("\\end{tikzpicture}");
    out
}

fn beta_oxidation(c: &BioPathwayConfig) -> String {
    let steps = [
        label(c, "acyl", "Acil-CoA"),
        label(c, "enoyl", "Enoil-CoA"),
        label(c, "hydroxy", "3-OH-acil-CoA"),
        label(c, "ketoacyl", "3-Cetoacil-CoA"),
        label(c, "product", "Acetil-CoA + acil-CoA(n-2)"),
    ];
    let cofactors = if c.show_cofactors {
        ["", "FAD→FADH$_2$", "H$_2$O", "NAD$^+$→NADH", "CoA-SH"]
    } else {
        ["", "", "", "", ""]
    };
    let mut out = String::from("\\begin{tikzpicture}[node distance=1.3cm, font=\\small]\n");
    out.push_str("  \\tikzset{step/.style={draw, rounded corners, fill=yellow!15, minimum width=3.8cm, minimum height=0.55cm, align=center, font=\\footnotesize\\bfseries}}\n");
    for (i, lbl) in steps.iter().enumerate() {
        let pos = if i == 0 {
            String::new()
        } else {
            format!("[below of=s{}]", i)
        };
        out.push_str(&format!(
            "  \\node[step] (s{}) {} {{{}}};\n",
            i + 1,
            pos,
            lbl
        ));
        if i > 0 {
            let cf = cofactors[i];
            let cf_node = if !cf.is_empty() {
                format!(
                    " node[right=0.05cm, font=\\scriptsize] {{\\scriptsize {}}}",
                    cf
                )
            } else {
                String::new()
            };
            out.push_str(&format!(
                "  \\draw[->] (s{}) --{} (s{});\n",
                i,
                cf_node,
                i + 1
            ));
        }
    }
    out.push_str("\\end{tikzpicture}");
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::BioPathwayConfig;

    fn cfg(preset: &str) -> BioPathwayConfig {
        BioPathwayConfig {
            preset: preset.to_string(),
            custom_labels: Default::default(),
            show_cofactors: false,
        }
    }

    #[test]
    fn ninguna_funcion_usa_tikzstyle_deprecated() {
        for preset in &["glycolysis", "photosynthesis", "electron_transport", "beta_oxidation", "krebs_cycle"] {
            let out = render(&cfg(preset));
            assert!(!out.contains("\\tikzstyle"), "preset '{preset}' usa \\tikzstyle deprecated");
            assert!(out.contains("tikzpicture"), "preset '{preset}' debe generar tikzpicture");
        }
    }

    #[test]
    fn glycolysis_usa_tikzset() {
        let out = render(&cfg("glycolysis"));
        assert!(out.contains("\\tikzset{metabolite/.style={"), "glycolysis debe usar \\tikzset con sintaxis /.style={{");
    }

    #[test]
    fn photosynthesis_usa_tikzset() {
        let out = render(&cfg("photosynthesis"));
        assert!(out.contains("\\tikzset{react/.style={"), "photosynthesis debe usar \\tikzset");
    }

    #[test]
    fn krebs_tiene_cofactores_cuando_show_true() {
        let mut c = cfg("krebs_cycle");
        c.show_cofactors = true;
        let out = render(&c);
        assert!(out.contains("NADH"), "krebs con cofactores debe mostrar NADH");
    }

    #[test]
    fn custom_labels_se_escapan() {
        let mut c = cfg("glycolysis");
        c.custom_labels.insert("glucose".to_string(), "Glucosa & 6C".to_string());
        let out = render(&c);
        assert!(out.contains("\\&"), "& en custom label debe escaparse");
    }
}
