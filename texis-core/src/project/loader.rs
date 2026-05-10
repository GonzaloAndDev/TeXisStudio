// ÚNICO módulo en texis-core que importa serde_yaml para proyectos.

use super::model::ProjectModel;
use crate::error::{CoreError, CoreResult};
use crate::schema::versions;
use std::path::Path;

pub struct ProjectLoader;

impl ProjectLoader {
    pub fn load_from_file(&self, path: &Path) -> CoreResult<ProjectModel> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        self.load_from_str(&content, &path.to_string_lossy())
    }

    pub fn load_from_str(&self, content: &str, source: &str) -> CoreResult<ProjectModel> {
        let model: ProjectModel = serde_yaml::from_str(content).map_err(|e| {
            CoreError::YamlParse {
                path: source.to_string(),
                message: e.to_string(),
            }
        })?;

        if !versions::is_supported(&model.schema_version) {
            return Err(CoreError::UnsupportedSchemaVersion {
                version: model.schema_version.clone(),
                current: versions::CURRENT_SCHEMA_VERSION.to_string(),
            });
        }

        Ok(model)
    }
}
