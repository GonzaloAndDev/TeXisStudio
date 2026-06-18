// Renderer circuitikz para circuitos eléctricos (presets).

use crate::project::model::CircuitConfig;

// Los valores de componentes se insertan dentro de to[R, l=$VALUE$].
// Un ] cierra prematuramente el argumento to[...]; un $ cierra el modo math.
// Los newlines rompen la línea LaTeX. Resto de caracteres (_, ^, {, }) son
// válidos en math mode y necesarios para etiquetas como R_1, R_f.
fn sanitize_circuit_label(s: &str) -> String {
    s.chars()
        .filter(|c| !matches!(c, ']' | '$' | '\n' | '\r'))
        .take(50)
        .collect()
}

pub fn render(c: &CircuitConfig) -> String {
    let vals = &c.component_values;
    let r = sanitize_circuit_label(vals.get("R").map(|s| s.as_str()).unwrap_or("R"));
    let c_ = sanitize_circuit_label(vals.get("C").map(|s| s.as_str()).unwrap_or("C"));
    let l = sanitize_circuit_label(vals.get("L").map(|s| s.as_str()).unwrap_or("L"));
    let v = sanitize_circuit_label(vals.get("V").map(|s| s.as_str()).unwrap_or("V"));

    match c.preset.as_str() {
        "rc_series" => rc_series(&r, &c_),
        "rlc_parallel" => rlc_parallel(&r, &l, &c_),
        "voltage_divider" => voltage_divider(&r, &v),
        "inverting_opamp" => inverting_opamp(&r),
        "full_wave_rectifier" => full_wave_rectifier(&v),
        _ => rc_series(&r, &c_),
    }
}

fn rc_series(r: &str, cap: &str) -> String {
    format!(
        r#"\begin{{circuitikz}}[scale=0.9]
  \draw (0,0) to[battery1, l=$V_s$] (0,2.5)
        -- (2,2.5) to[R, l=${r}$] (4,2.5)
        -- (4,1.5) to[C, l=${cap}$] (4,0)
        -- (0,0);
  \draw[fill] (0,0) circle (1.5pt);
  \draw[fill] (0,2.5) circle (1.5pt);
\end{{circuitikz}}"#
    )
}

fn rlc_parallel(r: &str, l: &str, cap: &str) -> String {
    format!(
        r#"\begin{{circuitikz}}[scale=0.9]
  \draw (0,0) -- (0,3);
  \draw (0,3) -- (3,3);
  \draw (0,0) -- (3,0);
  \draw (3,3) to[R, l=${r}$] (3,0);
  \draw (5,3) to[L, l=${l}$] (5,0);
  \draw (7,3) to[C, l=${cap}$] (7,0);
  \draw (3,3) -- (7,3);
  \draw (3,0) -- (7,0);
  \draw (0,1.5) to[battery1, l=$V_s$] (0,1.5);
\end{{circuitikz}}"#
    )
}

fn voltage_divider(r: &str, v: &str) -> String {
    format!(
        r#"\begin{{circuitikz}}[scale=0.9]
  \draw (0,0) to[battery1, l=${v}$] (0,4)
        -- (2,4) to[R, l=${r}_1$] (2,2)
        to[R, l=${r}_2$] (2,0)
        -- (0,0);
  \draw (2,2) -- (3.5,2) node[right] {{$V_{{out}}$}};
  \draw[fill] (2,2) circle (1.5pt);
\end{{circuitikz}}"#
    )
}

fn inverting_opamp(r: &str) -> String {
    format!(
        r#"\begin{{circuitikz}}[scale=0.9]
  \draw (0,1.5) node[op amp] (opamp) {{}};
  \draw (opamp.+) -- ++(0,-0.8) node[ground] {{}};
  \draw (opamp.out) -- ++(0.8,0) node[right] {{$V_{{out}}$}};
  \draw (opamp.-) to[R, l=${r}_1$] ++(-2.5,0) node[left] {{$V_{{in}}$}};
  \draw (opamp.-)  ++(0,0) to[R, l=${r}_f$] ++(0,1.6) -| (opamp.out);
\end{{circuitikz}}"#
    )
}

fn full_wave_rectifier(v: &str) -> String {
    format!(
        r#"\begin{{circuitikz}}[scale=0.85]
  \draw (0,0) to[sV, l=${v}$] (0,3)
        -- (1.5,3) to[D] (3,4.5)
        to[D] (4.5,3) -- (6,3) to[R, l=$R_L$] (6,0) -- (0,0);
  \draw (1.5,3) to[D, invert] (3,1.5)
        to[D, invert] (4.5,3);
  \draw (3,4.5) -- (3,4.8) node[above] {{$V_{{out}}^+$}};
  \draw (3,1.5) -- (3,1.2) node[below] {{$V_{{out}}^-$}};
\end{{circuitikz}}"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_closing_bracket() {
        assert_eq!(sanitize_circuit_label("R]evil"), "Revil");
    }

    #[test]
    fn sanitize_strips_dollar_sign() {
        assert_eq!(sanitize_circuit_label("10k$Omega"), "10kOmega");
    }

    #[test]
    fn sanitize_strips_newlines() {
        assert_eq!(sanitize_circuit_label("10k\n\\evil"), "10k\\evil");
    }

    #[test]
    fn sanitize_preserves_subscript_syntax() {
        // _ y ^ son válidos en math mode de circuitikz
        assert_eq!(sanitize_circuit_label("R_1"), "R_1");
        assert_eq!(sanitize_circuit_label("R_f"), "R_f");
    }

    #[test]
    fn sanitize_truncates_long_label() {
        let long = "R".repeat(100);
        assert_eq!(sanitize_circuit_label(&long).len(), 50);
    }

    #[test]
    fn render_rc_series_uses_sanitized_values() {
        use crate::project::model::CircuitConfig;
        let mut vals = std::collections::HashMap::new();
        // El ] intentaría cerrar el argumento to[...] de circuitikz prematuramente
        vals.insert("R".to_string(), "10k]\\draw".to_string());
        vals.insert("C".to_string(), "100nF".to_string());
        let c = CircuitConfig {
            preset: "rc_series".to_string(),
            component_values: vals,
        };
        let out = render(&c);
        // El ] del valor no debe aparecer seguido del texto inyectado
        assert!(
            !out.contains("]\\draw"),
            "la secuencia de inyección ]\\draw no debe aparecer en la salida"
        );
        assert!(
            out.contains("10k"),
            "el valor limpio de R debe estar presente"
        );
        assert!(
            out.contains("circuitikz"),
            "la salida debe ser un entorno circuitikz válido"
        );
    }

    #[test]
    fn render_all_presets_produce_circuitikz() {
        use crate::project::model::CircuitConfig;
        for preset in &[
            "rc_series",
            "rlc_parallel",
            "voltage_divider",
            "inverting_opamp",
            "full_wave_rectifier",
            "unknown",
        ] {
            let c = CircuitConfig {
                preset: preset.to_string(),
                component_values: Default::default(),
            };
            let out = render(&c);
            assert!(
                out.contains("circuitikz"),
                "preset '{preset}' debe generar circuitikz"
            );
        }
    }
}
