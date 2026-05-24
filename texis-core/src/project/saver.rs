// ÚNICO módulo en texis-core que escribe project YAML a disco.

use super::model::ProjectModel;
use crate::error::{CoreError, CoreResult};
use std::path::Path;

pub struct ProjectSaver;

impl ProjectSaver {
    /// Guarda el modelo con escritura segura:
    ///   1. Serializa a string
    ///   2. Escribe en archivo `.tmp` al lado del destino
    ///   3. Si el destino ya existe, copia a `.bak`
    ///   4. Renombra `.tmp` → destino (atómico en la mayoría de SO)
    pub fn save_to_file(&self, model: &ProjectModel, path: &Path) -> CoreResult<()> {
        let content = serde_yaml::to_string(model).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;

        // Paso 1: escribir en temporal junto al destino final
        let tmp_path = path.with_extension("yaml.tmp");
        std::fs::write(&tmp_path, &content).map_err(CoreError::Io)?;

        // Paso 2: hacer backup del archivo existente antes de reemplazarlo
        if path.exists() {
            let bak_path = path.with_extension("yaml.bak");
            std::fs::copy(path, &bak_path).map_err(CoreError::Io)?;
        }

        // Paso 3: renombrar temporal → destino
        std::fs::rename(&tmp_path, path).map_err(CoreError::Io)?;

        Ok(())
    }
}
