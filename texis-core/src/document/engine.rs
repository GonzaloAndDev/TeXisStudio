// DocumentEngine — gestiona la generación de main.tex, tracking de checksums
// y resincronización cuando el usuario edita archivos manualmente fuera de la app.

use crate::error::{CoreError, CoreResult};
use crate::events::{EventBus, ProjectEvent};
use crate::generator::LaTeXGenerator;
use crate::project::model::{FileState, ProjectModel};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

// ── Tipos públicos ────────────────────────────────────────────────────────────

/// Tipo de cambio externo detectado en los archivos del build.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExternalChange {
    MainTexModified,
    PreambleModified,
}

/// Resultado de una operación de resincronización.
#[derive(Debug, Clone, Default)]
pub struct ResyncReport {
    /// Archivos regenerados (sobrescritos con la versión generada).
    pub regenerated: Vec<String>,
    /// Archivos preservados por estar marcados como Manual en file_states.
    pub preserved_manual: Vec<String>,
    /// Cambios externos detectados antes de la resincronización.
    pub external_changes: Vec<ExternalChange>,
}

// ── Struct de checksums persistibles ─────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
struct Checksums {
    #[serde(default)]
    pub main_tex: Option<String>,
}

// ── DocumentEngine ────────────────────────────────────────────────────────────

pub struct DocumentEngine {
    generator: LaTeXGenerator,
    last_checksums: Checksums,
}

impl DocumentEngine {
    pub fn new() -> CoreResult<Self> {
        Ok(Self {
            generator: LaTeXGenerator::new()?,
            last_checksums: Checksums::default(),
        })
    }

    /// Carga un DocumentEngine restaurando los checksums guardados en disco.
    pub fn load(project_root: &Path) -> CoreResult<Self> {
        let mut engine = Self::new()?;
        let checksum_path = checksums_path(project_root);
        if checksum_path.exists() {
            let content = std::fs::read_to_string(&checksum_path).map_err(CoreError::Io)?;
            if let Ok(cs) = serde_json::from_str::<Checksums>(&content) {
                engine.last_checksums = cs;
            }
        }
        Ok(engine)
    }

    /// Genera main.tex en build_dir y registra su checksum.
    /// Emite `ProjectEvent::TexFileSaved` al terminar.
    pub fn generate(
        &mut self,
        model: &ProjectModel,
        build_dir: &Path,
        event_bus: &EventBus,
    ) -> CoreResult<()> {
        self.generator.generate(model, build_dir)?;

        let main_tex_path = build_dir.join("main.tex");
        if main_tex_path.exists() {
            let content = std::fs::read_to_string(&main_tex_path).map_err(CoreError::Io)?;
            self.last_checksums.main_tex = Some(sha256_hex(&content));
        }

        event_bus.emit(&ProjectEvent::TexFileSaved {
            path: build_dir.join("main.tex"),
        });

        Ok(())
    }

    /// Genera todos los archivos usando la configuración de idioma y portada del perfil.
    pub fn generate_with_profile(
        &mut self,
        model: &ProjectModel,
        build_dir: &Path,
        lang_config: Option<&Value>,
        title_page_template: Option<&str>,
        event_bus: &EventBus,
    ) -> CoreResult<()> {
        self.generator
            .generate_with_profile(model, build_dir, lang_config, title_page_template)?;
        self.record_main_tex(build_dir)?;
        emit_main_tex_saved(build_dir, event_bus);
        Ok(())
    }

    /// Solo genera el main.tex como String, sin escribir a disco ni actualizar checksums.
    pub fn render_main_tex_string(&self, model: &ProjectModel) -> CoreResult<String> {
        self.generator.generate_main_tex_string(model)
    }

