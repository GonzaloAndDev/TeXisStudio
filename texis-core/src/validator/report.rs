use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub issues: Vec<ValidationIssue>,
}

/// Issue de validación con trazabilidad completa hacia la regla y el perfil que la origina.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidationIssue {
    pub severity: IssueSeverity,
    /// Código de error único, ej. "E_WORD_LIMIT_EXCEEDED".
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    /// ID de la sección del proyecto donde ocurre el issue.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section_id: Option<String>,
    /// ID de la regla institucional que origina este issue.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
    /// ID del perfil institucional que declara la regla.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    /// Estado del perfil al momento de la validación.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_status: Option<String>,
    /// URL de la fuente institucional oficial que respalda la regla.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    /// Título legible de la fuente institucional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_title: Option<String>,
    /// true si la validación fue ejecutada automáticamente; false si requiere revisión humana.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub automated: Option<bool>,
    /// Valor esperado por la regla institucional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
    /// Valor actual encontrado en el proyecto.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
}

impl ValidationIssue {
    /// Constructor mínimo para issues internos sin trazabilidad hacia perfil.
    pub fn simple(severity: IssueSeverity, code: &str, message: impl Into<String>) -> Self {
        Self {
            severity,
            code: code.to_string(),
            message: message.into(),
            suggestion: None,
            section_id: None,
            rule_id: None,
            profile_id: None,
            profile_status: None,
            source_url: None,
            source_title: None,
            automated: Some(true),
            expected: None,
            actual: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum IssueSeverity {
    Error,
    Warning,
    #[default]
    Suggestion,
}

impl ValidationReport {
    pub fn new(issues: Vec<ValidationIssue>) -> Self {
        Self { issues }
    }

    pub fn has_errors(&self) -> bool {
        self.issues.iter().any(|i| i.severity == IssueSeverity::Error)
    }

    pub fn errors(&self) -> impl Iterator<Item = &ValidationIssue> {
        self.issues.iter().filter(|i| i.severity == IssueSeverity::Error)
    }

    pub fn warnings(&self) -> impl Iterator<Item = &ValidationIssue> {
        self.issues.iter().filter(|i| i.severity == IssueSeverity::Warning)
    }

    pub fn suggestions(&self) -> impl Iterator<Item = &ValidationIssue> {
        self.issues.iter().filter(|i| i.severity == IssueSeverity::Suggestion)
    }
}
