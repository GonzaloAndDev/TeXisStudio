use super::model::{BibliographicRecord, RecordType};
use super::normalization::bcp47_to_langid;
use serde_json::{json, Value};

// ── Escape LaTeX ──────────────────────────────────────────────────────────────

/// Escapa caracteres especiales de LaTeX en campos de texto plano.
/// NO aplicar a doi, url, issn, isbn — son verbatim.
fn escape_latex(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '%' => out.push_str("\\%"),
            '&' => out.push_str("\\&"),
            '#' => out.push_str("\\#"),
            '$' => out.push_str("\\$"),
            '_' => out.push_str("\\_"),
            '\\' => out.push_str("\\textbackslash{}"),
            '~' => out.push_str("\\textasciitilde{}"),
            '^' => out.push_str("\\textasciicircum{}"),
            c => out.push(c),
        }
    }
    out
}

// ── BibLaTeX exporter ─────────────────────────────────────────────────────────

pub struct BibLaTeXExporter;

impl BibLaTeXExporter {
    /// Exporta un BibliographicRecord a una entrada BibLaTeX lista para usar en .bib.
    pub fn export(&self, record: &BibliographicRecord) -> String {
        let entry_type = record.record_type.to_bibtex_type();
        let key = &record.cite_key;
        let mut fields: Vec<(&str, String, bool)> = Vec::new();
        // (nombre, valor, es_texto) — es_texto=true → aplicar escape LaTeX

        // Autores y editores
        if !record.authors.is_empty() {
            let authors = record
                .authors
                .iter()
                .map(|a| a.to_bibtex())
                .collect::<Vec<_>>()
                .join(" and ");
            fields.push(("author", authors, true));
        }
        if !record.editors.is_empty() {
            let editors = record
                .editors
                .iter()
                .map(|a| a.to_bibtex())
                .collect::<Vec<_>>()
                .join(" and ");
            fields.push(("editor", editors, true));
        }

        // Título
        if let Some(title) = &record.title {
            let full_title = if let Some(sub) = &record.subtitle {
                format!("{}: {}", title, sub)
            } else {
                title.clone()
            };
            fields.push(("title", full_title, true));
        }

        // Fecha
        if let Some(date) = &record.date {
            fields.push(("date", date.to_string(), false));
        } else if let Some(year) = record.year {
            fields.push(("year", year.to_string(), false));
        }

        // Publicación
        match &record.record_type {
            RecordType::Article => {
                if let Some(j) = &record.journal {
                    fields.push(("journaltitle", j.clone(), true));
                }
            }
            RecordType::BookChapter | RecordType::ConferencePaper => {
                if let Some(bt) = &record.booktitle {
                    fields.push(("booktitle", bt.clone(), true));
                }
            }
            RecordType::Thesis => {
                if let Some(inst) = &record.institution {
                    fields.push(("institution", inst.clone(), true));
                }
            }
            RecordType::TechReport => {
                if let Some(inst) = &record.institution {
                    fields.push(("institution", inst.clone(), true));
                }
            }
            _ => {}
        }

        if let Some(pub_) = &record.publisher {
            fields.push(("publisher", pub_.clone(), true));
        }

        // Volumen / número / páginas
        if let Some(v) = &record.volume {
            fields.push(("volume", v.clone(), false));
        }
        if let Some(n) = &record.issue {
            fields.push(("number", n.clone(), false));
        }
        if let Some(p) = &record.pages {
            fields.push(("pages", p.clone(), false));
        }
        if let Some(e) = &record.edition {
            fields.push(("edition", e.clone(), false));
        }
        if let Some(s) = &record.series {
            fields.push(("series", s.clone(), true));
        }

        // Identificadores (sin escape LaTeX)
        if let Some(doi) = &record.doi {
            fields.push(("doi", doi.clone(), false));
        }
        if let Some(isbn) = &record.isbn {
            fields.push(("isbn", isbn.clone(), false));
        }
        if let Some(issn) = &record.issn {
            fields.push(("issn", issn.clone(), false));
        }
        if let Some(url) = &record.url {
            fields.push(("url", url.clone(), false));
        }

        // Idioma
        if let Some(lang) = &record.language {
            fields.push(("langid", bcp47_to_langid(lang).to_string(), false));
        }

        // Abstract
        if let Some(abs) = &record.abstract_text {
            fields.push(("abstract", abs.clone(), true));
        }

        self.render(&entry_type, key, &fields)
    }

    fn render(&self, entry_type: &str, key: &str, fields: &[(&str, String, bool)]) -> String {
        let max_width = fields.iter().map(|(k, _, _)| k.len()).max().unwrap_or(0);
        let mut out = format!("@{}{{{},\n", entry_type, key);
        for (name, value, is_text) in fields {
            let clean = if *is_text {
                escape_latex(value)
            } else {
                value.clone()
            };
            if clean.is_empty() {
                continue;
            }
            out.push_str(&format!(
                "  {:<width$} = {{{}}},\n",
                name,
                clean,
                width = max_width
            ));
        }
        out.push('}');
        out
    }
}

