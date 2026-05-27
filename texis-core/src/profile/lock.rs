// profile.lock.yaml — congela el perfil activo de un proyecto.
//
// Ninguna actualización de TeXisStudio cambia silenciosamente el significado
// académico de una tesis ya creada (D8).
//
// Nivel P1 — sin diff ni migración guiada. Solo detecta presencia/ausencia
// y ofrece crear el lock con el perfil activo.

use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::{CoreError, CoreResult};

/// Contenido del archivo `profile.lock.yaml` en la raíz del proyecto.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileLock {
    /// ID del perfil congelado.
    pub profile_id: String,
    /// Versión del perfil en el momento del congelado.
    pub profile_version: String,
    /// Estado del perfil en el momento del congelado ("draft", "reviewed", "verified", etc.).
    pub profile_status_at_lock: String,
    /// Fuente del perfil: "TeXisStudio-Profiles" | "local" | URL remota.
    pub source: String,
    /// SHA-256 del profile.yaml congelado.
    pub sha256: String,
    /// Timestamp ISO 8601 del congelado.
    pub locked_at: String,
    /// Versión del texis-core usada al congelar.
    pub texis_core_version: String,
}

impl ProfileLock {
    /// Ruta canónica del lock dentro de un proyecto.
    pub fn path_in_project(project_dir: &Path) -> std::path::PathBuf {
        project_dir.join("profile.lock.yaml")
    }

    /// Carga el lock desde el disco. Devuelve `None` si el archivo no existe.
    pub fn load(project_dir: &Path) -> CoreResult<Option<Self>> {
        let path = Self::path_in_project(project_dir);
        if !path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&path).map_err(CoreError::Io)?;
        let lock: Self = serde_yaml::from_str(&content).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;
        Ok(Some(lock))
    }

    /// Persiste el lock en el disco.
    pub fn save(&self, project_dir: &Path) -> CoreResult<()> {
        let path = Self::path_in_project(project_dir);
        let yaml = serde_yaml::to_string(self).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;
        std::fs::write(&path, yaml).map_err(CoreError::Io)?;
        Ok(())
    }

    /// Calcula el SHA-256 de un archivo y lo devuelve como hex string.
    pub fn sha256_of_file(path: &Path) -> CoreResult<String> {
        use sha2::{Digest, Sha256};
        use std::io::Read;
        let mut file = std::fs::File::open(path).map_err(CoreError::Io)?;
        let mut hasher = Sha256::new();
        let mut buf = [0u8; 8192];
        loop {
            let n = file.read(&mut buf).map_err(CoreError::Io)?;
            if n == 0 { break; }
            hasher.update(&buf[..n]);
        }
        Ok(bytes_to_hex(&hasher.finalize()))
    }
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
        s.push_str(&format!("{:02x}", b));
        s
    })
}

/// Estado del lock para la UI.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LockStatus {
    /// El proyecto tiene profile.lock.yaml.
    Locked,
    /// El proyecto no tiene profile.lock.yaml — perfil sin congelar.
    Unlocked,
}

/// Comprueba si un proyecto tiene el perfil congelado.
pub fn check_lock_status(project_dir: &Path) -> LockStatus {
    if ProfileLock::path_in_project(project_dir).exists() {
        LockStatus::Locked
    } else {
        LockStatus::Unlocked
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sha256_str(data: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        bytes_to_hex(&Sha256::digest(data))
    }

    #[test]
    fn sha256_empty() {
        assert_eq!(
            sha256_str(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn sha256_abc() {
        assert_eq!(
            sha256_str(b"abc"),
            "ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469632f0f0b0c2e49d45"
        );
    }

    #[test]
    fn lock_status_unlocked_cuando_no_hay_archivo() {
        let tmp = tempfile::TempDir::new().unwrap();
        assert_eq!(check_lock_status(tmp.path()), LockStatus::Unlocked);
    }
}
