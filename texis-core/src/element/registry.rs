use super::loader::ElementLoader;
use super::model::Element;
use crate::error::{CoreError, CoreResult};
use std::collections::HashMap;
use std::path::Path;

pub struct ElementRegistry {
    elements: HashMap<String, Element>,
}

impl ElementRegistry {
    pub fn new() -> Self {
        Self {
            elements: HashMap::new(),
        }
    }

    pub fn load_from_dir(&mut self, dir: &Path) -> CoreResult<()> {
        let loader = ElementLoader;
        for entry in walkdir::WalkDir::new(dir).max_depth(3).min_depth(1) {
            let entry = entry.map_err(|e| CoreError::Io(e.into()))?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("yaml")
                && path.file_name().and_then(|n| n.to_str()) != Some("manifest.yaml")
            {
                if let Ok(el) = loader.load_from_file(path) {
                    self.elements.insert(el.id.clone(), el);
                }
            }
        }
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<&Element> {
        self.elements.get(id)
    }

    pub fn insert(&mut self, element: Element) {
        self.elements.insert(element.id.clone(), element);
    }
}

impl Default for ElementRegistry {
    fn default() -> Self {
        Self::new()
    }
}