    /// Detecta si main.tex en disco difiere del último generado.
    /// Devuelve los cambios externos encontrados.
    pub fn detect_external_changes(&self, build_dir: &Path) -> Vec<ExternalChange> {
        let mut changes = Vec::new();

        if let Some(ref known_checksum) = self.last_checksums.main_tex {
            let main_path = build_dir.join("main.tex");
            if main_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&main_path) {
                    let current = sha256_hex(&content);
                    if &current != known_checksum {
                        changes.push(ExternalChange::MainTexModified);
                    }
                }
            }
        }

        changes
    }

    /// Regenera los archivos del build respetando `FileState::Manual`,
    /// emite el evento `TexFileSaved` y actualiza los checksums.
    ///
    /// Úsalo cuando el modelo cambia y se quiere actualizar build/
    /// sin pisar archivos que el usuario editó manualmente.
    pub fn resync(
        &mut self,
        model: &ProjectModel,
        build_dir: &Path,
        event_bus: &EventBus,
    ) -> CoreResult<ResyncReport> {
        let external = self.detect_external_changes(build_dir);

        let drift = self
            .generator
            .generate_respecting_manual_edits(model, build_dir, None, None)?;

        let main_tex_path = build_dir.join("main.tex");
        if main_tex_path.exists() {
            let content = std::fs::read_to_string(&main_tex_path).map_err(CoreError::Io)?;
            self.last_checksums.main_tex = Some(sha256_hex(&content));
        }

        event_bus.emit(&ProjectEvent::TexFileSaved {
            path: build_dir.join("main.tex"),
        });

        Ok(ResyncReport {
            regenerated: drift.generated,
            preserved_manual: drift.preserved_manual,
            external_changes: external,
        })
    }

    /// Sincroniza el build sin sobrescribir un `main.tex` modificado externamente.
    /// También conserva `main.tex` al adoptar proyectos antiguos que aún no tienen checksum.
    pub fn sync_preserving_external_edits(
        &mut self,
        model: &ProjectModel,
        build_dir: &Path,
        lang_config: Option<&Value>,
        title_page_template: Option<&str>,
        event_bus: &EventBus,
    ) -> CoreResult<ResyncReport> {
        let external_changes = self.detect_external_changes(build_dir);
        let main_path = build_dir.join("main.tex");
        let untracked_main_is_external =
            if self.last_checksums.main_tex.is_none() && main_path.exists() {
                let current = std::fs::read_to_string(&main_path).map_err(CoreError::Io)?;
                let expected = self
                    .generator
                    .generate_main_tex_string_with_lang(model, lang_config)?;
                current != expected
            } else {
                false
            };
        let preserve_main = untracked_main_is_external
            || external_changes.contains(&ExternalChange::MainTexModified);

        let mut effective_model = model.clone();
        if preserve_main {
            effective_model
                .file_states
                .insert("main.tex".to_string(), FileState::Manual);
        }

        let drift = self.generator.generate_respecting_manual_edits(
            &effective_model,
            build_dir,
            lang_config,
            title_page_template,
        )?;
        if !preserve_main {
            self.record_main_tex(build_dir)?;
        }
        emit_main_tex_saved(build_dir, event_bus);

        Ok(ResyncReport {
            regenerated: drift.generated,
            preserved_manual: drift.preserved_manual,
            external_changes,
        })
    }

    /// Persiste los checksums actuales en `.texisstudio/checksums.json`.
    pub fn save_checksums(&self, project_root: &Path) -> CoreResult<()> {
        let path = checksums_path(project_root);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(CoreError::Io)?;
        }
        let json = serde_json::to_string_pretty(&self.last_checksums).map_err(|e| {
            CoreError::InvalidProject {
                message: e.to_string(),
            }
        })?;
        std::fs::write(&path, json).map_err(CoreError::Io)?;
        Ok(())
    }

    pub fn last_main_tex_checksum(&self) -> Option<&str> {
        self.last_checksums.main_tex.as_deref()
    }

    fn record_main_tex(&mut self, build_dir: &Path) -> CoreResult<()> {
        let main_tex_path = build_dir.join("main.tex");
        if main_tex_path.exists() {
            let content = std::fs::read_to_string(&main_tex_path).map_err(CoreError::Io)?;
            self.last_checksums.main_tex = Some(sha256_hex(&content));
        }
        Ok(())
    }
}

impl Default for DocumentEngine {
    fn default() -> Self {
        Self::new().expect("LaTeXGenerator::new() no debe fallar")
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn sha256_hex(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn checksums_path(project_root: &Path) -> PathBuf {
    project_root.join(".texisstudio").join("checksums.json")
}

fn emit_main_tex_saved(build_dir: &Path, event_bus: &EventBus) {
    event_bus.emit(&ProjectEvent::TexFileSaved {
        path: build_dir.join("main.tex"),
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_dir() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    fn sha256_hex_direct(s: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        h.update(s.as_bytes());
        format!("{:x}", h.finalize())
    }

    #[test]
    fn sha256_is_deterministic() {
        let a = sha256_hex("hello world");
        let b = sha256_hex("hello world");
        assert_eq!(a, b);
    }

    #[test]
    fn sha256_differs_for_different_inputs() {
        assert_ne!(sha256_hex("foo"), sha256_hex("bar"));
    }

    #[test]
    fn checksums_path_is_inside_texisstudio() {
        let root = Path::new("/project/my-thesis");
        let p = checksums_path(root);
        assert!(p.to_string_lossy().contains(".texisstudio"));
        assert!(p.to_string_lossy().ends_with("checksums.json"));
    }

    #[test]
    fn detect_external_changes_returns_empty_when_no_known_checksum() {
        let engine = DocumentEngine::new().unwrap();
        let dir = make_dir();
        let changes = engine.detect_external_changes(dir.path());
        assert!(changes.is_empty());
    }

    #[test]
    fn detect_external_changes_detects_modification() {
        let mut engine = DocumentEngine::new().unwrap();
        let dir = make_dir();
        let build_dir = dir.path();
        let main_path = build_dir.join("main.tex");

        // Simular que se generó y se registró el checksum
        std::fs::write(&main_path, "% original content").unwrap();
        let original = std::fs::read_to_string(&main_path).unwrap();
        engine.last_checksums.main_tex = Some(sha256_hex_direct(&original));

        // Modificar el archivo externamente
        std::fs::write(&main_path, "% user edited this").unwrap();

        let changes = engine.detect_external_changes(build_dir);
        assert!(changes.contains(&ExternalChange::MainTexModified));
    }

    #[test]
    fn detect_external_changes_no_change_when_identical() {
        let mut engine = DocumentEngine::new().unwrap();
        let dir = make_dir();
        let main_path = dir.path().join("main.tex");

        std::fs::write(&main_path, "% same content").unwrap();
        let content = std::fs::read_to_string(&main_path).unwrap();
        engine.last_checksums.main_tex = Some(sha256_hex_direct(&content));

        let changes = engine.detect_external_changes(dir.path());
        assert!(changes.is_empty());
    }

    #[test]
    fn save_and_load_checksums_roundtrip() {
        let dir = make_dir();
        let project_root = dir.path();

        let mut engine = DocumentEngine::new().unwrap();
        engine.last_checksums.main_tex = Some("abc123deadbeef".to_string());
        engine.save_checksums(project_root).unwrap();

        let loaded = DocumentEngine::load(project_root).unwrap();
        assert_eq!(
            loaded.last_checksums.main_tex,
            Some("abc123deadbeef".to_string())
        );
    }

    #[test]
    fn load_missing_checksums_returns_default() {
        let dir = make_dir();
        let engine = DocumentEngine::load(dir.path()).unwrap();
        assert!(engine.last_checksums.main_tex.is_none());
    }
}
