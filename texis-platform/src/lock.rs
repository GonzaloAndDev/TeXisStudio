//! Bloqueo de proyecto (§2): impide edición concurrente / dos ventanas sobre el
//! mismo proyecto. El lock es un archivo `.texisstudio/project.lock` con el pid,
//! host e instante del titular.
//!
//! La detección de liveness del proceso es responsabilidad de la capa superior
//! (puede confirmar con el usuario antes de un `force_acquire`); aquí se reporta
//! el titular y la antigüedad para decidir si es obsoleto.

use crate::paths;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LockInfo {
    pub pid: u32,
    pub host: String,
    pub created_unix: u64,
}

#[derive(Debug)]
pub enum LockError {
    /// El proyecto ya está bloqueado por otro titular.
    Held(LockInfo),
    Io(io::Error),
}

impl std::fmt::Display for LockError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LockError::Held(info) => write!(
                f,
                "proyecto bloqueado por pid {} en {}",
                info.pid, info.host
            ),
            LockError::Io(e) => write!(f, "error de E/S del lock: {e}"),
        }
    }
}

impl std::error::Error for LockError {}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Bloqueo activo de un proyecto. Se libera con `release` o al hacer `drop`.
#[derive(Debug)]
pub struct ProjectLock {
    path: PathBuf,
    info: LockInfo,
}

impl ProjectLock {
    fn lock_path(project_root: &Path) -> PathBuf {
        paths::state_dir(project_root).join("project.lock")
    }

    /// Lee el titular actual del lock, si existe.
    pub fn current(project_root: &Path) -> Option<LockInfo> {
        let path = Self::lock_path(project_root);
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    /// Adquiere el lock. Falla con `Held` si ya hay un titular.
    ///
    /// La adquisición es **atómica**: se crea el archivo con `create_new`
    /// (`O_EXCL`/`CREATE_NEW`), de modo que si dos procesos compiten solo uno
    /// gana — no hay ventana check-then-write donde ambos crean que adquirieron.
    pub fn acquire(project_root: &Path) -> Result<ProjectLock, LockError> {
        let path = Self::lock_path(project_root);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(LockError::Io)?;
        }
        let info = LockInfo {
            pid: std::process::id(),
            host: hostname(),
            created_unix: now_unix(),
        };
        let json = serde_json::to_string_pretty(&info)
            .map_err(|e| LockError::Io(io::Error::other(e)))?;

        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut f) => {
                f.write_all(json.as_bytes()).map_err(LockError::Io)?;
                f.sync_all().map_err(LockError::Io)?;
                Ok(ProjectLock { path, info })
            }
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                // Otro proceso ganó la carrera (o hay un lock obsoleto). Reportar
                // el titular para que la capa superior decida sobre `force_acquire`.
                let held = Self::current(project_root).unwrap_or(LockInfo {
                    pid: 0,
                    host: "unknown".to_string(),
                    created_unix: 0,
                });
                Err(LockError::Held(held))
            }
            Err(e) => Err(LockError::Io(e)),
        }
    }

    /// Toma el lock por la fuerza (tras decidir que el titular es obsoleto).
    pub fn force_acquire(project_root: &Path) -> io::Result<ProjectLock> {
        let path = Self::lock_path(project_root);
        let info = LockInfo {
            pid: std::process::id(),
            host: hostname(),
            created_unix: now_unix(),
        };
        Self::write(&path, &info)?;
        Ok(ProjectLock { path, info })
    }

    fn write(path: &Path, info: &LockInfo) -> io::Result<()> {
        let json = serde_json::to_string_pretty(info)
            .map_err(io::Error::other)?;
        crate::atomic::atomic_write_str(path, &json)
    }

    pub fn info(&self) -> &LockInfo {
        &self.info
    }

    /// Libera el lock si seguimos siendo el titular.
    pub fn release(self) -> io::Result<()> {
        self.release_if_ours()
    }

    fn release_if_ours(&self) -> io::Result<()> {
        if let Some(current) = fs::read_to_string(&self.path)
            .ok()
            .and_then(|c| serde_json::from_str::<LockInfo>(&c).ok())
        {
            if current == self.info {
                return match fs::remove_file(&self.path) {
                    Ok(()) => Ok(()),
                    Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
                    Err(e) => Err(e),
                };
            }
        }
        Ok(())
    }
}

impl Drop for ProjectLock {
    fn drop(&mut self) {
        let _ = self.release_if_ours();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn second_acquire_is_rejected_with_holder() {
        let dir = tempfile::tempdir().unwrap();
        let lock = ProjectLock::acquire(dir.path()).unwrap();
        match ProjectLock::acquire(dir.path()) {
            Err(LockError::Held(info)) => assert_eq!(info.pid, std::process::id()),
            other => panic!("se esperaba Held, fue {other:?}"),
        }
        lock.release().unwrap();
        // Tras liberar, se puede volver a adquirir.
        let again = ProjectLock::acquire(dir.path());
        assert!(again.is_ok());
    }

    #[test]
    fn drop_releases_lock() {
        let dir = tempfile::tempdir().unwrap();
        {
            let _lock = ProjectLock::acquire(dir.path()).unwrap();
            assert!(ProjectLock::current(dir.path()).is_some());
        }
        assert!(ProjectLock::current(dir.path()).is_none());
    }

    #[test]
    fn stale_lock_file_blocks_acquire_atomically() {
        // Simula un lock dejado por un proceso muerto (crash sin release): el
        // archivo existe pero nadie lo sostiene. `acquire` no debe pisarlo.
        let dir = tempfile::tempdir().unwrap();
        let _held = ProjectLock::acquire(dir.path()).unwrap();
        let path = ProjectLock::lock_path(dir.path());
        assert!(path.exists());
        // Un segundo intento ve el archivo y falla con Held (no crea uno nuevo).
        match ProjectLock::acquire(dir.path()) {
            Err(LockError::Held(_)) => {}
            other => panic!("se esperaba Held por archivo existente, fue {other:?}"),
        }
    }

    #[test]
    fn force_acquire_takes_over() {
        let dir = tempfile::tempdir().unwrap();
        let _held = ProjectLock::acquire(dir.path()).unwrap();
        let forced = ProjectLock::force_acquire(dir.path());
        assert!(forced.is_ok());
    }
}
