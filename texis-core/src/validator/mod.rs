pub mod academic;
pub mod bibliography;
pub mod report;
pub mod technical;

pub use report::{IssueSeverity, ValidationIssue, ValidationReport};

use crate::error::CoreResult;
use crate::project::model::ProjectModel;
use std::path::Path;

pub struct Validator;

impl Validator {
    pub fn new() -> Self {
        Self
    }

    pub fn validate(&self, model: &ProjectModel, project_dir: &Path) -> CoreResult<ValidationReport> {
        let mut all_issues = Vec::new();

        let academic = academic::validate(model);
        all_issues.extend(academic.issues);

        let technical = technical::validate(model, project_dir);
        all_issues.extend(technical.issues);

        let bib = bibliography::validate(model, project_dir);
        all_issues.extend(bib.issues);

        Ok(ValidationReport::new(all_issues))
    }
}

impl Default for Validator {
    fn default() -> Self {
        Self::new()
    }
}
