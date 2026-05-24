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

        let tmp_path = path.with_extension("yaml.tmp");
        let bak_path = path.with_extension("yaml.bak");

        // Paso 1: escribir contenido en archivo temporal
        std::fs::write(&tmp_path, &content).map_err(CoreError::Io)?;

        // Paso 2: mover el archivo actual a .bak (rename, no copy → no falla en Windows
        //         porque el destino .bak no existe o lo sobreescribe en Unix)
        if path.exists() {
            // En Windows rename sobre destino existente falla; eliminar .bak primero
            if bak_path.exists() {
                let _ = std::fs::remove_file(&bak_path);
            }
            std::fs::rename(path, &bak_path).map_err(CoreError::Io)?;
        }

        // Paso 3: mover temporal al destino final (el destino ya no existe)
        if let Err(e) = std::fs::rename(&tmp_path, path) {
            // Rollback: restaurar .bak al nombre original
            if bak_path.exists() {
                let _ = std::fs::rename(&bak_path, path);
            }
            let _ = std::fs::remove_file(&tmp_path);
            return Err(CoreError::Io(e));
        }

        Ok(())
    }
}
