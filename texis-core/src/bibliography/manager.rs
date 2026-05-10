// Gestión de referencias bibliográficas — Release 0.1 (stub).

use super::parser::{BibEntry, BibParser};
use crate::error::CoreResult;
use std::path::Path;

pub struct BibManager {
    entries: Vec<BibEntry>,
}

impl BibManager {
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    pub fn load_from_file(&mut self, path: &Path) -> CoreResult<()> {
        let parser = BibParser;
        let new_entries = parser.parse_file(path)?;
        self.entries.extend(new_entries);
        Ok(())
    }

    pub fn entries(&self) -> &[BibEntry] {
        &self.entries
    }

    pub fn find_by_key(&self, key: &str) -> Option<&BibEntry> {
        self.entries.iter().find(|e| e.key == key)
    }
}

impl Default for BibManager {
    fn default() -> Self {
        Self::new()
    }
}
