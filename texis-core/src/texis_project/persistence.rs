use super::model::{
    BuildSummary, ProjectConfig, SchemaVersion, TexisProject, WorkspaceState,
};
use serde::{Deserialize, Serialize};
use crate::bibliography::registry::BibliographyRegistry;
use crate::asset::registry::AssetRegistry;
use crate::reference::registry::LabelRegistry;
use crate::error::{CoreError, CoreResult};
use std::path::{Path, PathBuf};

// ── Estructura .texisstudio/ ──────────────────────────────────────────────────
//
// .texisstudio/
// ├─ project.json           ← ProjectConfig (configuración, metadatos, build)
// ├─ workspace.json         ← WorkspaceState (UI, archivos abiertos) — no va a Git
// ├─ registries/
// │  ├─ asset-index.json    ← AssetRegistry — regenerable
// │  ├─ label-registry.json ← LabelRegistry — regenerable
// │  ├─ bibliography-index.json ← BibliographyRegistry — NO regenerable (tiene provenance)
// ├─ cache/                 ← descartable completamente
// ├─ migrations/
// │  └─ applied.json        ← historial de migraciones
// └─ logs/
//    └─ texisstudio.log

pub struct ProjectPersistence {
    pub texisstudio_dir: PathBuf,
}

impl ProjectPersistence {
    pub fn new(texisstudio_dir: PathBuf) -> Self {
        Self { texisstudio_dir }
    }

    pub fn from_project_root(root: &Path) -> Self {
        Self::new(root.join(".texisstudio"))
    }

    // ── Rutas ─────────────────────────────────────────────────────────────────

    pub fn project_json(&self) -> PathBuf { self.texisstudio_dir.join("project.json") }
    pub fn workspace_json(&self) -> PathBuf { self.texisstudio_dir.join("workspace.json") }
    pub fn registries_dir(&self) -> PathBuf { self.texisstudio_dir.join("registries") }
    pub fn cache_dir(&self) -> PathBuf { self.texisstudio_dir.join("cache") }
    pub fn migrations_dir(&self) -> PathBuf { self.texisstudio_dir.join("migrations") }
    pub fn logs_dir(&self) -> PathBuf { self.texisstudio_dir.join("logs") }

    pub fn asset_index_json(&self) -> PathBuf { self.registries_dir().join("asset-index.json") }
    pub fn label_registry_json(&self) -> PathBuf { self.registries_dir().join("label-registry.json") }
    pub fn bibliography_index_json(&self) -> PathBuf { self.registries_dir().join("bibliography-index.json") }
    pub fn applied_migrations_json(&self) -> PathBuf { self.migrations_dir().join("applied.json") }

    pub fn bib_cache_dir(&self) -> PathBuf { self.cache_dir().join("bibliography") }
    pub fn dict_cache_dir(&self) -> PathBuf { self.cache_dir().join("dictionaries") }
    pub fn diagnostics_cache_dir(&self) -> PathBuf { self.cache_dir().join("diagnostics") }

    // ── Inicialización ────────────────────────────────────────────────────────

    /// Crea la estructura de directorios .texisstudio/ si no existe.
    pub fn init_dirs(&self) -> CoreResult<()> {
        for dir in &[
            &self.texisstudio_dir,
            &self.registries_dir(),
            &self.cache_dir(),
            &self.migrations_dir(),
            &self.logs_dir(),
            &self.bib_cache_dir(),
            &self.dict_cache_dir(),
            &self.diagnostics_cache_dir(),
        ] {
            std::fs::create_dir_all(dir).map_err(CoreError::Io)?;
        }
        Ok(())
    }

    /// Verifica si existe un proyecto en este directorio.
    pub fn exists(&self) -> bool {
        self.project_json().exists()
    }

    // ── ProjectConfig ─────────────────────────────────────────────────────────

    pub fn save_config(&self, config: &ProjectConfig) -> CoreResult<()> {
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
        atomic_write(&self.project_json(), json.as_bytes())
    }

    pub fn load_config(&self) -> CoreResult<ProjectConfig> {
        let path = self.project_json();
        if !path.exists() {
            return Err(CoreError::FileNotFound { path: path.display().to_string() });
        }
        let content = std::fs::read_to_string(&path).map_err(CoreError::Io)?;
        let config: ProjectConfig = serde_json::from_str(&content)
            .map_err(|e| CoreError::InvalidProject { message: format!("project.json inválido: {e}") })?;

        // Verificar compatibilidad de schema
        if !SchemaVersion::CURRENT.is_backward_compatible(&config.schema_version) {
            if config.schema_version.is_newer_than(&SchemaVersion::CURRENT) {
                return Err(CoreError::UnsupportedSchemaVersion {
                    version: config.schema_version.to_string(),
                    current: SchemaVersion::CURRENT.to_string(),
                });
            }
        }
        Ok(config)
    }

