// Renderer circuitikz para circuitos eléctricos (presets).

use crate::project::model::CircuitConfig;

pub fn render(c: &CircuitConfig) -> String {
    let vals = &c.component_values;
    let r = vals.get("R").map(|s| s.as_str()).unwrap_or("R");
    let c_ = vals.get("C").map(|s| s.as_str()).unwrap_or("C");
    let l = vals.get("L").map(|s| s.as_str()).unwrap_or("L");
    let v = vals.get("V").map(|s| s.as_str()).unwrap_or("V");

    match c.preset.as_str() {
        "rc_series" => rc_series(r, c_),
        "rlc_parallel" => rlc_parallel(r, l, c_),
        "voltage_divider" => voltage_divider(r, v),
        "inverting_opamp" => inverting_opamp(r),
        "full_wave_rectifier" => full_wave_rectifier(v),
        _ => rc_series(r, c_),
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
