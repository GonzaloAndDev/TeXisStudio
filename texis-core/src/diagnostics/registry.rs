use super::model::{Diagnostic, DiagnosticId, DiagnosticSeverity, DiagnosticSource};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Default)]
pub struct DiagnosticRegistry {
    diagnostics: Vec<Diagnostic>,
    by_file: HashMap<PathBuf, Vec<DiagnosticId>>,
    by_source: HashMap<String, Vec<DiagnosticId>>,
}

impl DiagnosticRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, diag: Diagnostic) {
        let id = diag.id;
        if let Some(loc) = &diag.location {
            self.by_file.entry(loc.file.clone()).or_default().push(id);
        }
        let source_key = diag.source.to_string();
        self.by_source.entry(source_key).or_default().push(id);
        self.diagnostics.push(diag);
    }

    pub fn extend(&mut self, diags: impl IntoIterator<Item = Diagnostic>) {
        for d in diags {
            self.push(d);
        }
    }

    /// Reemplaza todos los diagnósticos de una fuente dada.
    pub fn replace_source(&mut self, source: &DiagnosticSource, new: Vec<Diagnostic>) {
        let source_str = source.to_string();
        // Quitar ids de esa fuente del índice by_file
        let old_ids: Vec<DiagnosticId> = self.by_source.remove(&source_str).unwrap_or_default();
        let old_id_set: std::collections::HashSet<DiagnosticId> = old_ids.into_iter().collect();
        self.diagnostics.retain(|d| !old_id_set.contains(&d.id));
        for file_ids in self.by_file.values_mut() {
            file_ids.retain(|id| !old_id_set.contains(id));
        }
        for d in new {
            self.push(d);
        }
    }

    pub fn all(&self) -> &[Diagnostic] {
        &self.diagnostics
    }

    pub fn errors(&self) -> Vec<&Diagnostic> {
        self.diagnostics
            .iter()
            .filter(|d| d.severity == DiagnosticSeverity::Error)
            .collect()
    }

    pub fn warnings(&self) -> Vec<&Diagnostic> {
        self.diagnostics
            .iter()
            .filter(|d| d.severity == DiagnosticSeverity::Warning)
            .collect()
    }

    pub fn blocking(&self) -> Vec<&Diagnostic> {
        self.diagnostics.iter().filter(|d| d.is_blocking).collect()
    }

    pub fn for_file(&self, file: &PathBuf) -> Vec<&Diagnostic> {
        self.by_file
            .get(file)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.diagnostics.iter().find(|d| &d.id == id))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn clear(&mut self) {
        self.diagnostics.clear();
        self.by_file.clear();
        self.by_source.clear();
    }

    pub fn total(&self) -> usize {
        self.diagnostics.len()
    }
    pub fn has_blocking_errors(&self) -> bool {
        self.diagnostics.iter().any(|d| d.is_blocking)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::model::{Diagnostic, DiagnosticSource};

    #[test]
    fn push_and_count() {
        let mut reg = DiagnosticRegistry::new();
        reg.push(Diagnostic::error(
            DiagnosticSource::LatexLog,
            "E_TEST",
            "test error",
        ));
        assert_eq!(reg.total(), 1);
        assert!(!reg.errors().is_empty());
    }

    #[test]
    fn replace_source_clears_old() {
        let mut reg = DiagnosticRegistry::new();
        reg.push(Diagnostic::error(
            DiagnosticSource::LatexLog,
            "E_OLD",
            "old",
        ));
        reg.replace_source(
            &DiagnosticSource::LatexLog,
            vec![Diagnostic::warning(
                DiagnosticSource::LatexLog,
                "W_NEW",
                "new",
            )],
        );
        assert_eq!(reg.total(), 1);
        assert_eq!(reg.all()[0].code, "W_NEW");
    }

    #[test]
    fn has_blocking_errors_correct() {
        let mut reg = DiagnosticRegistry::new();
        reg.push(Diagnostic::warning(
            DiagnosticSource::LatexLog,
            "W_X",
            "warn",
        ));
        assert!(!reg.has_blocking_errors());
        reg.push(Diagnostic::error(
            DiagnosticSource::LatexLog,
            "E_X",
            "error",
        ));
        assert!(reg.has_blocking_errors());
    }
}