    // ── WorkspaceState ────────────────────────────────────────────────────────

    pub fn save_workspace(&self, state: &WorkspaceState) -> CoreResult<()> {
        let json = serde_json::to_string_pretty(state)
            .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
        atomic_write(&self.workspace_json(), json.as_bytes())
    }

    pub fn load_workspace(&self) -> WorkspaceState {
        let path = self.workspace_json();
        if !path.exists() { return WorkspaceState::default(); }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    // ── BibliographyRegistry ──────────────────────────────────────────────────
    // No regenerable — contiene provenance y raw_payload que no están en el .bib

    pub fn save_bibliography(&self, registry: &BibliographyRegistry) -> CoreResult<()> {
        let json = serde_json::to_string_pretty(registry)
            .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
        atomic_write(&self.bibliography_index_json(), json.as_bytes())
    }

    pub fn load_bibliography(&self) -> BibliographyRegistry {
        let path = self.bibliography_index_json();
        if !path.exists() { return BibliographyRegistry::new(); }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    // ── AssetRegistry — regenerable ───────────────────────────────────────────

    pub fn save_assets(&self, registry: &AssetRegistry) -> CoreResult<()> {
        let json = serde_json::to_string_pretty(registry)
            .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
        atomic_write(&self.asset_index_json(), json.as_bytes())
    }

    pub fn load_assets(&self) -> AssetRegistry {
        let path = self.asset_index_json();
        if !path.exists() { return AssetRegistry::new(); }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    // ── LabelRegistry — regenerable ───────────────────────────────────────────

    pub fn save_labels(&self, registry: &LabelRegistry) -> CoreResult<()> {
        let json = serde_json::to_string_pretty(registry)
            .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
        atomic_write(&self.label_registry_json(), json.as_bytes())
    }

    pub fn load_labels(&self) -> LabelRegistry {
        let path = self.label_registry_json();
        if !path.exists() { return LabelRegistry::new(); }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    // ── Cache de proveedores bibliográficos ───────────────────────────────────

    pub fn get_bib_cache(&self, doi: &str) -> Option<serde_json::Value> {
        let path = self.bib_cache_dir().join(doi_to_filename(doi));
        if !path.exists() { return None; }
        let content = std::fs::read_to_string(&path).ok()?;
        let cached: CachedPayload = serde_json::from_str(&content).ok()?;

        // Verificar TTL
        let age = chrono::Utc::now()
            .signed_duration_since(cached.fetched_at)
            .num_seconds();
        if age > cached.ttl_seconds as i64 { return None; }

        Some(cached.payload)
    }

    pub fn set_bib_cache(&self, doi: &str, provider: &str, payload: serde_json::Value, ttl_days: u32) {
        let path = self.bib_cache_dir().join(doi_to_filename(doi));
        let cached = CachedPayload {
            doi: doi.to_string(),
            provider: provider.to_string(),
            payload,
            fetched_at: chrono::Utc::now(),
            ttl_seconds: ttl_days as i64 * 86400,
        };
        if let Ok(json) = serde_json::to_string_pretty(&cached) {
            let _ = std::fs::write(path, json);
        }
    }

    pub fn invalidate_bib_cache(&self, doi: &str) {
        let path = self.bib_cache_dir().join(doi_to_filename(doi));
        let _ = std::fs::remove_file(path);
    }

    /// Elimina todo el directorio cache/ (operación segura — todo es regenerable).
    pub fn clear_cache(&self) -> CoreResult<()> {
        if self.cache_dir().exists() {
            std::fs::remove_dir_all(self.cache_dir()).map_err(CoreError::Io)?;
            std::fs::create_dir_all(self.cache_dir()).map_err(CoreError::Io)?;
        }
        Ok(())
    }

    // ── Migraciones ───────────────────────────────────────────────────────────

    pub fn load_applied_migrations(&self) -> Vec<AppliedMigration> {
        let path = self.applied_migrations_json();
        if !path.exists() { return Vec::new(); }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn record_migration(&self, migration: AppliedMigration) -> CoreResult<()> {
        let mut applied = self.load_applied_migrations();
        applied.push(migration);
        let json = serde_json::to_string_pretty(&applied)
            .map_err(|e| CoreError::InvalidProject { message: e.to_string() })?;
        atomic_write(&self.applied_migrations_json(), json.as_bytes())
    }

    // ── .gitignore del proyecto ───────────────────────────────────────────────

    /// Genera el contenido del .gitignore recomendado para el proyecto.
    pub fn recommended_gitignore() -> &'static str {
        r#"# Build de LaTeX
build/
*.aux
*.log
*.bcf
*.blg
*.bbl
*.out
*.toc
*.lof
*.lot
*.glo
*.gls
*.glg
*.ist
*.acn
*.acr
*.alg
*.run.xml
*.synctex.gz
*.fdb_latexmk
*.fls

# Metadatos de TeXisStudio (regenerables o privados)
.texisstudio/workspace.json
.texisstudio/cache/
.texisstudio/logs/
"#
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Escritura atómica: escribe a un archivo temporal y luego hace rename.
fn atomic_write(path: &Path, data: &[u8]) -> CoreResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(CoreError::Io)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, data).map_err(CoreError::Io)?;
    std::fs::rename(&tmp, path).map_err(CoreError::Io)?;
    Ok(())
}

/// Convierte un DOI a un nombre de archivo seguro para el caché.
fn doi_to_filename(doi: &str) -> String {
    let safe: String = doi
        .chars()
        .map(|c| match c {
            '/' => '_',
            '.' => '.',
            c if c.is_ascii_alphanumeric() || c == '-' => c,
            _ => '_',
        })
        .collect();
    format!("{}.json", safe)
}

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct CachedPayload {
    pub doi: String,
    pub provider: String,
    pub payload: serde_json::Value,
    pub fetched_at: chrono::DateTime<chrono::Utc>,
    pub ttl_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppliedMigration {
    pub from_version: String,
    pub to_version: String,
    pub applied_at: chrono::DateTime<chrono::Utc>,
    pub backup_path: Option<PathBuf>,
    pub changes: Vec<String>,
    pub warnings: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup(dir: &TempDir) -> ProjectPersistence {
        ProjectPersistence::from_project_root(dir.path())
    }

    #[test]
    fn init_dirs_creates_structure() {
        let dir = tempfile::tempdir().unwrap();
        let p = setup(&dir);
        p.init_dirs().unwrap();
        assert!(p.texisstudio_dir.exists());
        assert!(p.registries_dir().exists());
        assert!(p.cache_dir().exists());
        assert!(p.migrations_dir().exists());
    }

    #[test]
    fn save_and_load_config() {
        use super::super::model::{ProjectConfig, ProjectMetadata, BuildConfig, SchemaVersion};
        use uuid::Uuid;
        use chrono::Utc;

        let dir = tempfile::tempdir().unwrap();
        let p = setup(&dir);
        p.init_dirs().unwrap();

        let config = ProjectConfig {
            id: Uuid::new_v4(),
            schema_version: SchemaVersion::CURRENT,
            root_file: PathBuf::from("main.tex"),
            profile: None,
            metadata: ProjectMetadata {
                title: "Test Project".to_string(),
                language: "es".to_string(),
                ..Default::default()
            },
            build_config: BuildConfig::default(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
        };

        p.save_config(&config).unwrap();
        let loaded = p.load_config().unwrap();
        assert_eq!(loaded.metadata.title, "Test Project");
    }

    #[test]
    fn workspace_defaults_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let p = setup(&dir);
        let ws = p.load_workspace();
        assert!(ws.open_files.is_empty());
    }

    #[test]
    fn bib_cache_miss_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let p = setup(&dir);
        p.init_dirs().unwrap();
        assert!(p.get_bib_cache("10.1145/111").is_none());
    }

    #[test]
    fn bib_cache_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let p = setup(&dir);
        p.init_dirs().unwrap();
        let payload = serde_json::json!({"title": "test"});
        p.set_bib_cache("10.1145/111", "Crossref", payload.clone(), 30);
        let cached = p.get_bib_cache("10.1145/111");
        assert_eq!(cached, Some(payload));
    }

    #[test]
    fn clear_cache_does_not_break_project() {
        let dir = tempfile::tempdir().unwrap();
        let p = setup(&dir);
        p.init_dirs().unwrap();
        p.set_bib_cache("10.1145/111", "Crossref", serde_json::json!({}), 30);
        p.clear_cache().unwrap();
        assert!(p.get_bib_cache("10.1145/111").is_none());
        // El directorio cache sigue existiendo (recreado)
        assert!(p.cache_dir().exists());
    }

    #[test]
    fn doi_to_filename_safe() {
        let name = doi_to_filename("10.1145/111.222");
        assert!(!name.contains('/'));
        assert!(name.ends_with(".json"));
    }
}