// ── CSL-JSON exporter ─────────────────────────────────────────────────────────

pub struct CslJsonExporter;

impl CslJsonExporter {
    /// Exporta un registro a un objeto JSON conforme a CSL-JSON.
    pub fn export(&self, record: &BibliographicRecord) -> Value {
        let mut obj = json!({
            "id": record.cite_key,
            "type": record.record_type.to_csl_type(),
        });

        let map = obj.as_object_mut().unwrap();

        if let Some(title) = &record.title {
            map.insert("title".to_string(), json!(title));
        }

        if !record.authors.is_empty() {
            let authors: Vec<Value> = record
                .authors
                .iter()
                .map(|a| {
                    if a.is_organization {
                        json!({"literal": a.family})
                    } else {
                        let mut entry = json!({"family": a.family});
                        if let Some(given) = &a.given {
                            entry["given"] = json!(given);
                        }
                        entry
                    }
                })
                .collect();
            map.insert("author".to_string(), json!(authors));
        }

        if !record.editors.is_empty() {
            let editors: Vec<Value> = record
                .editors
                .iter()
                .map(|a| {
                    if a.is_organization {
                        json!({"literal": a.family})
                    } else {
                        let mut entry = json!({"family": a.family});
                        if let Some(given) = &a.given {
                            entry["given"] = json!(given);
                        }
                        entry
                    }
                })
                .collect();
            map.insert("editor".to_string(), json!(editors));
        }

        // Fecha
        if let Some(date) = &record.date {
            map.insert(
                "issued".to_string(),
                json!({
                    "date-parts": [[date.year(), date.month(), date.day()]]
                }),
            );
        } else if let Some(year) = record.year {
            map.insert(
                "issued".to_string(),
                json!({ "date-parts": [[year]] }),
            );
        }

        // Container title
        let container = record
            .journal
            .as_deref()
            .or(record.booktitle.as_deref());
        if let Some(ct) = container {
            map.insert("container-title".to_string(), json!(ct));
        }

        if let Some(pub_) = &record.publisher {
            map.insert("publisher".to_string(), json!(pub_));
        }
        if let Some(inst) = &record.institution {
            map.insert("publisher".to_string(), json!(inst));
        }
        if let Some(v) = &record.volume {
            map.insert("volume".to_string(), json!(v));
        }
        if let Some(n) = &record.issue {
            map.insert("issue".to_string(), json!(n));
        }
        if let Some(p) = &record.pages {
            map.insert("page".to_string(), json!(p));
        }
        if let Some(doi) = &record.doi {
            map.insert("DOI".to_string(), json!(doi));
        }
        if let Some(isbn) = &record.isbn {
            map.insert("ISBN".to_string(), json!(isbn));
        }
        if let Some(issn) = &record.issn {
            map.insert("ISSN".to_string(), json!(issn));
        }
        if let Some(url) = &record.url {
            map.insert("URL".to_string(), json!(url));
        }
        if let Some(lang) = &record.language {
            map.insert("language".to_string(), json!(lang));
        }
        if let Some(abs) = &record.abstract_text {
            map.insert("abstract".to_string(), json!(abs));
        }
        if !record.keywords.is_empty() {
            map.insert("keyword".to_string(), json!(record.keywords.join(", ")));
        }

        obj
    }

    /// Exporta una colección de registros a un array CSL-JSON.
    pub fn export_collection(&self, records: &[BibliographicRecord]) -> Value {
        Value::Array(records.iter().map(|r| self.export(r)).collect())
    }
}

// ── RIS exporter ──────────────────────────────────────────────────────────────

pub struct RisExporter;

