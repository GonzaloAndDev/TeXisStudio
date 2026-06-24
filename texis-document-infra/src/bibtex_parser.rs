//! Parser BibTeX mínimo (§7.5, Etapa F): normaliza entradas `.bib` a `BibEntry`.
//!
//! Soporta `@type{key, campo = {valor} | "valor" | valor, ...}`. Es deliberadamente
//! tolerante; la validación profesional la hace el dominio sobre las entradas
//! normalizadas. No es un parser LaTeX completo: extrae estructura, no compila.

use texis_document_domain::ir::modules::BibEntry;

/// Parsea el contenido de un archivo `.bib` en entradas normalizadas.
pub fn parse(input: &str) -> Vec<BibEntry> {
    let mut entries = Vec::new();
    let bytes: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == '@' {
            if let Some((entry, next)) = parse_entry(&bytes, i) {
                entries.push(entry);
                i = next;
                continue;
            }
        }
        i += 1;
    }
    entries
}

fn parse_entry(c: &[char], start: usize) -> Option<(BibEntry, usize)> {
    // @type
    let mut i = start + 1;
    let type_begin = i;
    while i < c.len() && (c[i].is_ascii_alphanumeric()) {
        i += 1;
    }
    let entry_type: String = c[type_begin..i].iter().collect::<String>().to_lowercase();
    if entry_type.is_empty() {
        return None;
    }
    // Saltar espacios hasta '{'.
    while i < c.len() && c[i] != '{' {
        i += 1;
    }
    if i >= c.len() {
        return None;
    }
    i += 1; // tras '{'

    // key hasta la primera ','.
    let key_begin = i;
    while i < c.len() && c[i] != ',' && c[i] != '}' {
        i += 1;
    }
    let key: String = c[key_begin..i]
        .iter()
        .collect::<String>()
        .trim()
        .to_string();
    let mut entry = BibEntry::new(key, entry_type);
    if i < c.len() && c[i] == ',' {
        i += 1;
    }

    // Campos hasta el '}' de cierre de la entrada (nivel 0).
    loop {
        // Saltar separadores/espacios.
        while i < c.len() && (c[i].is_whitespace() || c[i] == ',') {
            i += 1;
        }
        if i >= c.len() || c[i] == '}' {
            if i < c.len() {
                i += 1; // consumir '}'
            }
            break;
        }
        // Nombre del campo.
        let name_begin = i;
        while i < c.len() && c[i] != '=' && c[i] != '}' {
            i += 1;
        }
        if i >= c.len() || c[i] == '}' {
            break;
        }
        let name: String = c[name_begin..i]
            .iter()
            .collect::<String>()
            .trim()
            .to_lowercase();
        i += 1; // tras '='
        while i < c.len() && c[i].is_whitespace() {
            i += 1;
        }
        let value = parse_value(c, &mut i);
        if !name.is_empty() {
            entry.fields.insert(name, normalize_ws(&value));
        }
    }

    Some((entry, i))
}

/// Parsea un valor: `{...}` (con anidación), `"..."` o token simple.
fn parse_value(c: &[char], i: &mut usize) -> String {
    if *i >= c.len() {
        return String::new();
    }
    match c[*i] {
        '{' => {
            let mut depth = 0;
            let mut out = String::new();
            while *i < c.len() {
                match c[*i] {
                    '{' => {
                        if depth > 0 {
                            out.push('{');
                        }
                        depth += 1;
                    }
                    '}' => {
                        depth -= 1;
                        if depth == 0 {
                            *i += 1;
                            break;
                        }
                        out.push('}');
                    }
                    ch => out.push(ch),
                }
                *i += 1;
            }
            out
        }
        '"' => {
            let mut out = String::new();
            *i += 1;
            while *i < c.len() && c[*i] != '"' {
                out.push(c[*i]);
                *i += 1;
            }
            if *i < c.len() {
                *i += 1; // cerrar comilla
            }
            out
        }
        _ => {
            let mut out = String::new();
            while *i < c.len() && c[*i] != ',' && c[*i] != '}' {
                out.push(c[*i]);
                *i += 1;
            }
            out.trim().to_string()
        }
    }
}

fn normalize_ws(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_entries() {
        let bib = r#"
            @article{turing1936,
              author = {Alan Turing},
              title  = "On Computable Numbers",
              journal= {Proc. LMS},
              year   = {1936}
            }
            @book{knuth1984, author={Donald Knuth}, title={The TeXbook},
              publisher={Addison-Wesley}, year={1984}}
        "#;
        let entries = parse(bib);
        assert_eq!(entries.len(), 2);
        let t = &entries[0];
        assert_eq!(t.key, "turing1936");
        assert_eq!(t.entry_type, "article");
        assert_eq!(t.field("author"), Some("Alan Turing"));
        assert_eq!(t.field("year"), Some("1936"));
        assert_eq!(entries[1].key, "knuth1984");
        assert_eq!(entries[1].entry_type, "book");
    }
}
