// ÚNICO módulo en texis-core que escribe project YAML a disco.

use super::model::ProjectModel;
use crate::error::{CoreError, CoreResult};
use std::path::Path;

pub struct ProjectSaver;

impl ProjectSaver {
    pub fn save_to_file(&self, model: &ProjectModel, path: &Path) -> CoreResult<()> {
        let content = serde_yaml::to_string(model).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;
        std::fs::write(path, content).map_err(CoreError::Io)
    }
}
