use crate::events::LabelKind;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ── Modelos ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LabelStatus {
    Valid,
    Duplicate { also_in: PathBuf, also_at_line: u32 },
    Unused,
    BrokenReference,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelEntry {
    pub key: String,
    pub kind: LabelKind,
    pub display_name: Option<String>,
    pub file: PathBuf,
    pub line: u32,
    pub status: LabelStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossReference {
    pub key: String,
    pub command: String,
    pub file: PathBuf,
    pub line: u32,
}

// ── Registry ──────────────────────────────────────────────────────────────────

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct LabelRegistry {
    labels: HashMap<String, LabelEntry>,
    references: Vec<CrossReference>,
}

impl LabelRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Escanea un archivo .tex y actualiza el registry con sus labels y referencias.
    pub fn scan_file(&mut self, path: &Path, content: &str) {
        self.remove_file_entries(path);

        let label_re = Regex::new(r"\\label\{([^}]+)\}").unwrap();
        let ref_re =
            Regex::new(r"\\(ref|pageref|cref|Cref|autoref|nameref|eqref|vref)\{([^}]+)\}").unwrap();

        // Escanear labels
        for (line_idx, line) in content.lines().enumerate() {
            let line_num = (line_idx + 1) as u32;

            for cap in label_re.captures_iter(line) {
                let key = cap[1].trim().to_string();
                let kind = infer_kind_from_key(&key);
                let display_name = extract_preceding_caption(content, line_idx);

                if let Some(existing) = self.labels.get(&key) {
                    // Duplicado
                    let duplicate = LabelEntry {
                        key: key.clone(),
                        kind,
                        display_name,
                        file: path.to_path_buf(),
                        line: line_num,
                        status: LabelStatus::Duplicate {
                            also_in: existing.file.clone(),
                            also_at_line: existing.line,
                        },
                    };
                    self.labels.insert(key, duplicate);
                } else {
                    self.labels.insert(
                        key.clone(),
                        LabelEntry {
                            key,
                            kind,
                            display_name,
                            file: path.to_path_buf(),
                            line: line_num,
                            status: LabelStatus::Valid,
                        },
                    );
                }
            }

            // Escanear referencias
            for cap in ref_re.captures_iter(line) {
                let command = cap[1].to_string();
                let key = cap[2].trim().to_string();
                self.references.push(CrossReference {
                    key,
                    command,
                    file: path.to_path_buf(),
                    line: line_num,
                });
            }
        }
    }

    /// Actualiza los estados de todos los labels:
    /// - Unused: label definido pero no referenciado
    /// - BrokenReference: referencia a label que no existe
    pub fn update_statuses(&mut self) -> ValidationReport {
        let defined_keys: std::collections::HashSet<String> = self.labels.keys().cloned().collect();
        let referenced_keys: std::collections::HashSet<String> =
            self.references.iter().map(|r| r.key.clone()).collect();

        let mut broken_refs: Vec<CrossReference> = Vec::new();
        let mut unused_labels: Vec<String> = Vec::new();

        // Labels no referenciados
        for (key, entry) in &mut self.labels {
            if matches!(entry.status, LabelStatus::Valid) && !referenced_keys.contains(key) {
                entry.status = LabelStatus::Unused;
                unused_labels.push(key.clone());
            }
        }

        // Referencias a labels que no existen
        for reference in &self.references {
            if !defined_keys.contains(&reference.key) {
                broken_refs.push(reference.clone());
            }
        }

        ValidationReport {
            broken_references: broken_refs,
            unused_labels,
            duplicate_labels: self
                .labels
                .values()
                .filter(|e| matches!(e.status, LabelStatus::Duplicate { .. }))
                .map(|e| e.key.clone())
                .collect(),
        }
    }

    pub fn find_by_key(&self, key: &str) -> Option<&LabelEntry> {
        self.labels.get(key)
    }

    pub fn all_labels(&self) -> impl Iterator<Item = &LabelEntry> {
        self.labels.values()
    }

    pub fn all_keys(&self) -> std::collections::HashSet<String> {
        self.labels.keys().cloned().collect()
    }

    pub fn references_to(&self, key: &str) -> Vec<&CrossReference> {
        self.references.iter().filter(|r| r.key == key).collect()
    }

    fn remove_file_entries(&mut self, path: &Path) {
        self.labels.retain(|_, entry| entry.file != path);
        self.references.retain(|r| r.file != path);
    }
}

#[derive(Debug)]
pub struct ValidationReport {
    pub broken_references: Vec<CrossReference>,
    pub unused_labels: Vec<String>,
    pub duplicate_labels: Vec<String>,
}

impl ValidationReport {
    pub fn is_clean(&self) -> bool {
        self.broken_references.is_empty() && self.duplicate_labels.is_empty()
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Infiere el tipo de label desde el prefijo de la clave.
fn infer_kind_from_key(key: &str) -> LabelKind {
    if let Some(prefix) = key.split(':').next() {
        match prefix {
            "chap" | "ch" => LabelKind::Chapter,
            "sec" => LabelKind::Section,
            "subsec" => LabelKind::Subsection,
            "fig" => LabelKind::Figure,
            "tab" => LabelKind::Table,
            "eq" => LabelKind::Equation,
            "alg" => LabelKind::Algorithm,
            "lst" | "code" => LabelKind::Listing,
            "app" => LabelKind::Appendix,
            "thm" | "theorem" => LabelKind::Theorem,
            "def" | "defn" => LabelKind::Definition,
            _ => LabelKind::Unknown,
        }
    } else {
        LabelKind::Unknown
    }
}

/// Busca la caption o título más cercano antes de la línea del label.
fn extract_preceding_caption(content: &str, label_line_idx: usize) -> Option<String> {
    let caption_re = Regex::new(r"\\caption\{([^}]{1,100})\}").unwrap();
    let section_re = Regex::new(r"\\(?:chapter|section|subsection)\{([^}]{1,100})\}").unwrap();

    let lines: Vec<&str> = content.lines().collect();
    let search_from = label_line_idx.saturating_sub(10);

    for i in (search_from..=label_line_idx).rev() {
        let line = lines.get(i).copied().unwrap_or("");
        if let Some(cap) = caption_re.captures(line) {
            return Some(cap[1].trim().to_string());
        }
        if let Some(cap) = section_re.captures(line) {
            return Some(cap[1].trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn path(name: &str) -> PathBuf {
        PathBuf::from(name)
    }

    #[test]
    fn scan_finds_label_and_ref() {
        let mut reg = LabelRegistry::new();
        let content = "Some text \\label{fig:arch} and \\ref{fig:arch}";
        reg.scan_file(&path("main.tex"), content);

        assert!(reg.find_by_key("fig:arch").is_some());
        assert_eq!(reg.references_to("fig:arch").len(), 1);
    }

    #[test]
    fn kind_inferred_from_prefix() {
        assert_eq!(infer_kind_from_key("fig:architecture"), LabelKind::Figure);
        assert_eq!(infer_kind_from_key("tab:results"), LabelKind::Table);
        assert_eq!(infer_kind_from_key("eq:loss"), LabelKind::Equation);
        assert_eq!(infer_kind_from_key("chap:intro"), LabelKind::Chapter);
    }

    #[test]
    fn detect_duplicate_label() {
        let mut reg = LabelRegistry::new();
        reg.scan_file(&path("a.tex"), "\\label{fig:same}");
        reg.scan_file(&path("b.tex"), "\\label{fig:same}");

        let entry = reg.find_by_key("fig:same").unwrap();
        assert!(matches!(entry.status, LabelStatus::Duplicate { .. }));
    }

    #[test]
    fn detect_unused_label() {
        let mut reg = LabelRegistry::new();
        reg.scan_file(&path("main.tex"), "\\label{fig:unused}");
        let report = reg.update_statuses();
        assert!(report.unused_labels.contains(&"fig:unused".to_string()));
    }

    #[test]
    fn detect_broken_reference() {
        let mut reg = LabelRegistry::new();
        reg.scan_file(&path("main.tex"), "\\ref{fig:nonexistent}");
        let report = reg.update_statuses();
        assert!(!report.broken_references.is_empty());
        assert_eq!(report.broken_references[0].key, "fig:nonexistent");
    }

    #[test]
    fn remove_file_entries_on_rescan() {
        let mut reg = LabelRegistry::new();
        reg.scan_file(&path("main.tex"), "\\label{fig:old}");
        reg.scan_file(&path("main.tex"), "\\label{fig:new}"); // rescan del mismo archivo
        assert!(reg.find_by_key("fig:old").is_none());
        assert!(reg.find_by_key("fig:new").is_some());
    }

    #[test]
    fn extract_caption_from_preceding_lines() {
        let content = "\\begin{figure}\n\\caption{My figure}\n\\label{fig:test}\n\\end{figure}";
        let mut reg = LabelRegistry::new();
        reg.scan_file(&path("main.tex"), content);
        let entry = reg.find_by_key("fig:test").unwrap();
        assert_eq!(entry.display_name.as_deref(), Some("My figure"));
    }
}
