use super::loader::ProfileLoader;
use super::model::Profile;
use crate::error::{CoreError, CoreResult};
use std::collections::HashMap;
use std::path::Path;

pub struct ProfileRegistry {
    profiles: HashMap<String, Profile>,
}

impl ProfileRegistry {
    pub fn new() -> Self {
        Self {
            profiles: HashMap::new(),
        }
    }

    /// Carga todos los perfiles desde un directorio (subdirectorios = un perfil cada uno).
    pub fn load_from_dir(&mut self, dir: &Path) -> CoreResult<()> {
        let loader = ProfileLoader;
        for entry in walkdir::WalkDir::new(dir).max_depth(2).min_depth(1) {
            let entry = entry.map_err(|e| CoreError::Io(e.into()))?;
            let path = entry.path();
            if path.file_name().and_then(|n| n.to_str()) == Some("profile.yaml") {
                let profile = loader.load_from_file(path)?;
                self.profiles.insert(profile.id.clone(), profile);
            }
        }
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<&Profile> {
        self.profiles.get(id)
    }

    pub fn list(&self) -> impl Iterator<Item = &Profile> {
        self.profiles.values()
    }

    pub fn insert(&mut self, profile: Profile) {
        self.profiles.insert(profile.id.clone(), profile);
    }
}

impl Default for ProfileRegistry {
    fn default() -> Self {
        Self::new()
    }
}
