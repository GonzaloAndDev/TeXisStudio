// ÚNICO módulo en texis-core que importa serde_yaml para perfiles.

use super::model::Profile;
use crate::error::{CoreError, CoreResult};
use crate::schema::versions;
use std::path::Path;

pub struct ProfileLoader;

impl ProfileLoader {
    pub fn load_from_file(&self, path: &Path) -> CoreResult<Profile> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        self.load_from_str(&content, &path.to_string_lossy())
    }

    pub fn load_from_str(&self, content: &str, source: &str) -> CoreResult<Profile> {
        let profile: Profile = serde_yaml::from_str(content).map_err(|e| {
            CoreError::YamlParse {
                path: source.to_string(),
                message: e.to_string(),
            }
        })?;

        if !versions::is_supported(&profile.schema_version) {
            return Err(CoreError::UnsupportedSchemaVersion {
                version: profile.schema_version.clone(),
                current: versions::CURRENT_SCHEMA_VERSION.to_string(),
            });
        }

        Ok(profile)
    }
}
