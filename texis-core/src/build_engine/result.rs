use super::plan::{BuildId, BuildMode, BuildStepKind};
use crate::diagnostics::model::Diagnostic;
use chrono::{DateTime, Utc};
use std::path::PathBuf;

/// Resultado de un paso individual de compilación.
#[derive(Debug, Clone)]
pub struct BuildStepResult {
    pub kind: BuildStepKind,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub success: bool,
}

impl BuildStepResult {
    /// Detecta "rerun necesario" en el log de LaTeX.
    pub fn needs_rerun(&self) -> bool {
        RERUN_PATTERNS.iter().any(|p| self.stdout.contains(p) || self.stderr.contains(p))
    }

    /// Detecta si biber/bibliografía necesita correrse.
    pub fn needs_biber(&self) -> bool {
        BIBER_NEEDED_PATTERNS.iter().any(|p| self.stdout.contains(p))
    }

    /// Detecta parada de emergencia (error fatal).
    pub fn has_emergency_stop(&self) -> bool {
        self.stdout.contains("! Emergency stop.") || self.stdout.contains("Emergency stop")
    }
}

const RERUN_PATTERNS: &[&str] = &[
    "Label(s) may have changed. Rerun to get cross-references right.",
    "Package rerunfilecheck Warning: File",
    "There were undefined references.",
    "Rerun LaTeX.",
];

const BIBER_NEEDED_PATTERNS: &[&str] = &[
    "Package biblatex Warning: Please rerun Biber.",
    "Package biblatex Warning: Please (re)run Biber",
    "I found no \\bibdata command",
];

/// Categoría de fallo de compilación.
#[derive(Debug, Clone)]
pub enum BuildFailureKind {
    ToolNotFound { tool: String },
    CompileError,
    BiberError,
    GlossaryError,
    IndexError,
    Timeout { step: String },
    PdfLocked,
    InvalidRootFile,
    ShellEscapeRequired,
    Unknown { message: String },
}

/// Resultado completo de una compilación.
#[derive(Debug)]
pub struct BuildResult {
    pub id: BuildId,
    pub mode: BuildMode,
    pub success: bool,
    pub steps: Vec<BuildStepResult>,
    pub pdf_path: Option<PathBuf>,
    pub total_duration_ms: u64,
    pub diagnostics: Vec<Diagnostic>,
    pub rerun_needed: bool,
    pub failure: Option<BuildFailureKind>,
    pub finished_at: DateTime<Utc>,
}

impl BuildResult {
    pub fn failed(id: BuildId, mode: BuildMode, failure: BuildFailureKind) -> Self {
        Self {
            id,
            mode,
            success: false,
            steps: Vec::new(),
            pdf_path: None,
            total_duration_ms: 0,
            diagnostics: Vec::new(),
            rerun_needed: false,
            failure: Some(failure),
            finished_at: Utc::now(),
        }
    }

    pub fn error_count(&self) -> usize {
        use crate::diagnostics::model::DiagnosticSeverity;
        self.diagnostics.iter().filter(|d| d.severity == DiagnosticSeverity::Error).count()
    }

    pub fn warning_count(&self) -> usize {
        use crate::diagnostics::model::DiagnosticSeverity;
        self.diagnostics.iter().filter(|d| d.severity == DiagnosticSeverity::Warning).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn step(stdout: &str) -> BuildStepResult {
        BuildStepResult {
            kind: BuildStepKind::LatexCompile { pass: 1 },
            exit_code: Some(0),
            stdout: stdout.to_string(),
            stderr: String::new(),
            duration_ms: 100,
            success: true,
        }
    }

    #[test]
    fn detects_rerun_needed() {
        let s = step("Label(s) may have changed. Rerun to get cross-references right.");
        assert!(s.needs_rerun());
    }

    #[test]
    fn detects_biber_needed() {
        let s = step("Package biblatex Warning: Please rerun Biber.");
        assert!(s.needs_biber());
    }

    #[test]
    fn detects_emergency_stop() {
        let s = step("! Emergency stop.");
        assert!(s.has_emergency_stop());
    }

    #[test]
    fn clean_log_no_rerun() {
        let s = step("Output written on main.pdf (42 pages).");
        assert!(!s.needs_rerun());
        assert!(!s.has_emergency_stop());
    }
}
