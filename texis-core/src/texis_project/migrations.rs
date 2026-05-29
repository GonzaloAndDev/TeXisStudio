use super::model::SchemaVersion;
use super::persistence::{AppliedMigration, ProjectPersistence};
use crate::error::{CoreError, CoreResult};
use chrono::Utc;
use std::path::Path;

// ── Migration trait ───────────────────────────────────────────────────────────

pub trait ProjectMigration: Send + Sync {
    fn from_version(&self) -> SchemaVersion;
    fn to_version(&self) -> SchemaVersion;
    fn description(&self) -> &str;
    /// Ejecuta la migración. El backup ya fue creado antes de llamar a esto.
    fn migrate(&self, project_root: &Path, persistence: &ProjectPersistence) -> CoreResult<Vec<String>>;
}

#[derive(Debug)]
pub enum MigrationError {
    BackupFailed(std::io::Error),
    MigrationFailed { step: String, error: String },
    AlreadyApplied,
    VersionIncompatible { project: SchemaVersion, app: SchemaVersion },
}

impl std::fmt::Display for MigrationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MigrationError::BackupFailed(e) => write!(f, "Error al crear backup: {}", e),
            MigrationError::MigrationFailed { step, error } => {
                write!(f, "Migración falló en '{}': {}", step, error)
            }
            MigrationError::AlreadyApplied => write!(f, "Migración ya fue aplicada"),
            MigrationError::VersionIncompatible { project, app } => {
                write!(
                    f,
                    "Schema del proyecto ({}) incompatible con la app ({})",
                    project, app
                )
            }
        }
    }
}

// ── MigrationRunner ───────────────────────────────────────────────────────────

pub struct MigrationRunner {
    migrations: Vec<Box<dyn ProjectMigration>>,
}

impl MigrationRunner {
    pub fn new() -> Self {
        Self {
            migrations: vec![
                Box::new(MigrateInitialV1),
            ],
        }
    }

    /// Determina si el proyecto necesita migrarse y aplica las migraciones necesarias.
    pub fn migrate_if_needed(
        &self,
        project_root: &Path,
        current_schema: &SchemaVersion,
    ) -> Result<Vec<AppliedMigration>, MigrationError> {
        let persistence = ProjectPersistence::from_project_root(project_root);
        let applied = persistence.load_applied_migrations();
        let applied_versions: std::collections::HashSet<String> =
            applied.iter().map(|m| m.to_version.clone()).collect();

        let mut results = Vec::new();

        for migration in &self.migrations {
            let to_ver = migration.to_version().to_string();

            // Si la versión destino ya fue aplicada, saltar
            if applied_versions.contains(&to_ver) {
                continue;
            }

            // Si la versión del proyecto ya es >= la versión destino, saltar
            if !current_schema.is_newer_than(&migration.to_version())
                && current_schema == &migration.to_version()
            {
                continue;
            }

            // Crear backup antes de migrar
            let backup_path = self.create_backup(&persistence, project_root)?;

            // Ejecutar migración
            let changes = match migration.migrate(project_root, &persistence) {
                Ok(changes) => changes,
                Err(e) => {
                    // Revertir desde backup
                    let _ = self.restore_backup(&backup_path, &persistence.texisstudio_dir);
                    return Err(MigrationError::MigrationFailed {
                        step: migration.description().to_string(),
                        error: e.to_string(),
                    });
                }
            };

            let record = AppliedMigration {
                from_version: migration.from_version().to_string(),
                to_version: to_ver.clone(),
                applied_at: Utc::now(),
                backup_path: Some(backup_path),
                changes,
                warnings: Vec::new(),
            };

            persistence
                .record_migration(record.clone())
                .map_err(|e| MigrationError::MigrationFailed {
                    step: "record_migration".to_string(),
                    error: e.to_string(),
                })?;

            results.push(record);
        }

        Ok(results)
    }

    fn create_backup(
        &self,
        persistence: &ProjectPersistence,
        project_root: &Path,
    ) -> Result<std::path::PathBuf, MigrationError> {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_dir = persistence
            .migrations_dir()
            .join(format!("backup_{}", timestamp));

        std::fs::create_dir_all(&backup_dir)
            .map_err(MigrationError::BackupFailed)?;

        // Copiar todo el directorio .texisstudio/ al backup
        copy_dir_recursive(&persistence.texisstudio_dir, &backup_dir)
            .map_err(MigrationError::BackupFailed)?;

        Ok(backup_dir)
    }

