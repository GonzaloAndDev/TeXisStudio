use std::collections::HashSet;
use regex::Regex;
use super::model::{AcronymEntry, GlossaryEntry, GlossaryEntryStatus, GlossaryRegistry};

/// Parsea el bloque AUTO-GENERATED de glossary.tex para extraer entradas y acrónimos.
/// También escanea los .tex del cuerpo para detectar qué entradas se referencian.
pub struct GlossaryParser;

impl GlossaryParser {
    pub fn new() -> Self { Self }

    pub fn parse(&self, glossary_tex: &str, body_sources: &[&str]) -> GlossaryRegistry {
        let entries    = self.parse_entries(glossary_tex);
        let acronyms   = self.parse_acronyms(glossary_tex);
        let referenced = self.collect_references(body_sources);

        let entries: Vec<GlossaryEntry> = entries.into_iter().map(|mut e| {
            e.status = if referenced.contains(&e.key) {
                GlossaryEntryStatus::Active
            } else {
                GlossaryEntryStatus::DefinedUnused
            };
            e
        }).collect();

        let acronyms: Vec<AcronymEntry> = acronyms.into_iter().map(|mut a| {
            a.status = if referenced.contains(&a.key) {
                GlossaryEntryStatus::Active
            } else {
                GlossaryEntryStatus::DefinedUnused
            };
            a
        }).collect();

        // Detectar referencias a entradas no definidas
        let defined_keys: HashSet<_> = {
            let mut s = HashSet::new();
            // Re-parse to get keys (entries and acronyms)
            for e in self.parse_entries(glossary_tex) { s.insert(e.key); }
            for a in self.parse_acronyms(glossary_tex) { s.insert(a.key); }
            s
        };

        let mut undefined: Vec<GlossaryEntry> = referenced.iter()
            .filter(|k| !defined_keys.contains(*k))
            .map(|k| GlossaryEntry {
                key: k.clone(),
                name: k.clone(),
                name_plural: None,
                description: String::new(),
                symbol: None,
                category: None,
                status: GlossaryEntryStatus::UsedUndefined,
            })
            .collect();

        let mut all_entries = entries;
        all_entries.append(&mut undefined);

        GlossaryRegistry { entries: all_entries, acronyms }
    }

    fn parse_entries(&self, source: &str) -> Vec<GlossaryEntry> {
        let re = Regex::new(
            r#"\\newglossaryentry\{([^}]+)\}\{[^}]*name=\{([^}]*)\}[^}]*description=\{([^}]*)\}"#
        ).unwrap();

        re.captures_iter(source).map(|cap| GlossaryEntry {
            key: cap[1].trim().to_string(),
            name: cap[2].trim().to_string(),
            name_plural: None,
            description: cap[3].trim().to_string(),
            symbol: None,
            category: None,
            status: GlossaryEntryStatus::Active,
        }).collect()
    }

    fn parse_acronyms(&self, source: &str) -> Vec<AcronymEntry> {
        let re = Regex::new(
            r#"\\newacronym\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}"#
        ).unwrap();

        re.captures_iter(source).map(|cap| AcronymEntry {
            key: cap[1].trim().to_string(),
            short: cap[2].trim().to_string(),
            long: cap[3].trim().to_string(),
            long_plural: None,
            description: None,
            status: GlossaryEntryStatus::Active,
        }).collect()
    }

    fn collect_references(&self, sources: &[&str]) -> HashSet<String> {
        let re = Regex::new(
            r#"\\(?:gls|Gls|GLS|glspl|Glspl|GLSpl|acrshort|acrlong|acrfull|glssymbol)\{([^}]+)\}"#
        ).unwrap();

        let mut keys = HashSet::new();
        for source in sources {
            for cap in re.captures_iter(source) {
                keys.insert(cap[1].trim().to_string());
            }
        }
        keys
    }
}

impl Default for GlossaryParser {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_acronym() {
        let parser = GlossaryParser::new();
        let glossary = r"\newacronym{api}{API}{Application Programming Interface}";
        let result = parser.parse(glossary, &[]);
        assert_eq!(result.acronyms.len(), 1);
        assert_eq!(result.acronyms[0].key, "api");
        assert_eq!(result.acronyms[0].short, "API");
    }

    #[test]
    fn detects_unused_entry() {
        let parser = GlossaryParser::new();
        let glossary = r"\newacronym{api}{API}{Application Programming Interface}";
        let result = parser.parse(glossary, &[r"No hay referencias aquí."]);
        assert_eq!(result.unused_entries().len(), 0); // acronyms not in unused_entries
        assert!(!result.acronyms.is_empty());
        assert_eq!(result.acronyms[0].status, GlossaryEntryStatus::DefinedUnused);
    }

    #[test]
    fn detects_active_entry_when_referenced() {
        let parser = GlossaryParser::new();
        let glossary = r"\newacronym{api}{API}{Application Programming Interface}";
        let body = r"Se usa \gls{api} en este documento.";
        let result = parser.parse(glossary, &[body]);
        assert_eq!(result.acronyms[0].status, GlossaryEntryStatus::Active);
    }
}
