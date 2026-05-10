// Parser básico de archivos .bib — Release 0.1 (stub funcional).

use crate::error::{CoreError, CoreResult};
use std::path::Path;

#[derive(Debug, Clone)]
pub struct BibEntry {
    pub key: String,
    pub entry_type: String,
    pub fields: std::collections::HashMap<String, String>,
}

pub struct BibParser;

impl BibParser {
    pub fn parse_file(&self, path: &Path) -> CoreResult<Vec<BibEntry>> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        Ok(self.parse_str(&content))
    }

    pub fn parse_str(&self, content: &str) -> Vec<BibEntry> {
        // Parser mínimo: extrae claves y tipos de entradas BibTeX.
        let mut entries = Vec::new();
        for chunk in content.split('@').skip(1) {
            let chunk = chunk.trim();
            if let Some(brace) = chunk.find('{') {
                let entry_type = chunk[..brace].trim().to_lowercase();
                let rest = &chunk[brace + 1..];
                if let Some(comma) = rest.find(',') {
                    let key = rest[..comma].trim().to_string();
                    entries.push(BibEntry {
                        key,
                        entry_type,
                        fields: std::collections::HashMap::new(),
                    });
                }
            }
        }
        entries
    }
}
