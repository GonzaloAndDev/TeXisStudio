// Parser de archivos .bib — extrae tipo, clave y campos principales.

use crate::error::{CoreError, CoreResult};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct BibEntry {
    pub key: String,
    pub entry_type: String,
    pub fields: HashMap<String, String>,
}

impl BibEntry {
    /// Título normalizado (vacío si no existe).
    pub fn title(&self) -> &str {
        self.fields.get("title").map(|s| s.as_str()).unwrap_or("")
    }
    /// Autores normalizados.
    pub fn author(&self) -> &str {
        self.fields.get("author").map(|s| s.as_str()).unwrap_or("")
    }
    /// Año como cadena.
    pub fn year(&self) -> &str {
        self.fields.get("year").map(|s| s.as_str()).unwrap_or("")
    }
}

pub struct BibParser;

impl BibParser {
    pub fn parse_file(&self, path: &Path) -> CoreResult<Vec<BibEntry>> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        Ok(self.parse_str(&content))
    }

    pub fn parse_str(&self, content: &str) -> Vec<BibEntry> {
        let mut entries = Vec::new();
        // Dividir en bloques de entrada usando '@' como delimitador
        for chunk in content.split('@').skip(1) {
            let chunk = chunk.trim();

            // Ignorar comentarios y preámbulos
            let lower = chunk.to_lowercase();
            if lower.starts_with("comment")
                || lower.starts_with("preamble")
                || lower.starts_with("string")
            {
                continue;
            }

            if let Some(brace_pos) = chunk.find('{') {
                let entry_type = chunk[..brace_pos].trim().to_lowercase();
                let inner = &chunk[brace_pos + 1..];

                // Localizar la llave de cierre balanceada
                let inner = balanced_content(inner);

                // Primera línea: clave de la entrada
                if let Some(comma_pos) = inner.find(',') {
                    let key = inner[..comma_pos].trim().to_string();
                    let fields_str = &inner[comma_pos + 1..];
                    let fields = parse_fields(fields_str);
                    entries.push(BibEntry {
                        key,
                        entry_type,
                        fields,
                    });
                }
            }
        }
        entries
    }
}

/// Extrae el contenido hasta la llave de cierre balanceada.
fn balanced_content(s: &str) -> &str {
    let mut depth: i32 = 1;
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return &s[..i];
                }
            }
            _ => {}
        }
    }
    s
}

/// Parsea los campos `nombre = {valor}` o `nombre = "valor"` de un bloque BibTeX.
fn parse_fields(fields_str: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut pos = 0;
    let chars: Vec<char> = fields_str.chars().collect();
    let len = chars.len();

    while pos < len {
        // Saltar espacios y comas
        while pos < len && (chars[pos].is_whitespace() || chars[pos] == ',') {
            pos += 1;
        }
        if pos >= len {
            break;
        }

        // Leer nombre del campo (hasta '=')
        let name_start = pos;
        while pos < len && chars[pos] != '=' && chars[pos] != '}' {
            pos += 1;
        }
        if pos >= len || chars[pos] == '}' {
            break;
        }
        let field_name = chars[name_start..pos]
            .iter()
            .collect::<String>()
            .trim()
            .to_lowercase();
        pos += 1; // saltar '='

        // Saltar espacios
        while pos < len && chars[pos].is_whitespace() {
            pos += 1;
        }
        if pos >= len {
            break;
        }

        // Leer valor: {…} o "…" o número
        let value = if chars[pos] == '{' {
            pos += 1;
            extract_braced(&chars, &mut pos)
        } else if chars[pos] == '"' {
            pos += 1;
            extract_quoted(&chars, &mut pos)
        } else {
            // número u otro literal hasta coma o llave
            let start = pos;
            while pos < len && chars[pos] != ',' && chars[pos] != '}' && !chars[pos].is_whitespace()
            {
                pos += 1;
            }
            chars[start..pos].iter().collect::<String>()
        };

        if !field_name.is_empty() {
            map.insert(field_name, value);
        }
    }

    map
}

/// Extrae contenido entre llaves balanceadas (pos apunta al primer char dentro de la llave).
fn extract_braced(chars: &[char], pos: &mut usize) -> String {
    let mut result = String::new();
    let mut depth: i32 = 1;
    while *pos < chars.len() {
        match chars[*pos] {
            '{' => {
                depth += 1;
                result.push('{');
            }
            '}' => {
                depth -= 1;
                if depth == 0 {
                    *pos += 1;
                    return result;
                }
                result.push('}');
            }
            c => result.push(c),
        }
        *pos += 1;
    }
    result
}

/// Extrae contenido entre comillas.
fn extract_quoted(chars: &[char], pos: &mut usize) -> String {
    let mut result = String::new();
    while *pos < chars.len() && chars[*pos] != '"' {
        result.push(chars[*pos]);
        *pos += 1;
    }
    if *pos < chars.len() {
        *pos += 1;
    } // saltar '"' de cierre
    result
}
