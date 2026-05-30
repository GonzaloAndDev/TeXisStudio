// Renderer para fragmentos musicales (ABC → MusiXTeX o advertencia de fallback).

use crate::project::model::MusicFragmentConfig;

pub fn render(c: &MusicFragmentConfig) -> String {
    if c.abc_notation.trim().is_empty() {
        return render_placeholder("Fragmento musical vacío");
    }

    if !c.try_musixtex {
        return render_placeholder(&format!(
            "Partitura: {}. Importar como figura SVG/PDF externa.",
            c.instrument.as_deref().unwrap_or("instrumento no especificado")
        ));
    }

    // Intentar generar una partitura MusiXTeX básica desde ABC.
    // ABC notation es más simple que musixtex, así que hacemos una conversión
    // básica para fragmentos cortos. Para complejidad real, recomendamos
    // exportar LilyPond → PDF → importar como figura.
    render_musixtex_from_abc(c)
}

fn render_placeholder(msg: &str) -> String {
    format!(r#"\begin{{center}}
  \fbox{{\begin{{minipage}}{{0.7\linewidth}}\centering\vspace{{8pt}}
    \textit{{\small {}}}
  \vspace{{8pt}}\end{{minipage}}}}
\end{{center}}"#, msg)
}

fn render_musixtex_from_abc(c: &MusicFragmentConfig) -> String {
    // Extraer algunas propiedades básicas del ABC
    let title = extract_abc_field(&c.abc_notation, 'T')
        .unwrap_or_else(|| c.instrument.as_deref().unwrap_or("Fragmento").to_string());
    let key  = extract_abc_field(&c.abc_notation, 'K').unwrap_or_else(|| "C".to_string());
    let meter = extract_abc_field(&c.abc_notation, 'M').unwrap_or_else(|| "4/4".to_string());

    // Extraer body (notas)
    let body = c.abc_notation.lines()
        .filter(|l| !l.starts_with(|c: char| c.is_ascii_uppercase() && c != 'X'))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    // Convertir notas ABC simples a musixtex (mapeo básico de octava central)
    let musixtex_notes = abc_to_musixtex_basic(&body);

    let (numer, denom) = parse_meter(&meter);
    let notes_out = if musixtex_notes.is_empty() {
        "\\Notes \\qu{c}\\qu{d}\\qu{e}\\qu{f} \\en".to_string()
    } else {
        musixtex_notes
    };
    // No usar format! con {} literal — construir con push_str
    let mut out = String::new();
    out.push_str("\\begin{music}\n");
    out.push_str("\\parindent 8mm\n");
    out.push_str("\\instrumentnumber{1}\n");
    out.push_str("\\setname1{}\n");
    out.push_str(&format!("\\generalmeter{{\\meterfrac{{{}}}{{{}}}}}\n", numer, denom));
    out.push_str("\\startextract\n");
    out.push_str(&notes_out);
    out.push('\n');
    out.push_str("\\endextract\n");
    out.push_str("\\end{music}");
    out
}

fn extract_abc_field(abc: &str, field: char) -> Option<String> {
    abc.lines()
        .find(|l| l.starts_with(field) && l.get(1..2) == Some(":"))
        .map(|l| l[2..].trim().to_string())
}

fn parse_meter(meter: &str) -> (u8, u8) {
    if meter == "C" || meter == "c" { return (4, 4); }
    if meter == "C|" || meter == "c|" { return (2, 2); }
    let parts: Vec<&str> = meter.splitn(2, '/').collect();
    let num = parts.get(0).and_then(|s| s.trim().parse().ok()).unwrap_or(4u8);
    let den = parts.get(1).and_then(|s| s.trim().parse().ok()).unwrap_or(4u8);
    (num, den)
}

fn abc_to_musixtex_basic(abc_body: &str) -> String {
    // Mapeo muy básico: letras ABC a notas musixtex (solo octava media)
    let mut notes = String::new();
    let note_map: &[(&str, &str)] = &[
        ("C", "c"), ("D", "d"), ("E", "e"), ("F", "f"),
        ("G", "g"), ("A", "a"), ("B", "b"),
        ("c", "h"), ("d", "i"), ("e", "j"), ("f", "k"),
        ("g", "l"), ("a", "m"), ("b", "n"),
    ];

    let clean = abc_body
        .chars()
        .filter(|c| c.is_ascii_alphabetic() || *c == '|')
        .collect::<String>();

    let mut bar_notes = Vec::new();
    for ch in clean.chars() {
        if ch == '|' {
            if !bar_notes.is_empty() {
                notes.push_str(&format!("\\Notes {} \\en\n", bar_notes.join("")));
                notes.push_str("\\bar\n");
                bar_notes.clear();
            }
        } else if let Some((_, mx)) = note_map.iter().find(|(a, _)| *a == ch.to_string()) {
            bar_notes.push(format!("\\qu{{{}}}", mx));
        }
    }
    if !bar_notes.is_empty() {
        notes.push_str(&format!("\\Notes {} \\en\n", bar_notes.join("")));
    }

    notes
}
