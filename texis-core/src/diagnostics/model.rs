use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

pub type DiagnosticId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiagnosticSource {
    LatexLog,
    BiberLog,
    GlossaryTool,
    IndexTool,
    PackageValidator,
    AssetValidator,
    LabelValidator,
    BibliographyValidator,
    DictionaryValidator,
    ProfileValidator,
    BuildEngine,
}

impl std::fmt::Display for DiagnosticSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            DiagnosticSource::LatexLog => "LaTeX",
            DiagnosticSource::BiberLog => "Biber",
            DiagnosticSource::GlossaryTool => "makeglossaries",
            DiagnosticSource::IndexTool => "makeindex",
            DiagnosticSource::PackageValidator => "Paquetes",
            DiagnosticSource::AssetValidator => "Assets",
            DiagnosticSource::LabelValidator => "Labels",
            DiagnosticSource::BibliographyValidator => "Bibliografía",
            DiagnosticSource::DictionaryValidator => "Diccionario",
            DiagnosticSource::ProfileValidator => "Perfil",
            DiagnosticSource::BuildEngine => "Build",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileLocation {
    pub file: PathBuf,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

impl FileLocation {
    pub fn new(file: PathBuf, line: u32) -> Self {
        Self { file, line: Some(line), column: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixSuggestion {
    pub description: String,
    pub action: FixAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FixAction {
    RunCommand(String),
    EnableShellEscapeWithConfirmation,
    AddPackage(String),
    RenameLabel { old: String, new: String },
    LocateAsset(String),
    AddBibResource(PathBuf),
    RerunBiber,
    RerunGlossary,
    ConvertToUtf8,
    NoAutomaticFix,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub id: DiagnosticId,
    pub severity: DiagnosticSeverity,
    pub source: DiagnosticSource,
    pub code: String,
    pub message: String,
    pub explanation: Option<String>,
    pub suggestion: Option<FixSuggestion>,
    pub location: Option<FileLocation>,
    pub related_locations: Vec<FileLocation>,
    pub raw_excerpt: Option<String>,
    pub is_blocking: bool,
    pub created_at: DateTime<Utc>,
}

impl Diagnostic {
    pub fn error(
        source: DiagnosticSource,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            severity: DiagnosticSeverity::Error,
            source,
            code: code.into(),
            message: message.into(),
            explanation: None,
            suggestion: None,
            location: None,
            related_locations: Vec::new(),
            raw_excerpt: None,
            is_blocking: true,
            created_at: Utc::now(),
        }
    }

    pub fn warning(
        source: DiagnosticSource,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            severity: DiagnosticSeverity::Warning,
            source,
            code: code.into(),
            message: message.into(),
            explanation: None,
            suggestion: None,
            location: None,
            related_locations: Vec::new(),
            raw_excerpt: None,
            is_blocking: false,
            created_at: Utc::now(),
        }
    }

    pub fn info(
        source: DiagnosticSource,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            severity: DiagnosticSeverity::Info,
            source,
            code: code.into(),
            message: message.into(),
            explanation: None,
            suggestion: None,
            location: None,
            related_locations: Vec::new(),
            raw_excerpt: None,
            is_blocking: false,
            created_at: Utc::now(),
        }
    }

    pub fn with_location(mut self, file: PathBuf, line: u32) -> Self {
        self.location = Some(FileLocation::new(file, line));
        self
    }

    pub fn with_explanation(mut self, explanation: impl Into<String>) -> Self {
        self.explanation = Some(explanation.into());
        self
    }

    pub fn with_suggestion(mut self, desc: impl Into<String>, action: FixAction) -> Self {
        self.suggestion = Some(FixSuggestion { description: desc.into(), action });
        self
    }

    pub fn with_raw(mut self, raw: impl Into<String>) -> Self {
        self.raw_excerpt = Some(raw.into());
        self
    }

    pub fn non_blocking(mut self) -> Self {
        self.is_blocking = false;
        self
    }
}