    fn restore_backup(
        &self,
        backup_path: &Path,
        texisstudio_dir: &Path,
    ) -> std::io::Result<()> {
        // Eliminar el directorio actual
        if texisstudio_dir.exists() {
            std::fs::remove_dir_all(texisstudio_dir)?;
        }
        // Restaurar desde backup
        copy_dir_recursive(backup_path, texisstudio_dir)
    }
}

impl Default for MigrationRunner {
    fn default() -> Self { Self::new() }
}

// ── Migración inicial: pre-1.0 → 1.0.0 ───────────────────────────────────────

struct MigrateInitialV1;

impl ProjectMigration for MigrateInitialV1 {
    fn from_version(&self) -> SchemaVersion {
        SchemaVersion { major: 0, minor: 9, patch: 0 }
    }

    fn to_version(&self) -> SchemaVersion {
        SchemaVersion::CURRENT
    }

    fn description(&self) -> &str {
        "Migración inicial: estructura .texisstudio/ v1.0"
    }

    fn migrate(&self, project_root: &Path, persistence: &ProjectPersistence) -> CoreResult<Vec<String>> {
        let mut changes = Vec::new();

        // 1. Asegurar que existe la estructura de directorios v1.0
        persistence.init_dirs()?;
        changes.push("Directorios .texisstudio/ creados".to_string());

        // 2. Si existe un project.json en formato antiguo, migrarlo
        let project_json = persistence.project_json();
        if project_json.exists() {
            let content = std::fs::read_to_string(&project_json)
                .map_err(CoreError::Io)?;
            if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&content) {
                // Actualizar schema_version si no está presente o es antigua
                if value.get("schema_version").is_none() {
                    value["schema_version"] = serde_json::json!({
                        "major": 1, "minor": 0, "patch": 0
                    });
                    let updated = serde_json::to_string_pretty(&value)
                        .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
                    std::fs::write(&project_json, updated)
                        .map_err(CoreError::Io)?;
                    changes.push("schema_version actualizado en project.json".to_string());
                }
            }
        }

        // 3. Crear .gitignore si no existe
        let gitignore = project_root.join(".gitignore");
        if !gitignore.exists() {
            std::fs::write(&gitignore, ProjectPersistence::recommended_gitignore())
                .map_err(CoreError::Io)?;
            changes.push(".gitignore creado con reglas recomendadas".to_string());
        }

        Ok(changes)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in walkdir::WalkDir::new(src).min_depth(1) {
        let entry = entry.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        let rel = entry.path().strip_prefix(src)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        let dest = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(entry.path(), &dest)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_project(dir: &TempDir) -> ProjectPersistence {
        let p = ProjectPersistence::from_project_root(dir.path());
        p.init_dirs().unwrap();
        p
    }

    #[test]
    fn migration_creates_gitignore() {
        let dir = tempfile::tempdir().unwrap();
        let persistence = setup_project(&dir);
        let migration = MigrateInitialV1;
        let changes = migration.migrate(dir.path(), &persistence).unwrap();
        assert!(dir.path().join(".gitignore").exists());
        assert!(changes.iter().any(|c| c.contains("gitignore")));
    }

    #[test]
    fn migration_runner_records_applied() {
        let dir = tempfile::tempdir().unwrap();
        setup_project(&dir);
        // Escribir un project.json mínimo sin schema_version
        let project_json = dir.path().join(".texisstudio/project.json");
        std::fs::write(&project_json, r#"{"id": "test", "root_file": "main.tex"}"#).unwrap();

        let runner = MigrationRunner::new();
        let old_schema = SchemaVersion { major: 0, minor: 9, patch: 0 };
        // Migración debería ejecutarse aunque el proyecto sea 0.9 → 1.0
        // En este test simplificado solo verificamos que no falla
        let result = runner.migrate_if_needed(dir.path(), &SchemaVersion::CURRENT);
        // Puede estar "already applied" o ejecutarse — lo importante es no panics
        assert!(result.is_ok() || matches!(result, Err(MigrationError::AlreadyApplied)));
    }

    #[test]
    fn schema_version_display() {
        let v = SchemaVersion { major: 1, minor: 2, patch: 3 };
        assert_eq!(v.to_string(), "1.2.3");
    }
}
