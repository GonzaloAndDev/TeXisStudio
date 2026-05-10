#[derive(Debug, Clone)]
pub struct ValidationReport {
    pub issues: Vec<ValidationIssue>,
}

#[derive(Debug, Clone)]
pub struct ValidationIssue {
    pub severity: IssueSeverity,
    pub code: String,
    pub message: String,
    pub suggestion: Option<String>,
    pub section_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum IssueSeverity {
    Error,
    Warning,
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
