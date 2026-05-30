// Renderer TikZ para líneas de tiempo.

use crate::project::model::TimelineConfig;
use crate::template::escape::latex_escape;

pub fn render(c: &TimelineConfig) -> String {
    if c.events.is_empty() {
        return "% Timeline vacío\n".to_string();
    }

    let color = tikz_color(&c.accent_color);

    if c.orientation == "vertical" {
        render_vertical(c, color)
    } else {
        render_horizontal(c, color)
    }
}

fn tikz_color(color: &str) -> &str {
    match color {
        "blue"|"#3498DB"   => "blue",
        "red"|"#E74C3C"    => "red",
        "green"|"#27AE60"  => "green!60!black",
        "purple"|"#9B59B6" => "purple",
        "orange"|"#E67E22" => "orange!80!black",
        "teal"|"#1ABC9C"   => "teal",
        _                  => "blue",
    }
}

fn render_horizontal(c: &TimelineConfig, color: &str) -> String {
    let n = c.events.len();
    let width = (n as f32 * 3.2).max(8.0);
    let step = width / (n as f32).max(1.0);

    let mut out = format!(
        "\\begin{{tikzpicture}}[scale=1.0, x=1cm]\n  % Línea principal\n  \\draw[{color}, thick, ->] (0,0) -- ({width:.1},0);\n",
    );

    for (i, event) in c.events.iter().enumerate() {
        let x = i as f32 * step + step * 0.5;
        let above = i % 2 == 0;
        let y_mark = if above { 0.15 } else { -0.15 };
        let y_label = if above { 0.5 } else { -0.5 };
        let y_date  = if above { 0.25 } else { -0.25 };
        let anchor  = if above { "south" } else { "north" };

        out.push_str(&format!(
            "  \\fill[{color}] ({x:.2},0) circle (3pt);\n",
        ));
        out.push_str(&format!(
            "  \\draw[{color}] ({x:.2},{y_mark:.2}) -- ({x:.2},{y_label:.2});\n",
        ));
        out.push_str(&format!(
            "  \\node[font=\\scriptsize\\bfseries, {anchor}={y_label:.2}cm, align=center] at ({x:.2},0) {{{}}};\n",
            latex_escape(&event.title),
        ));
        out.push_str(&format!(
            "  \\node[font=\\tiny, {anchor}={y_date:.2}cm, text=gray] at ({x:.2},0) {{{}}};\n",
            latex_escape(&event.date),
        ));
    }

    out.push_str("\\end{tikzpicture}");
    out
}

fn render_vertical(c: &TimelineConfig, color: &str) -> String {
    let n = c.events.len();
    let height = (n as f32 * 1.8).max(4.0);

    let mut out = format!(
        "\\begin{{tikzpicture}}[scale=1.0]\n  \\draw[{color}, thick] (0,0) -- (0,-{height:.1});\n",
    );

    for (i, event) in c.events.iter().enumerate() {
        let y = -(i as f32 * 1.8 + 0.6);
        out.push_str(&format!(
            "  \\fill[{color}] (0,{y:.2}) circle (4pt);\n  \\draw[{color}!50] (0,{y:.2}) -- (0.3,{y:.2});\n",
        ));
        out.push_str(&format!(
            "  \\node[right=0.4cm, font=\\small\\bfseries, anchor=west] at (0,{y:.2}) {{{}}};\n",
            latex_escape(&event.title),
        ));
        out.push_str(&format!(
            "  \\node[left=0.1cm, font=\\scriptsize, text=gray, anchor=east] at (0,{y:.2}) {{{}}};\n",
            latex_escape(&event.date),
        ));
        if let Some(desc) = &event.description {
            out.push_str(&format!(
                "  \\node[right=0.4cm, font=\\footnotesize, text=gray, anchor=west] at (0,{y:.2}-0.35) {{{}}};\n",
                latex_escape(desc),
            ));
        }
    }

    out.push_str("\\end{tikzpicture}");
    out
}