impl RisExporter {
    /// Exporta un registro al formato RIS.
    pub fn export(&self, record: &BibliographicRecord) -> String {
        let mut lines = Vec::new();

        lines.push(format!("TY  - {}", record.record_type.to_ris_type()));
        lines.push(format!("ID  - {}", record.cite_key));

        if let Some(title) = &record.title {
            lines.push(format!("TI  - {}", title));
        }

        for author in &record.authors {
            lines.push(format!("AU  - {}", author.to_bibtex()));
        }
        for editor in &record.editors {
            lines.push(format!("ED  - {}", editor.to_bibtex()));
        }

        if let Some(year) = record.year {
            lines.push(format!("PY  - {}", year));
        }

        if let Some(j) = &record.journal {
            lines.push(format!("JO  - {}", j));
        }
        if let Some(bt) = &record.booktitle {
            lines.push(format!("BT  - {}", bt));
        }
        if let Some(pub_) = &record.publisher {
            lines.push(format!("PB  - {}", pub_));
        }
        if let Some(inst) = &record.institution {
            lines.push(format!("PB  - {}", inst));
        }
        if let Some(v) = &record.volume {
            lines.push(format!("VL  - {}", v));
        }
        if let Some(n) = &record.issue {
            lines.push(format!("IS  - {}", n));
        }

        // Páginas: "123-456" → SP: 123, EP: 456
        if let Some(pages) = &record.pages {
            if let Some(dash_pos) = pages.find('-') {
                let start = pages[..dash_pos].trim();
                let end = pages[dash_pos + 1..].trim_start_matches('-').trim();
                if !start.is_empty() {
                    lines.push(format!("SP  - {}", start));
                }
                if !end.is_empty() {
                    lines.push(format!("EP  - {}", end));
                }
            } else {
                lines.push(format!("SP  - {}", pages));
            }
        }

        if let Some(doi) = &record.doi {
            lines.push(format!("DO  - {}", doi));
        }
        if let Some(url) = &record.url {
            lines.push(format!("UR  - {}", url));
        }
        if let Some(isbn) = &record.isbn {
            lines.push(format!("SN  - {}", isbn));
        }
        if let Some(issn) = &record.issn {
            lines.push(format!("SN  - {}", issn));
        }
        if let Some(lang) = &record.language {
            lines.push(format!("LA  - {}", lang));
        }
        if let Some(abs) = &record.abstract_text {
            lines.push(format!("AB  - {}", abs));
        }
        for kw in &record.keywords {
            lines.push(format!("KW  - {}", kw));
        }

        lines.push("ER  - ".to_string());
        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bibliography::model::{BibliographicRecord, PersonName, RecordType};

    fn article_record() -> BibliographicRecord {
        let mut r = BibliographicRecord::new("smith2024", RecordType::Article);
        r.title = Some("Deep Learning: A Review".to_string());
        r.authors = vec![
            PersonName::new_person("Smith", "John A."),
            PersonName::new_person("García", "María"),
        ];
        r.year = Some(2024);
        r.journal = Some("Journal of AI Research".to_string());
        r.volume = Some("42".to_string());
        r.issue = Some("3".to_string());
        r.pages = Some("123-456".to_string());
        r.doi = Some("10.1145/111.222".to_string());
        r.url = Some("https://example.com/paper".to_string());
        r
    }

    #[test]
    fn bibtex_export_article_basic() {
        let exporter = BibLaTeXExporter;
        let output = exporter.export(&article_record());
        assert!(output.starts_with("@article{smith2024,"));
        assert!(output.contains("Smith, John A."));
        assert!(output.contains("García, María"));
        assert!(output.contains("journaltitle"));
        assert!(output.contains("10.1145/111.222"));
    }

    #[test]
    fn bibtex_export_escapes_special_chars_in_title() {
        let mut r = BibliographicRecord::new("test2024", RecordType::Article);
        r.title = Some("R&D at 100%: A #1 Study".to_string());
        let exporter = BibLaTeXExporter;
        let output = exporter.export(&r);
        assert!(output.contains(r"R\&D"));
        assert!(output.contains(r"100\%"));
        assert!(output.contains(r"\#1"));
    }

    #[test]
    fn bibtex_export_does_not_escape_doi() {
        let mut r = BibliographicRecord::new("test2024", RecordType::Article);
        r.doi = Some("10.1000/a_b".to_string());
        let exporter = BibLaTeXExporter;
        let output = exporter.export(&r);
        assert!(output.contains("10.1000/a_b"));
        assert!(!output.contains(r"10.1000/a\_b"));
    }

    #[test]
    fn csl_json_export_article_structure() {
        let exporter = CslJsonExporter;
        let obj = exporter.export(&article_record());
        assert_eq!(obj["type"], "article-journal");
        assert_eq!(obj["id"], "smith2024");
        assert!(obj["author"].is_array());
        assert_eq!(obj["author"][0]["family"], "Smith");
        assert!(obj["issued"]["date-parts"].is_array());
        assert_eq!(obj["DOI"], "10.1145/111.222");
    }

    #[test]
    fn csl_json_date_parts_year_only() {
        let exporter = CslJsonExporter;
        let mut r = BibliographicRecord::new("test2024", RecordType::Article);
        r.year = Some(2024);
        let obj = exporter.export(&r);
        assert_eq!(obj["issued"]["date-parts"][0][0], 2024);
    }

    #[test]
    fn ris_export_article_ty_line() {
        let exporter = RisExporter;
        let output = exporter.export(&article_record());
        assert!(output.starts_with("TY  - JOUR"));
        assert!(output.contains("ER  - "));
    }

    #[test]
    fn ris_export_splits_pages() {
        let exporter = RisExporter;
        let output = exporter.export(&article_record());
        assert!(output.contains("SP  - 123"));
        assert!(output.contains("EP  - 456"));
    }

    #[test]
    fn ris_export_dataset_ty() {
        let exporter = RisExporter;
        let r = BibliographicRecord::new("data2024", RecordType::Dataset);
        let output = exporter.export(&r);
        assert!(output.starts_with("TY  - DATA"));
    }
}
