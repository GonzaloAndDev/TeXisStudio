// Validación de referencias — Release 0.1 (stub).

use super::manager::BibManager;
use crate::project::model::{ContentBlock, ProjectModel};

#[derive(Debug, Clone)]
pub struct BibValidationResult {
    pub missing_keys: Vec<String>,
}

pub fn validate_citations(model: &ProjectModel, bib: &BibManager) -> BibValidationResult {
    let mut missing_keys = Vec::new();

    for section in &model.sections {
        for block in &section.blocks {
            if let ContentBlock::Citation(c) = block {
                if bib.find_by_key(&c.citation_key).is_none() {
                    missing_keys.push(c.citation_key.clone());
                }
            }
        }
    }

    BibValidationResult { missing_keys }
}
